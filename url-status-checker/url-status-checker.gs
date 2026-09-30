/**
 * URL Status Checker for Google Sheets
 * ====================================
 * Paste a list of URLs into a sheet, get back the HTTP response for each
 * one: status code, status text, and where redirects point.
 *
 * Runs entirely inside your own Google Sheet. Nothing is sent anywhere
 * except the HTTP requests to the URLs you list.
 *
 * SETUP
 *   1. Create a tab named "URLs".
 *   2. Put your web addresses in column A, one per row, starting at A2.
 *      Row 1 is a header row and is never read, so its label does not
 *      matter. Each value in column A must be an address the browser
 *      could open - https://example.com/about/ - not a page name or title.
 *      Only column A is read; anything in B and beyond is ignored.
 *   3. Extensions -> Apps Script -> paste this file -> Save.
 *   4. Refresh the sheet. A "URL Check" menu appears.
 *   5. Run "Check URLs". Google asks for authorization the first time.
 *
 * WHAT IT REPORTS
 *   The status code and text for every URL, and for redirects, the
 *   destination plus whether the redirect is permanent (301/308) or
 *   temporary (302/307). That last distinction is the one people miss:
 *   a temporary redirect does not pass ranking signals the way a
 *   permanent one does, and a 302 left in place after a migration looks
 *   perfectly fine in a browser.
 *
 * SCOPE
 *   This reports the HTTP response and nothing further. A URL that
 *   answers with a clean 200 has cleared this check, which is a narrower
 *   statement than it sounds - verifying a migration involves more than
 *   confirming the addresses respond.
 *
 * EXECUTION
 *   Google caps script runs at 6 minutes. This checks 200 URLs per run
 *   and saves progress, so on a longer list you run it repeatedly until
 *   it reports complete.
 *
 * Copyright (c) 2026 Norb Lara
 * MIT License
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('URL Check')
    .addItem('Check URLs', 'checkUrls')
    .addItem('Start over', 'resetProgress')
    .addToUi();
}

function resetProgress() {
  const ss = SpreadsheetApp.getActive();
  PropertiesService.getDocumentProperties().deleteProperty('usc_progress');
  const sheet = ss.getSheetByName('Results');
  if (sheet) ss.deleteSheet(sheet);
  SpreadsheetApp.getUi().alert('Progress cleared. The next run starts from the first URL.');
}

function checkUrls() {
  const ss    = SpreadsheetApp.getActive();
  const ui    = SpreadsheetApp.getUi();
  const props = PropertiesService.getDocumentProperties();

  const source = ss.getSheetByName('URLs');
  if (!source) {
    ui.alert('Sheet "URLs" not found',
      'Create a tab named "URLs" and put your web addresses ' +
      'in column A, starting at A2.', ui.ButtonSet.OK);
    return;
  }

  const lastRow = source.getLastRow();
  if (lastRow < 2) {
    ui.alert('No URLs found. Put them in column A of the "URLs" tab, starting at A2.');
    return;
  }

  const urls = source.getRange(2, 1, lastRow - 1, 1).getValues()
    .map(r => String(r[0] || '').trim())
    .filter(u => u.length > 0);

  if (urls.length === 0) { ui.alert('Column A is empty below the header row.'); return; }

  const sample = urls.slice(0, 20);
  const usable = sample.filter(u => normalizeInput_(u) !== null).length;

  if (usable === 0) {
    ui.alert('Column A does not contain web addresses',
      'None of the first ' + sample.length + ' rows look like an address.\n\n' +
      'First value found:\n"' + truncate_(sample[0], 120) + '"\n\n' +
      'Column A needs values a browser could open, e.g.\n' +
      'https://example.com/about/\n\n' +
      'Row 1 is skipped as a header. Check that your addresses start at A2 ' +
      'and that column A is not holding some other field.',
      ui.ButtonSet.OK);
    return;
  }

  if (usable < sample.length) {
    const r = ui.alert('Some rows are not addresses',
      (sample.length - usable) + ' of the first ' + sample.length + ' rows do not ' +
      'look like web addresses. They will be reported as "Not a URL" and skipped.\n\n' +
      'Continue?', ui.ButtonSet.YES_NO);
    if (r !== ui.Button.YES) return;
  }

  let start = parseInt(props.getProperty('usc_progress') || '0', 10);
  if (start >= urls.length) { start = 0; props.deleteProperty('usc_progress'); }

  let report = ss.getSheetByName('Results');
  if (!report) {
    report = ss.insertSheet('Results');
    report.getRange(1, 1, 1, 5)
      .setValues([['URL', 'Code', 'Status', 'Redirects To', 'Redirect Type']])
      .setBackground('#356854').setFontColor('#ffffff').setFontWeight('bold');
    report.setFrozenRows(1);
  }

  const end  = Math.min(start + 200, urls.length);
  const rows = [];

  for (let i = start; i < end; i++) {
    const r = check_(urls[i]);
    rows.push([urls[i], r.code, r.text, r.location || '', r.redirectType]);
  }

  if (rows.length > 0) {
    const firstRow = report.getLastRow() + 1;
    report.getRange(firstRow, 1, rows.length, 5).setValues(rows);
    colorCodes_(report, firstRow, rows.length);
  }

  if (end < urls.length) {
    props.setProperty('usc_progress', String(end));
    ui.alert(end + ' of ' + urls.length + ' checked.\n\nRun "Check URLs" again to continue.');
  } else {
    props.deleteProperty('usc_progress');
    writeSummary_(report, urls.length);
    report.autoResizeColumns(1, 5);
    for (let c = 1; c <= 5; c++) {
      if (report.getColumnWidth(c) > 400) report.setColumnWidth(c, 400);
    }
    ui.alert('Complete. ' + urls.length + ' URLs checked.');
  }
}

function normalizeInput_(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;

  if (/^https?:\/\//i.test(s)) return s;

  const host = s.split(/[\/?#]/)[0];
  if (/\s/.test(host)) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return null;

  return 'https://' + s;
}

function check_(rawUrl) {
  const url = normalizeInput_(rawUrl);
  if (!url) {
    return { code: 0, text: 'Not a URL - check column A', location: '', redirectType: '' };
  }

  try {
    const res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: false,
      validateHttpsCertificates: false,
      timeout: 10
    });

    const code     = res.getResponseCode();
    const headers  = res.getAllHeaders();
    const location = headers['Location'] || headers['location'] || '';

    let redirectType = '';
    if (code === 301 || code === 308)      redirectType = 'Permanent';
    else if (code === 302 || code === 307) redirectType = 'Temporary - review';
    else if (code === 303)                 redirectType = 'See Other';

    return { code, text: statusText_(code), location, redirectType };

  } catch (e) {
    const msg = String(e);
    const text = /certificate|ssl|handshake/i.test(msg)           ? 'SSL / certificate error'
               : /timeout|timed out/i.test(msg)                   ? 'Timeout'
               : /invalid argument/i.test(msg)                    ? 'Invalid URL'
               : /dns|unknown host|could not be found/i.test(msg) ? 'Host not found'
               : 'Request failed - ' + truncate_(msg.replace(/^Exception:\s*/i, ''), 80);
    return { code: 0, text, location: '', redirectType: '' };
  }
}

function writeSummary_(sheet, total) {
  const last = sheet.getLastRow();
  if (last < 2) return;

  const codes = sheet.getRange(2, 2, last - 1, 1).getValues().flat()
    .map(v => parseInt(v, 10) || 0);

  const ok        = codes.filter(c => c >= 200 && c < 300).length;
  const redirect  = codes.filter(c => c >= 300 && c < 400).length;
  const permanent = codes.filter(c => c === 301 || c === 308).length;
  const temporary = codes.filter(c => c === 302 || c === 307).length;
  const notFound  = codes.filter(c => c >= 400 && c < 500).length;
  const serverErr = codes.filter(c => c >= 500).length;
  const failed    = codes.filter(c => c === 0).length;

  const row = last + 2;
  sheet.getRange(row, 1).setValue('SUMMARY').setFontWeight('bold').setFontSize(12);

  const summary = [
    ['URLs checked', total],
    ['2xx OK', ok],
    ['3xx Redirect', redirect],
    ['  of which permanent (301/308)', permanent],
    ['  of which temporary (302/307)', temporary],
    ['4xx Not found / client error', notFound],
    ['5xx Server error', serverErr],
    ['No response', failed],
    ['Checked on', new Date()]
  ];

  sheet.getRange(row + 1, 1, summary.length, 2).setValues(summary);
  sheet.getRange(row + 1, 1, summary.length, 1).setFontWeight('bold');

  const notes = [];
  if (serverErr > 0) notes.push(serverErr + ' URL(s) returned 5xx - server-side, fix before anything else.');
  if (notFound > 0)  notes.push(notFound + ' URL(s) returned 4xx - each needs a redirect, or a deliberate decision to leave it gone.');
  if (temporary > 0) notes.push(temporary + ' temporary redirect(s) - 302 and 307 do not pass ranking signals the way 301 does.');
  if (failed > 0)    notes.push(failed + ' URL(s) did not respond - see the Status column for the reason on each.');

  if (notes.length > 0) {
    const noteRow = row + summary.length + 2;
    sheet.getRange(noteRow, 1).setValue('WORTH LOOKING AT').setFontWeight('bold');
    notes.forEach((n, i) => {
      sheet.getRange(noteRow + 1 + i, 1).setValue(n).setFontColor('#D93025');
    });
  }
}

function colorCodes_(sheet, firstRow, numRows) {
  const range = sheet.getRange(firstRow, 2, numRows, 1);
  const rules = sheet.getConditionalFormatRules();
  [[200, 299, '#188038'], [300, 399, '#1A73E8'], [400, 599, '#D93025']]
    .forEach(([lo, hi, color]) => {
      rules.push(SpreadsheetApp.newConditionalFormatRule()
        .whenNumberBetween(lo, hi).setFontColor(color).setRanges([range]).build());
    });
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberEqualTo(0).setFontColor('#D93025').setBold(true).setRanges([range]).build());
  sheet.setConditionalFormatRules(rules);
}

function truncate_(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.substring(0, n) + '...' : s;
}

function statusText_(code) {
  const map = {
    200: 'OK', 201: 'Created', 204: 'No Content',
    301: 'Moved Permanently', 302: 'Found', 303: 'See Other',
    304: 'Not Modified', 307: 'Temporary Redirect', 308: 'Permanent Redirect',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
    404: 'Not Found', 405: 'Method Not Allowed', 410: 'Gone',
    429: 'Too Many Requests', 500: 'Internal Server Error',
    502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout'
  };
  return map[code] || ('HTTP ' + code);
}
