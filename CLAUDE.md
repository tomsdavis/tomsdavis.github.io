# PWAs - Personal Tools Site

## Project Overview
A GitHub Pages site hosting independent progressive web apps (tools/calculators). Each tool is self-contained in its own subdirectory. The home page links to them.

## Tech Stack & Constraints
- **Vanilla HTML + CSS + JavaScript** is the default — no frameworks, no build tools, no npm
- Functional-programming-style JS preferred (pure functions, immutable data, map/filter/reduce)
- Each PWA is self-contained: own HTML, CSS, JS, manifest, service worker
- Deploys from `main` branch to GitHub Pages — no build step at deploy time
- **Exception: pre-built apps.** A tool may use a build toolchain locally if its committed deploy artifact is plain static files (HTML/CSS/JS/assets) under its own subdirectory. Source lives in a sibling `<tool>-src/` directory; the built output is committed at `<tool>/`. See `solfa-src/` → `solfa/`.

## Project Structure
```
/
  index.html              # Home page linking to all tools
  CLAUDE.md
  /ephemerides/           # First tool — vanilla, source = deploy
    index.html
    style.css
    astronomy.js          # Pure calculation functions + star catalog (ES module)
    app.js                # UI logic, API integration, caching
    sw.js                 # Service worker (offline shell + static assets)
    manifest.json
    icon.svg
    tests.html            # In-browser test runner
    tests.js              # Also runnable via: deno run --allow-read ephemerides/tests.js
    private/              # Gitignored: change requests, scratch notes, anything not for the deploy
  /solfa-src/             # Pre-built tool: SvelteKit source (Deno + Vite + adapter-static)
                          # Run `deno task build` here to emit ../solfa/. See solfa-src/CLAUDE.md.
  /solfa/                 # Pre-built tool: committed deploy artifact (plain static files)
  /next-tool/             # Future tools follow either pattern
```

## Coding Conventions
- No dependencies or package managers
- Pure functions where possible; side effects isolated and explicit
- Service worker for PWA install + offline static asset caching
- localStorage for API response caching
- Tests: custom in-browser test runner (no test framework dependencies)
- Keep UI simple — tables over charts, minimal styling

## Testing
- Red-green TDD workflow
- In-browser test runner: each tool has `tests.html` + `tests.js`
- Tests also runnable headless via Deno: `deno run --allow-read ephemerides/tests.js`
- Test pure calculation functions; don't test DOM or network calls
- Run tests by opening `tests.html` in a browser

## Local Development
- Serve from the repo root: `python3 -m http.server 8000`
- App: http://localhost:8000/ephemerides/
- Tests: http://localhost:8000/ephemerides/tests.html
- A static server is required (ES module imports won't work over `file://`)

## Deployment
- GitHub Pages from `main` branch (user site repo `tomsdavis.github.io`, served at `https://tomsdavis.github.io/`)
- No build step at deploy time — files served as-is
- For vanilla tools: bump `CACHE_NAME` in each tool's `sw.js` when shipping changes to cached static assets, so the activate handler evicts the old cache on next load
- For pre-built tools (e.g. solfa): rebuild locally before commit (`cd solfa-src && deno task build`); the adapter writes to `../solfa/` and the SW cache key rotates per build automatically
- `.nojekyll` at the repo root disables GitHub Pages' Jekyll processing — required so paths beginning with `_` (e.g. SvelteKit's `_app/`) are served. Don't remove it.
