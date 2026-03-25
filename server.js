const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");

const app = express();
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  }),
);

// Explicit preflight handler as safety net
app.options("*", cors());

app.use(express.json());

const PORT = process.env.PORT || 3001;
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || "2", 10);
const PAGE_SETTLE_TIMEOUT = parseInt(
  process.env.PAGE_SETTLE_TIMEOUT || "15000",
  10,
);
let activeScanCount = 0;

// Waits for the page to be meaningfully rendered:
// 1. Wait for 'load' event (all resources fetched)
// 2. Wait until network has been quiet for 2s, or bail after timeout
// 3. Wait until the DOM has stopped changing for 1s
async function waitForPageReady(page, timeout = PAGE_SETTLE_TIMEOUT) {
  // Step 1: wait for load event
  await page.waitForLoadState("load", { timeout }).catch(() => {});

  // Step 2: wait for network to settle (no requests for 2s)
  await page
    .waitForLoadState("networkidle", { timeout: Math.min(timeout, 10000) })
    .catch(() => {});

  // Step 3: wait for DOM to stabilize — poll until body content stops changing
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

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", activeScans: activeScanCount });
});

// Main scan endpoint
app.post("/scan", async (req, res) => {
  const { url, login } = req.body;

  if (!url) {
    return res.status(400).json({ error: "url is required" });
  }

  if (activeScanCount >= MAX_CONCURRENT) {
    return res.status(429).json({
      error: "Too many scans in progress. Try again shortly.",
    });
  }

  activeScanCount++;
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1024, height: 728 },
      userAgent:
        "Mozilla/5.0 (A11yMonitor Scanner) AppleWebKit/537.36 Chrome/120.0.0.0",
    });
    const page = await context.newPage();

    // Handle login if configured
    if (login?.loginUrl && login.fields?.length > 0) {
      await page.goto(login.loginUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await waitForPageReady(page);

      for (const field of login.fields) {
        // Try to find the input by id or name first, then by label, then placeholder
        let filled = false;

        // Try by id
        try {
          const byId = page.locator(`#${field.label}`);
          await byId.waitFor({ timeout: 3000 });
          await byId.fill(field.value);
          filled = true;
        } catch {}

        // Try by name attribute
        if (!filled) {
          try {
            const byName = page.locator(`[name="${field.label}"]`);
            await byName.waitFor({ timeout: 3000 });
            await byName.fill(field.value);
            filled = true;
          } catch {}
        }

        // Try by associated label text
        if (!filled) {
          try {
            const byLabel = page.getByLabel(field.label, { exact: false });
            await byLabel.waitFor({ timeout: 3000 });
            await byLabel.fill(field.value);
            filled = true;
          } catch {}
        }

        // Try by placeholder
        if (!filled) {
          try {
            const byPlaceholder = page.getByPlaceholder(field.label, {
              exact: false,
            });
            await byPlaceholder.waitFor({ timeout: 3000 });
            await byPlaceholder.fill(field.value);
            filled = true;
          } catch {}
        }

        if (!filled) {
          console.warn(`Could not find field: "${field.label}"`);
        }
      }

      // Submit the form — use custom selector if provided, else try common patterns
      if (login.submitSelector) {
        const submitBtn = page.locator(`#${login.submitSelector}`);
        try {
          await submitBtn.waitFor({ timeout: 3000 });
          await submitBtn.click();
        } catch {
          // Fallback: try as button name
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

      // Wait for navigation after login
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      await waitForPageReady(page);
    }

    // Navigate to the target URL and wait for content to render
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForPageReady(page);

    // Capture screenshot as base64 for debugging
    const screenshotBuffer = await page.screenshot({ fullPage: false });
    const screenshot = screenshotBuffer.toString("base64");

    // Run axe-core scan targeting WCAG 2.1 A and AA
    // Include hidden elements in the scan and request incomplete results
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .options({
        resultTypes: ["violations", "incomplete"],
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
        checks: {
          "hidden-content": { enabled: false },
        },
      })
      .analyze();

    // Also inject a secondary scan with includeHidden
    // axe-core doesn't have a direct "includeHidden" flag, but we can
    // override the default by scanning with all elements visible.
    // Instead, run axe directly for full control over hidden elements:
    const hiddenResults = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Remove aria-hidden and hidden attributes temporarily for scanning
        const hiddenEls = [];
        document
          .querySelectorAll("[aria-hidden=true], [hidden]")
          .forEach((el) => {
            hiddenEls.push({
              el,
              ariaHidden: el.getAttribute("aria-hidden"),
              hidden: el.getAttribute("hidden"),
            });
            el.removeAttribute("aria-hidden");
            el.removeAttribute("hidden");
          });

        // Also make display:none elements visible temporarily
        const displayNoneEls = [];
        document.querySelectorAll("*").forEach((el) => {
          const style = window.getComputedStyle(el);
          if (style.display === "none" || style.visibility === "hidden") {
            displayNoneEls.push({
              el,
              display: el.style.display,
              visibility: el.style.visibility,
            });
            if (style.display === "none") el.style.display = "block";
            if (style.visibility === "hidden") el.style.visibility = "visible";
          }
        });

        resolve({ unhiddenCount: hiddenEls.length + displayNoneEls.length });

        // Note: we don't restore because we're about to run axe on
        // the revealed state — the page context is discarded after scan
      });
    });

    // Run a second axe scan now that hidden elements are revealed
    const revealedResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    // Merge: use revealed scan for violations, combine incomplete from both
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

    // Deduplicate by ruleId, preferring the version with more nodes
    const mergeByRule = (listA, listB) => {
      const map = new Map();
      for (const v of listA) map.set(v.id, v);
      for (const v of listB) {
        const existing = map.get(v.id);
        if (!existing || v.nodes.length > existing.nodes.length) {
          map.set(v.id, v);
        }
      }
      return [...map.values()];
    };

    const mergedViolations = mergeByRule(
      results.violations,
      revealedResults.violations,
    );
    const mergedIncomplete = mergeByRule(
      results.incomplete,
      revealedResults.incomplete,
    );

    const violations = mergedViolations.map(shapeResults);
    const incomplete = mergedIncomplete.map(shapeResults);

    res.json({
      url,
      timestamp: Date.now(),
      violations,
      incomplete,
      passes: revealedResults.passes.length,
      inapplicable: revealedResults.inapplicable.length,
      screenshot,
    });
  } catch (err) {
    console.error(`Scan failed for ${url}:`, err.message);
    res.status(500).json({
      error: "Scan failed",
      message: err.message,
    });
  } finally {
    if (browser) await browser.close();
    activeScanCount--;
  }
});

// Batch scan endpoint — scans multiple URLs sequentially
app.post("/scan/batch", async (req, res) => {
  const { urls } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: "urls array is required" });
  }

  if (urls.length > 20) {
    return res.status(400).json({ error: "Maximum 20 URLs per batch" });
  }

  // Stream results back as newline-delimited JSON so the frontend
  // can show progress as each URL completes
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Access-Control-Allow-Origin", "*");

  let browser;
  try {
    browser = await chromium.launch({ headless: true });

    for (const entry of urls) {
      const { url, login } = typeof entry === "string" ? { url: entry } : entry;
      activeScanCount++;

      try {
        const context = await browser.newContext({
          viewport: { width: 1024, height: 728 },
        });
        const page = await context.newPage();

        // Handle login if configured
        if (login?.loginUrl && login.fields?.length > 0) {
          await page.goto(login.loginUrl, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
          await waitForPageReady(page);
          for (const field of login.fields) {
            let filled = false;
            try {
              const byId = page.locator(`#${field.label}`);
              await byId.waitFor({ timeout: 3000 });
              await byId.fill(field.value);
              filled = true;
            } catch {}
            if (!filled) {
              try {
                const byName = page.locator(`[name="${field.label}"]`);
                await byName.waitFor({ timeout: 3000 });
                await byName.fill(field.value);
                filled = true;
              } catch {}
            }
            if (!filled) {
              try {
                const byLabel = page.getByLabel(field.label, { exact: false });
                await byLabel.waitFor({ timeout: 3000 });
                await byLabel.fill(field.value);
                filled = true;
              } catch {}
            }
            if (!filled) {
              try {
                const byPlaceholder = page.getByPlaceholder(field.label, {
                  exact: false,
                });
                await byPlaceholder.waitFor({ timeout: 3000 });
                await byPlaceholder.fill(field.value);
                filled = true;
              } catch {}
            }
            if (!filled) {
              console.warn(`Could not find field: "${field.label}"`);
            }
          }
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
          await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
          await waitForPageReady(page);
        }

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await waitForPageReady(page);

        // Capture screenshot as base64 for debugging
        const screenshotBuffer = await page.screenshot({ fullPage: false });
        const screenshot = screenshotBuffer.toString("base64");

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        // Reveal hidden elements for a more thorough scan
        await page.evaluate(() => {
          document
            .querySelectorAll("[aria-hidden=true], [hidden]")
            .forEach((el) => {
              el.removeAttribute("aria-hidden");
              el.removeAttribute("hidden");
            });
          document.querySelectorAll("*").forEach((el) => {
            const style = window.getComputedStyle(el);
            if (style.display === "none") el.style.display = "block";
            if (style.visibility === "hidden") el.style.visibility = "visible";
          });
        });

        const revealedResults = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

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

        const mergeByRule = (listA, listB) => {
          const map = new Map();
          for (const v of listA) map.set(v.id, v);
          for (const v of listB) {
            const existing = map.get(v.id);
            if (!existing || v.nodes.length > existing.nodes.length) {
              map.set(v.id, v);
            }
          }
          return [...map.values()];
        };

        const violations = mergeByRule(
          results.violations,
          revealedResults.violations,
        ).map(shapeResults);
        const incomplete = mergeByRule(
          results.incomplete,
          revealedResults.incomplete,
        ).map(shapeResults);

        res.write(
          JSON.stringify({
            url,
            timestamp: Date.now(),
            violations,
            incomplete,
            passes: revealedResults.passes.length,
            status: "done",
            screenshot,
          }) + "\n",
        );

        await context.close();
      } catch (err) {
        res.write(
          JSON.stringify({
            url,
            status: "error",
            error: err.message,
          }) + "\n",
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
