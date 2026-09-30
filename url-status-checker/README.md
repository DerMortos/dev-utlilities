# URL Status Checker for Google Sheets

Paste a list of URLs into a Google Sheet, get back the HTTP response for each one. No account, no install, no data leaving your sheet.

Useful after a migration, a replatform, or any bulk URL change, when you need to know which addresses still answer and which don't.

## Setup

### 1. Create the tab

Create a tab in your spreadsheet named exactly `URLs`.

### 2. Put your addresses in column A

Column A holds one web address per row, starting at **A2**:

```
A1  │ URL                              ← header row, never read
A2  │ https://example.com/
A3  │ https://example.com/about/
A4  │ https://example.com/services/
```

Three things to know about this:

- **Row 1 is skipped entirely.** It's treated as a header, so its label doesn't matter — `URL`, `Address`, anything, or nothing.
- **Values must be addresses a browser could open.** `https://example.com/about/` works. A bare `example.com/about` also works; the script adds the scheme. A page name or title does not work.
- **Only column A is read.** Anything in B, C, D and beyond is ignored. If your addresses are sitting in a different column, move them to A or copy them into a fresh sheet.

That last point is where most failed runs come from. If the values in column A aren't addresses, every row fails. The script samples the first 20 rows and stops with an explanation before running, rather than letting you wait through a full pass to find out.

### 3. Install the script

**Extensions → Apps Script**, paste in `url-status-checker.gs`, save.

### 4. Run it

Refresh the sheet — a **URL Check** menu appears. Run **URL Check → Check URLs**.

Google asks for authorization the first time. It needs permission to make HTTP requests and write to your sheet; nothing else.

## What you get

A `Results` tab with:

| Column | What it shows |
|---|---|
| URL | The address as you entered it |
| Code | HTTP status code, colour-coded |
| Status | Plain-English status text |
| Redirects To | Destination, for 3xx responses |
| Redirect Type | Permanent (301/308) or Temporary (302/307) |

Below the results, a summary with counts by response class and a short note on anything worth looking at.

The permanent/temporary split is the part worth reading closely. A 302 left in place after a migration looks perfectly fine in a browser and does not pass ranking signals the way a 301 does, so it's the kind of thing that survives a manual spot check and shows up later as lost traffic.

## Reading the results

| Code | Meaning |
|---|---|
| 200 | Responds normally |
| 301 / 308 | Permanent redirect — what a moved URL should return |
| 302 / 307 | Temporary redirect — usually wrong after a migration |
| 403 | Responds, but refuses the request |
| 404 / 410 | Gone — needs a redirect, or a deliberate decision to leave it |
| 429 | Rate limited — the server is throttling. Wait and re-run |
| 5xx | Server error — fix before looking at anything else |
| 0 | The request never completed — see below |

### Code 0

Code `0` means the request failed before reaching the server. The Status column names the reason:

| Status | What it means |
|---|---|
| `Not a URL - check column A` | The value isn't an address. See setup step 2. |
| `Invalid URL` | Malformed — check for stray spaces or characters |
| `Host not found` | Domain doesn't resolve. Check spelling, or DNS hasn't propagated yet |
| `SSL / certificate error` | Certificate problem on the target server |
| `Timeout` | No response within 10 seconds |
| `Request failed - ...` | Anything else, with the underlying error appended |

## Long lists

Google caps script runs at six minutes. This checks 200 URLs per run and saves progress, so on a longer list you run **Check URLs** repeatedly until it reports complete. A 900-URL site takes five runs.

**Start over** clears saved progress and deletes the `Results` tab.

## Scope

This reports the HTTP response for each address and stops there.

That's a narrower result than it can feel like when the column comes back green. A URL that answers with a 200 has confirmed one thing: the address responds. Whether the page behind it is the page that used to be there, and whether search engines can still index it, are separate questions with separate answers — and a clean run here doesn't speak to either.

Worth keeping in mind if the site you're checking has traffic you can't afford to lose.

## Privacy

Everything runs in your own Google account. The script makes HTTP requests to the addresses you list and writes results to your sheet. No third-party service is involved and nothing is transmitted anywhere else.

## Credits

Built and maintained by [Norb Lara](https://norblara.dev).

If this saved you some time, a link back is appreciated but not required.

## License

MIT — see [LICENSE](LICENSE). Use it, fork it, ship it inside something commercial. The only condition is that the copyright notice stays in copies of the source.
