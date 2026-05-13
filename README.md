# A11y Scanner API

Lightweight API that scans web pages for WCAG accessibility violations
using Playwright (headless Chromium) and axe-core.

## Local Development

```bash
npm install
npx playwright install chromium
npm run dev
```

Server starts on `http://localhost:3001`.

## API Endpoints

### `GET /health`
Returns `{ status: "ok", activeScans: 0 }`.

### `POST /scan`
Scan a single URL.

```json
{
  "url": "https://example.com/dashboard",
  "wcagLevel": "wcag21aa",
  "login": {
    "loginUrl": "https://example.com/login",
    "fields": [
      { "label": "Email", "value": "scanner@yourco.com" },
      { "label": "Password", "value": "your-password" }
    ]
  }
}
```

The `wcagLevel` field is optional and defaults to `wcag21aa`. The `login`
field is optional. When provided, the scanner will:
1. Navigate to `loginUrl`
2. Find each form field by its label text (falls back to placeholder)
3. Click the submit/sign-in button (falls back to pressing Enter)
4. Wait for navigation, then proceed to the target URL

### `POST /scan/batch`
Scan multiple URLs. Returns newline-delimited JSON (NDJSON) so the frontend
can show progress as each URL completes.

```json
{
  "wcagLevel": "wcag21aa",
  "urls": [
    { "url": "https://example.com/page1" },
    { "url": "https://example.com/page2", "login": { "..." } },
    "https://example.com/page3"
  ]
}
```

`wcagLevel` is optional and defaults to `wcag21aa`. Supported values are
`wcag2a`, `wcag2aa`, `wcag2aaa`, `wcag21a`, `wcag21aa`, `wcag21aaa`,
`wcag22a`, `wcag22aa`, and `wcag22aaa`.

Each line in the response is a JSON object with either `status: "done"` and
violations, or `status: "error"` with an error message.

## Deploy to Render

1. Push the `server.js`, `package.json`, and `Dockerfile` to a GitHub repo
2. Create a new **Web Service** on Render
3. Connect the GitHub repo
4. Set **Environment** to **Docker**
5. Set instance type to **Starter** ($7/mo, 2GB RAM recommended)
6. Render auto-detects the Dockerfile and deploys

Environment variables (optional):
- `PORT` — defaults to 3001 (Render sets this automatically)
- `MAX_CONCURRENT` — max simultaneous scans, defaults to 2

## Notes

- The Microsoft Playwright Docker image includes all Chromium dependencies
- Each scan launches a fresh browser context for isolation
- The batch endpoint reuses one browser instance across URLs for efficiency
- Login field matching uses Playwright's `getByLabel()` which finds inputs
  by associated `<label>` elements, `aria-label`, or `aria-labelledby` —
  same strategy Stark uses with "form labels"
