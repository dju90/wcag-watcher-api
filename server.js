const express = require("express");
const cors = require("cors");
const { chromium } = require("playwright");
const { AxeBuilder } = require("@axe-core/playwright");

const app = express();
app.use(cors());
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
        // Try to find the input by its associated label text
        const input = page.getByLabel(field.label, { exact: false });
        try {
          await input.waitFor({ timeout: 5000 });
          await input.fill(field.value);
        } catch {
          // Fallback: try by placeholder
          const fallback = page.getByPlaceholder(field.label, { exact: false });
          try {
            await fallback.waitFor({ timeout: 3000 });
            await fallback.fill(field.value);
          } catch {
            console.warn(
              `Could not find field with label or placeholder: "${field.label}"`,
            );
          }
        }
      }

      // Submit the form — try common patterns
      const submitBtn = page.getByRole("button", {
        name: /sign in|log in|submit/i,
      });
      try {
        await submitBtn.waitFor({ timeout: 3000 });
        await submitBtn.click();
      } catch {
        // Fallback: press Enter on the last field
        await page.keyboard.press("Enter");
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
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    // Shape the response to match what the frontend expects
    const violations = results.violations.map((v) => ({
      ruleId: v.id,
      impact: v.impact,
      desc: v.description,
      help: v.helpUrl,
      tags: v.tags,
      nodes: v.nodes.map((n) => ({
        selector: n.target.join(" > "),
        html: n.html,
        failureSummary: n.failureSummary,
      })),
    }));

    res.json({
      url,
      timestamp: Date.now(),
      violations,
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      inapplicable: results.inapplicable.length,
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

  let browser;
  try {
    browser = await chromium.launch({ headless: true });

    for (const entry of urls) {
      const { url, login } = typeof entry === "string" ? { url: entry } : entry;
      activeScanCount++;

      try {
        const context = await browser.newContext({
          viewport: { width: 1280, height: 900 },
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
            const input = page.getByLabel(field.label, { exact: false });
            try {
              await input.waitFor({ timeout: 5000 });
              await input.fill(field.value);
            } catch {
              const fallback = page.getByPlaceholder(field.label, {
                exact: false,
              });
              try {
                await fallback.waitFor({ timeout: 3000 });
                await fallback.fill(field.value);
              } catch {
                console.warn(`Could not find field: "${field.label}"`);
              }
            }
          }
          const submitBtn = page.getByRole("button", {
            name: /sign in|log in|submit/i,
          });
          try {
            await submitBtn.waitFor({ timeout: 3000 });
            await submitBtn.click();
          } catch {
            await page.keyboard.press("Enter");
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

        const violations = results.violations.map((v) => ({
          ruleId: v.id,
          impact: v.impact,
          desc: v.description,
          help: v.helpUrl,
          tags: v.tags,
          nodes: v.nodes.map((n) => ({
            selector: n.target.join(" > "),
            html: n.html,
            failureSummary: n.failureSummary,
          })),
        }));

        res.write(
          JSON.stringify({
            url,
            timestamp: Date.now(),
            violations,
            passes: results.passes.length,
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
