import { run, type AxeResults, type RunOptions } from "axe-core";

/**
 * Run axe over a rendered container and throw a readable failure.
 *
 * Deliberately not a custom matcher: this keeps the dependency surface to
 * axe-core itself, which tracks WCAG, instead of a matcher package that
 * tracks a test runner's internals and goes stale between major versions.
 *
 * Automated checks catch roughly a third of WCAG issues. A clean run here
 * means "no known violation of the rules axe can decide", not "accessible".
 */
const OPTIONS: RunOptions = {
  // ORB-106 targets WCAG 2.1 AA.
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
};

export async function expectNoA11yViolations(container: Element): Promise<void> {
  const results: AxeResults = await run(container, OPTIONS);
  if (results.violations.length === 0) return;

  const report = results.violations
    .map((violation) => {
      const where = violation.nodes
        .map((node) => `      ${node.html}`)
        .join("\n");
      return `  [${violation.impact ?? "unknown"}] ${violation.id}: ${violation.help}\n${where}\n      ${violation.helpUrl}`;
    })
    .join("\n\n");

  throw new Error(
    `axe found ${results.violations.length} accessibility violation(s):\n\n${report}`,
  );
}
