# dev-utlilities
A collection of workflow tools built from real project work. Practical development utilities and reusable starters that I reach for often enough to be worth cleaning up and sharing.

Each tool is self-contained. Nothing here depends on anything else in the repo.

## Contents

### [url-status-checker/](./url-status-checker)

Paste a list of addresses into a Google Sheet and get back the HTTP response for each one: status code, status text, and where redirects point. Includes whether each redirect is permanent or temporary.

Built for checking a site after a migration, a re-platform, or a bulk URL change. Runs entirely inside a sheet you own, handles long lists by saving progress between runs, and needs no account or install.

The permanent/temporary distinction is the one worth knowing about. A temporary redirect left in place after a migration behaves correctly in a browser and doesn't pass ranking signals the way a permanent one does, so it survives a manual spot check and surfaces later as lost traffic.

---

### [css-starter-template/](./css-starter-template)

A generic CSS starter using BEM (Block\_\_Element--Modifier) naming, custom properties, and inline comments documenting where each class is meant to be used.

Serves as both a working stylesheet and a reference for consistent class naming across projects.

## Structure

    dev-utilities/
    ├── README.md                       ← you are here
    ├── LICENSE
    ├── url-status-checker/
    │   ├── README.md
    │   └── url-status-checker.gs
    └── css-starter-template/
        ├── README.md
        └── starter-template.css

## Scope

These are working tools rather than products. They solve the specific problem they describe and stop there. This is what makes them worth using, and occasionally what makes them the wrong choice.

Each tool's README says what it covers. Worth reading that before relying on one for anything consequential.

## Contributing

Issues and pull requests are welcome. The most useful contributions are bug reports with a reproducible case, or handling for a scenario a tool currently gets wrong.

Please keep changes in the spirit of the repo: each tool does one thing completely, runs without dependencies, and works for someone encountering it for the first time.

## Credits

Built and maintained by [YOUR NAME](https://yoursite.com).

## License

MIT — see [LICENSE](LICENSE). Use it, fork it, ship it inside something commercial. The only condition is that the copyright notice stays in copies of the source.
