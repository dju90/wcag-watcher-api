const path = require("path");

const ACE_PATH = path.join(
  __dirname,
  "node_modules",
  "accessibility-checker-engine",
  "ace-window.js",
);

// Inject IBM Equal Access into the live Playwright page and collect results.
// ace exposes `window.ace`; its `snippet` field is just the opening tag, so we
// resolve each finding's xpath back to its element to capture full outerHTML —
// keeping the reconciler's element-identity key consistent across engines.
async function runAce(
  page,
  policies = ["IBM_Accessibility"],
  timeoutMs = 60000,
) {
  await page.addScriptTag({ path: ACE_PATH });

  return page.evaluate(
    async ([pols, deadline]) => {
      function xpathToElement(xpath) {
        try {
          const r = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null,
          );
          return r.singleNodeValue;
        } catch {
          return null;
        }
      }

      // Derive a normalized "level" from ace's two-element value tuple.
      // The engine in this version doesn't populate result.level itself.
      function deriveLevel(value) {
        if (!value || value.length < 2) return "unknown";
        const [type, outcome] = value;
        if (outcome === "PASS") return "pass";
        if (outcome === "MANUAL") return "manual";
        if (type === "VIOLATION" && outcome === "FAIL") return "violation";
        if (type === "VIOLATION" && outcome === "POTENTIAL")
          return "potentialviolation";
        if (type === "RECOMMENDATION" && outcome === "FAIL")
          return "recommendation";
        if (type === "RECOMMENDATION" && outcome === "POTENTIAL")
          return "potentialrecommendation";
        if (type === "INFORMATION") return "information";
        return "unknown";
      }

      const checker = new window.ace.Checker();
      const checkPromise = checker.check(document, pols);
      const timeoutPromise = new Promise((_, rej) =>
        setTimeout(() => rej(new Error("ace timed out")), deadline),
      );
      const report = await Promise.race([checkPromise, timeoutPromise]);

      // Skip pass and ignored. Keep violations, potential issues, and
      // recommendations so the caller can see everything ace surfaced.
      return (report.results || [])
        .map((r) => ({
          ruleId: r.ruleId,
          reasonId: r.reasonId,
          level: deriveLevel(r.value),
          value: r.value,
          message: r.message,
          snippet: r.snippet,
          xpath: r.path && r.path.dom,
          ignored: !!r.ignored,
          _el: r.path && r.path.dom ? xpathToElement(r.path.dom) : null,
        }))
        .filter((r) => r.level !== "pass" && r.level !== "unknown" && !r.ignored)
        .map((r) => ({
          ruleId: r.ruleId,
          reasonId: r.reasonId,
          level: r.level,
          value: r.value,
          message: r.message,
          snippet: r.snippet,
          xpath: r.xpath,
          html: r._el ? (r._el.outerHTML || "").slice(0, 1000) : null,
        }));
    },
    [policies, timeoutMs],
  );
}

module.exports = { runAce };
