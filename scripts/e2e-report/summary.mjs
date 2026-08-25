#!/usr/bin/env node
// Legge run.json e stampa su stdout un riepilogo markdown in linguaggio di
// business, pensato per $GITHUB_STEP_SUMMARY. Nessun calcolo qui: stats e
// areas arrivano già pronti da extract.mjs (stesso principio del renderer).
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
lines.push(`## Risultati e2e — ${meta.environment.label} (${meta.commit.shortSha})`);
lines.push("");
lines.push(
  `**${stats.passed}/${stats.total - stats.skipped} passati (${stats.passRate}%)** — ` +
    `${stats.failed} falliti, ${stats.flaky} instabili, ${stats.skipped} saltati`
);
lines.push("");
lines.push("| Area | Esito | Passati | Falliti | Instabili |");
lines.push("|---|---|---|---|---|");
for (const area of areas) {
  const icon = area.status === "ok" ? "✅" : area.status === "flaky" ? "⚠️" : "❌";
  lines.push(`| ${escape(area.label)} | ${icon} | ${area.passed} | ${area.failed} | ${area.flaky} |`);
}

const failedTests = tests.filter((t) => t.status === "failed" || t.status === "flaky");
if (failedTests.length > 0) {
  lines.push("");
  lines.push("### Da verificare");
  for (const t of failedTests) {
    const areaLabel = areas.find((a) => a.id === t.area)?.label ?? t.area;
    const step = t.failedStepIndex != null ? ` — fallito al passo: ${t.steps[t.failedStepIndex].title}` : "";
    lines.push(`- **${escape(areaLabel)}** — ${escape(t.title)}${step}`);
  }
}

lines.push("");
lines.push("Report completo (screenshot, video, dettagli) nell'artifact `report-business.html` di questo run.");

process.stdout.write(lines.join("\n") + "\n");
