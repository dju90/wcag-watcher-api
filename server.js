const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");

const app = express();
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);
app.options("*", cors({ origin: "*" }));
app.use(express.json());

const PORT = process.env.PORT || 3001;
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || "1", 10);
const PAGE_SETTLE_TIMEOUT = parseInt(
  process.env.PAGE_SETTLE_TIMEOUT || "15000",
  10,
);
let activeScanCount = 0;

const BROWSER_ARGS = [
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--disable-extensions",
  "--no-sandbox",
  "--js-flags=--max-old-space-size=256",
];

const VIEWPORT = { width: 1024, height: 728 };

// Wait for page to be reasonably ready
async function waitForPageReady(page, timeout = PAGE_SETTLE_TIMEOUT) {
  await page.waitForLoadState("load", { timeout }).catch(() => {});
  await page
    .waitForLoadState("networkidle", { timeout: Math.min(timeout, 10000) })
    .catch(() => {});
  // Wait for DOM to stabilize
  await page.evaluate(
    (maxWait) => {
      return new Promise((resolve) => {
        let lastHTML = "";
        let stableCount = 0;
        const interval = setInterval(() => {
          const currentHTML = document.body?.innerHTML || "";
          if (currentHTML === lastHTML) {
            stableCount++;
            if (stableCount >= 3) {
              clearInterval(interval);
              resolve();
            }
          } else {
            stableCount = 0;
            lastHTML = currentHTML;
          }
        }, 500);
        setTimeout(() => {
          clearInterval(interval);
          resolve();
        }, maxWait);
      });
    },
    Math.min(timeout, 10000),
  );
}

// Perform login and return session cookies, then close the login context
async function getAuthCookies(browser, login) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  try {
    await page.goto(login.loginUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await waitForPageReady(page);

    // Fill in login fields
    for (const field of login.fields) {
      let filled = false;
      // Try by id
      if (!filled) {
        try {
          const el = page.locator(`#${field.label}`);
          await el.waitFor({ timeout: 3000 });
          await el.fill(field.value);
          filled = true;
        } catch {}
      }
      // Try by name
      if (!filled) {
        try {
          const el = page.locator(`[name="${field.label}"]`);
          await el.waitFor({ timeout: 3000 });
          await el.fill(field.value);
          filled = true;
        } catch {}
      }
      // Try by label text
      if (!filled) {
        try {
          const el = page.getByLabel(field.label, { exact: false });
          await el.waitFor({ timeout: 3000 });
          await el.fill(field.value);
          filled = true;
        } catch {}
      }
      // Try by placeholder
      if (!filled) {
        try {
          const el = page.getByPlaceholder(field.label, { exact: false });
          await el.waitFor({ timeout: 3000 });
          await el.fill(field.value);
          filled = true;
        } catch {}
      }
      if (!filled) {
        console.warn(`Could not find field: "${field.label}"`);
      }
    }

    // Submit the form
    if (login.submitSelector) {
      const submitBtn = page.locator(`#${login.submitSelector}`);
      try {
        await submitBtn.waitFor({ timeout: 3000 });
        await submitBtn.click();
      } catch {
        const namedBtn = page.getByRole("button", {
          name: new RegExp(login.submitSelector, "i"),
        });
        try {
          await namedBtn.waitFor({ timeout: 3000 });
          await namedBtn.click();
        } catch {
          await page.keyboard.press("Enter");
        }
      }
    } else {
      const submitBtn = page.getByRole("button", {
        name: /sign in|log in|submit/i,
      });
      try {
        await submitBtn.waitFor({ timeout: 3000 });
        await submitBtn.click();
      } catch {
        await page.keyboard.press("Enter");
      }
    }

    // Wait for login to complete
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
    await waitForPageReady(page);

    // Capture cookies
    const cookies = await context.cookies();
    return cookies;
  } finally {
    // Always close the login context to free memory
    await context.close();
  }
}

const shapeNodes = (nodes) =>
  nodes.map((n) => ({
    selector: n.target.join(" > "),
    html: n.html,
    failureSummary: n.failureSummary,
  }));

const shapeResults = (v) => ({
  ruleId: v.id,
  impact: v.impact,
  desc: v.description,
  help: v.helpUrl,
  tags: v.tags,
  nodes: shapeNodes(v.nodes),
});

// Scan a single page in its own context, with optional pre-set cookies
async function scanPage(browser, url, cookies) {
  const context = await browser.newContext({ viewport: VIEWPORT });

  if (cookies && cookies.length > 0) {
    await context.addCookies(cookies);
  }

  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForPageReady(page);

    // Reveal hidden elements
    await page.evaluate(() => {
      document
        .querySelectorAll("[aria-hidden=true], [hidden]")
        .forEach((el) => {
          el.removeAttribute("aria-hidden");
          el.removeAttribute("hidden");
        });
    });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const violations = results.violations.map(shapeResults);
    const incomplete = results.incomplete.map(shapeResults);

    return {
      url,
      timestamp: Date.now(),
      violations,
      incomplete,
      passes: results.passes.length,
      status: "done",
    };
  } finally {
    await context.close();
  }
}

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", activeScans: activeScanCount });
});

// Single scan endpoint
app.post("/scan", async (req, res) => {
  const { url, login } = req.body;

  if (!url) {
    return res.status(400).json({ error: "url is required" });
  }

  if (activeScanCount >= MAX_CONCURRENT) {
    return res
      .status(429)
      .json({ error: "Too many scans in progress. Try again shortly." });
  }

  activeScanCount++;
  let browser;

  try {
    browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });

    // If login is configured, authenticate and get cookies first
    let cookies = null;
    if (login?.loginUrl && login.fields?.length > 0) {
      cookies = await getAuthCookies(browser, login);
    }

    // Scan the target page in a fresh context
    const result = await scanPage(browser, url, cookies);
    res.json(result);
  } catch (err) {
    console.error(`Scan failed for ${url}:`, err.message);
    res.status(500).json({ error: "Scan failed", message: err.message });
  } finally {
    if (browser) await browser.close();
    activeScanCount--;
  }
});

// Batch scan endpoint
app.post("/scan/batch", async (req, res) => {
  const { urls } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: "urls array is required" });
  }

  if (urls.length > 20) {
    return res.status(400).json({ error: "Maximum 20 URLs per batch" });
  }

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Access-Control-Allow-Origin", "*");

  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });

    // Group URLs by login config so we only authenticate once per set of credentials
    const loginCache = new Map();

    for (const entry of urls) {
      const { url, login } = typeof entry === "string" ? { url: entry } : entry;
      activeScanCount++;

      try {
        // Get or cache cookies for this login config
        let cookies = null;
        if (login?.loginUrl && login.fields?.length > 0) {
          const loginKey = JSON.stringify(login);
          if (loginCache.has(loginKey)) {
            cookies = loginCache.get(loginKey);
          } else {
            cookies = await getAuthCookies(browser, login);
            loginCache.set(loginKey, cookies);
          }
        }

        // Scan in a fresh context (login context is already closed)
        const result = await scanPage(browser, url, cookies);

        res.write(JSON.stringify(result) + "\n");
      } catch (err) {
        res.write(
          JSON.stringify({ url, status: "error", error: err.message }) + "\n",
        );
      } finally {
        activeScanCount--;
      }
    }
  } catch (err) {
    res.write(JSON.stringify({ status: "error", error: err.message }) + "\n");
  } finally {
    if (browser) await browser.close();
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`A11y Scanner API running on port ${PORT}`);
});
