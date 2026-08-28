#!/usr/bin/env node
// Reads run.json and prints a business-language markdown summary to stdout,
// intended for $GITHUB_STEP_SUMMARY. No computation here: stats and areas
// already arrive ready-made from extract.mjs (same principle as the renderer).
import { readFileSync } from "node:fs";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith("--")) pairs.push([arg.slice(2), all[i + 1]]);
    return pairs;
  }, [])
);

const runPath = args.run ?? "run.json";
const run = JSON.parse(readFileSync(runPath, "utf8"));
const { stats, areas, tests, run: meta } = run;

const escape = (s) => String(s).replace(/\|/g, "\\|");

const lines = [];
lines.push(`## E2E results — ${meta.environment.label} (${meta.commit.shortSha})`);
lines.push("");
lines.push(
  `**${stats.passed}/${stats.total - stats.skipped} passed (${stats.passRate}%)** — ` +
    `${stats.failed} failed, ${stats.flaky} flaky, ${stats.skipped} skipped`
);
lines.push("");
lines.push("| Area | Outcome | Passed | Failed | Flaky |");
lines.push("|---|---|---|---|---|");
for (const area of areas) {
  const icon = area.status === "ok" ? "✅" : area.status === "flaky" ? "⚠️" : "❌";
  lines.push(`| ${escape(area.label)} | ${icon} | ${area.passed} | ${area.failed} | ${area.flaky} |`);
}

const failedTests = tests.filter((t) => t.status === "failed" || t.status === "flaky");
if (failedTests.length > 0) {
  lines.push("");
  lines.push("### To review");
  for (const t of failedTests) {
    const areaLabel = areas.find((a) => a.id === t.area)?.label ?? t.area;
    const step = t.failedStepIndex != null ? ` — failed at step: ${t.steps[t.failedStepIndex].title}` : "";
    lines.push(`- **${escape(areaLabel)}** — ${escape(t.title)}${step}`);
  }
}

lines.push("");
lines.push("Full report (screenshots, videos, details) in the `report-business.html` artifact of this run.");

process.stdout.write(lines.join("\n") + "\n");
