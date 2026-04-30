# PWAs - Personal Tools Site

## Project Overview
A GitHub Pages site hosting independent progressive web apps (tools/calculators). Each tool is self-contained in its own subdirectory. The home page links to them.

## Tech Stack & Constraints
- **Vanilla HTML + CSS + JavaScript only** — no frameworks, no build tools, no npm
- Functional-programming-style JS preferred (pure functions, immutable data, map/filter/reduce)
- Each PWA is self-contained: own HTML, CSS, JS, manifest, service worker
- Deploys from `main` branch to GitHub Pages

## Project Structure
```
/
  index.html              # Home page linking to all tools
  CLAUDE.md
  /ephemerides/           # First tool
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
  /next-tool/             # Future tools follow same pattern
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
- GitHub Pages from `main` branch (personal site repo)
- No build step — files served as-is
- Bump `CACHE_NAME` in each tool's `sw.js` when shipping changes to cached static assets, so the activate handler evicts the old cache on next load
