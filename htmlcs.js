const path = require("path");

const HTMLCS_PATH = path.join(
  __dirname,
  "node_modules",
  "html_codesniffer",
  "build",
  "HTMLCS.js",
);

// Inject HTML_CodeSniffer into the live Playwright page and collect its
// messages. Reuses the page that axe-core already scanned — no extra browser.
async function runHtmlCs(page, standard = "WCAG2AA", timeoutMs = 30000) {
  await page.addScriptTag({ path: HTMLCS_PATH });

  return page.evaluate(
    ([std, deadline]) => {
      // Build a stable-ish CSS selector for an element. Doesn't need to match
      // axe's selector exactly — reconciliation keys on outerHTML, not selector.
      function selectorFor(el) {
        if (!el || el.nodeType !== 1) return null;
        if (el === document.documentElement) return "html";
        if (el.id) return `#${CSS.escape(el.id)}`;
        const parts = [];
        let cur = el;
        while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
          let part = cur.tagName.toLowerCase();
          const parent = cur.parentNode;
          if (parent && parent.children) {
            const sameTag = Array.from(parent.children).filter(
              (s) => s.tagName === cur.tagName,
            );
            if (sameTag.length > 1) {
              part += `:nth-of-type(${sameTag.indexOf(cur) + 1})`;
            }
          }
          parts.unshift(part);
          cur = cur.parentNode;
        }
        return parts.join(" > ");
      }

      const TYPE = { 1: "error", 2: "warning", 3: "notice" };

      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("HTMLCS timed out")),
          deadline,
        );
        try {
          window.HTMLCS.process(std, window.document, () => {
            clearTimeout(timer);
            const raw = window.HTMLCS.getMessages() || [];
            resolve(
              raw.map((m) => ({
                code: m.code,
                type: TYPE[m.type] || "unknown",
                msg: m.msg,
                selector: selectorFor(m.element),
                html: m.element
                  ? (m.element.outerHTML || "").slice(0, 1000)
                  : null,
              })),
            );
          });
        } catch (err) {
          clearTimeout(timer);
          reject(err);
        }
      });
    },
    [standard, timeoutMs],
  );
}

module.exports = { runHtmlCs };
