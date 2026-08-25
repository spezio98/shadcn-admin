#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { relative, isAbsolute } from "node:path";

const SCHEMA_VERSION = 1;
const AREA_FALLBACK = "altro";

const ANSI = /\u001b\[[0-9;]*m/g;
const stripAnsi = (s) => String(s ?? "").replace(ANSI, "");

const warnings = [];
const warn = (m) => warnings.push(m);

/* ---------- argomenti ---------- */

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith("--")) throw new Error(`Argomento inatteso: ${argv[i]}`);
    args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const env = process.env;

const need = (value, name) => {
  if (value === undefined || value === "") throw new Error(`Manca ${name}.`);
  return value;
};

const options = {
  results: need(args.results, "--results"),
  aree: args.aree ?? "aree.json",
  steps: args.steps ?? null,
  out: need(args.out, "--out"),
  environmentId: args.env ?? env.RUN_ENVIRONMENT ?? "staging",
  suiteLabel: args["suite-label"] ?? env.RUN_SUITE_LABEL ?? "Tutti i test",
  timezone: args.timezone ?? env.RUN_TIMEZONE ?? "Europe/Rome",
  productionEnvIds: (args["production-envs"] ?? env.RUN_PRODUCTION_ENVS ?? "prod,production")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

/* ---------- identita stabile del test ---------- */

function testId(file, titlePath, projectName) {
  const key = [file, ...titlePath, projectName].join("\u0000");
  return createHash("sha1").update(key).digest("hex").slice(0, 8);
}

/* ---------- attraversamento delle suite ---------- */

function* walkSpecs(suite, isRoot, ancestors) {
  const titles = isRoot || !suite.title ? ancestors : [...ancestors, suite.title];
  for (const spec of suite.specs ?? []) yield { spec, titlePath: [...titles, spec.title] };
  for (const child of suite.suites ?? []) yield* walkSpecs(child, false, titles);
}

/* ---------- stato ---------- */

const STATUS_BY_OUTCOME = {
  expected: "passed",
  unexpected: "failed",
  flaky: "flaky",
  skipped: "skipped",
};

function resolveStatus(pwTest) {
  const mapped = STATUS_BY_OUTCOME[pwTest.status];
  if (mapped) return mapped;
  warn(`Esito Playwright non riconosciuto: "${pwTest.status}". Trattato come failed.`);
  return "failed";
}

/* ---------- area ---------- */

function resolveArea(spec, pwTest, knownAreas) {
  const raw = [
    ...(spec.tags ?? []),
    ...(pwTest.annotations ?? []).filter((a) => a.type === "tag").map((a) => a.description),
  ];
  const candidates = raw.map((t) => String(t).replace(/^@/, "").toLowerCase());
  const matches = candidates.filter((c) => knownAreas.has(c));

  if (matches.length > 1) {
    warn(`"${spec.title}" ha piu tag d'area (${matches.join(", ")}). Uso "${matches[0]}".`);
  }
  return matches[0] ?? AREA_FALLBACK;
}

/* ---------- errori ---------- */

const CATEGORY_RULES = [
  { category: "network", test: /ECONNREFUSED|ENOTFOUND|ECONNRESET|socket hang up|net::ERR_|apiRequest\.|\b[45]\d\d\s+[A-Z]/ },
  { category: "timeout", test: /Timeout\s+\d+ms exceeded|TimeoutError|Test timeout of \d+ms exceeded/ },
  { category: "elementNotFound", test: /not attached to the DOM|waiting for (locator|get[A-Z])|strict mode violation|resolved to 0 elements|element is not (visible|enabled|editable)/i },
  { category: "assertion", test: /expect\(|Expected:|Received:|toHave|toBe\b|assertion/i },
];

function categorize(raw) {
  for (const rule of CATEGORY_RULES) if (rule.test.test(raw)) return rule.category;
  return "unknown";
}

function humanize(category, raw) {
  switch (category) {
    case "timeout": {
      const ms = raw.match(/(\d+)ms exceeded/);
      const seconds = ms ? Math.round(Number(ms[1]) / 1000) : null;
      return seconds
        ? `La pagina non ha risposto entro ${seconds} secondi.`
        : "La pagina non ha risposto entro il tempo previsto.";
    }
    case "elementNotFound":
      return "Un elemento atteso non e comparso sulla pagina.";
    case "assertion":
      return "Il risultato ottenuto e diverso da quello atteso.";
    case "network":
      return "Il server ha risposto con un errore durante il test.";
    default:
      return null;
  }
}

function buildError(result, fallbackFile) {
  const source = result.error ?? result.errors?.[0];
  if (!source) return null;

  const raw = stripAnsi(source.message || source.stack || "").trim();
  if (!raw) return null;

  const category = categorize(raw);
  return {
    category,
    human: humanize(category, raw),
    raw,
    location: {
      file: source.location?.file ? toRepoPath(source.location.file) : fallbackFile,
      line: source.location?.line ?? 1,
    },
  };
}

/* ---------- step ---------- */

const HOOK_LABELS = [
  { test: /before/i, label: "Preparazione del test" },
  { test: /after/i, label: "Pulizia dopo il test" },
];

function hookLabel(title) {
  return HOOK_LABELS.find((h) => h.test.test(title))?.label ?? "Preparazione del test";
}

function buildSteps(rawSteps) {
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) return { steps: null, failedStepIndex: null };

  const failingHook = rawSteps.find((s) => s.category === "hook" && s.error);
  if (failingHook) {
    return {
      steps: [{ index: 0, title: hookLabel(failingHook.title), status: "failed", durationMs: Math.max(0, Math.round(failingHook.duration ?? 0)) }],
      failedStepIndex: 0,
    };
  }

  const visible = rawSteps.filter((s) => s.category === "test.step");
  if (visible.length === 0) return { steps: null, failedStepIndex: null };

  const failedAt = visible.findIndex((s) => Boolean(s.error));
  const steps = visible.map((s, index) => ({
    index,
    title: s.title,
    status: index === failedAt ? "failed" : "passed",
    durationMs: Math.max(0, Math.round(s.duration ?? 0)),
  }));

  return { steps, failedStepIndex: failedAt === -1 ? null : failedAt };
}

/* ---------- allegati ---------- */

function toRepoPath(p) {
  if (!p) return null;
  return isAbsolute(p) ? relative(process.cwd(), p) : p;
}

function buildAttachments(result) {
  const pick = (name) => {
    const found = (result?.attachments ?? []).find((a) => a.name === name && a.path);
    return found ? toRepoPath(found.path) : null;
  };
  return { screenshot: pick("screenshot"), video: pick("video"), trace: pick("trace") };
}

/* ---------- risultato rilevante ---------- */

function relevantResult(status, results) {
  if (!results?.length) return null;
  if (status === "flaky") {
    return results.find((r) => r.status !== "passed") ?? results[0];
  }
  if (status === "failed") return results[results.length - 1];
  return null;
}

/* ---------- lettura ---------- */

const report = JSON.parse(readFileSync(options.results, "utf8"));
const areaLabels = JSON.parse(readFileSync(options.aree, "utf8"));
const knownAreas = new Set(Object.keys(areaLabels));
if (!knownAreas.has(AREA_FALLBACK)) throw new Error(`aree.json deve contenere la voce "${AREA_FALLBACK}".`);

const externalSteps = options.steps ? JSON.parse(readFileSync(options.steps, "utf8")) : null;

/* ---------- costruzione dei test ---------- */

const tests = [];
const projectsSeen = new Set();
let interrupted = false;

for (const rootSuite of report.suites ?? []) {
  for (const { spec, titlePath } of walkSpecs(rootSuite, true, [])) {
    for (const pwTest of spec.tests ?? []) {
      const file = toRepoPath(spec.file ?? rootSuite.file ?? "");
      const projectName = pwTest.projectName ?? pwTest.projectId ?? "default";
      projectsSeen.add(projectName);

      const id = testId(file, titlePath, projectName);
      const status = resolveStatus(pwTest);
      const results = pwTest.results ?? [];

      if (results.some((r) => r.status === "interrupted")) interrupted = true;

      const chosen = relevantResult(status, results);
      const needsDetail = status === "failed" || status === "flaky";

      const rawSteps = chosen?.steps ?? (externalSteps ? externalSteps[id] : null);
      const { steps, failedStepIndex } = needsDetail ? buildSteps(rawSteps) : { steps: null, failedStepIndex: null };

      if (needsDetail && steps === null && rawSteps === undefined) {
        warn(`"${spec.title}": nessuno step disponibile. Il reporter JSON non li serializza: aggiungi steps-reporter.mjs e passa --steps.`);
      }

      const skipAnnotation = (pwTest.annotations ?? []).find((a) => a.type === "skip" || a.type === "fixme");

      tests.push({
        id,
        title: spec.title,
        file,
        area: resolveArea(spec, pwTest, knownAreas),
        status,
        durationMs: Math.max(0, Math.round(results.reduce((acc, r) => acc + (r.duration ?? 0), 0))),
        attempts: Math.max(1, results.length),
        skipReason:
          status === "skipped"
            ? skipAnnotation?.description ?? "Test escluso da questa esecuzione"
            : null,
        steps,
        failedStepIndex,
        error: needsDetail ? buildError(chosen, file) : null,
        attachments: needsDetail ? buildAttachments(chosen) : { screenshot: null, video: null, trace: null },
      });
    }
  }
}

if (projectsSeen.size > 1) {
  warn(`Il run copre piu progetti (${[...projectsSeen].join(", ")}): la pagina mostrera lo stesso titolo piu volte.`);
}

const duplicates = tests.map((t) => t.id).filter((id, i, all) => all.indexOf(id) !== i);
if (duplicates.length) throw new Error(`Id duplicati: ${[...new Set(duplicates)].join(", ")}.`);

/* ---------- aggregazioni ---------- */

const count = (list, status) => list.filter((t) => t.status === status).length;

const stats = {
  total: tests.length,
  passed: count(tests, "passed"),
  failed: count(tests, "failed"),
  flaky: count(tests, "flaky"),
  skipped: count(tests, "skipped"),
  passRate: 0,
  durationMs: Math.max(0, Math.round(report.stats?.duration ?? 0)),
};

const denominator = stats.total - stats.skipped;
stats.passRate = denominator === 0 ? 100 : Math.round((stats.passed / denominator) * 1000) / 10;

const usedAreas = [...new Set(tests.map((t) => t.area))];
const areas = usedAreas.map((id) => {
  const own = tests.filter((t) => t.area === id);
  const failed = count(own, "failed");
  const flaky = count(own, "flaky");
  return {
    id,
    label: areaLabels[id],
    total: own.length,
    passed: count(own, "passed"),
    failed,
    flaky,
    skipped: count(own, "skipped"),
    status: failed > 0 ? "broken" : flaky > 0 ? "degraded" : "ok",
  };
});

/* ---------- ordinamento ---------- */

const AREA_RANK = { broken: 0, degraded: 1, ok: 2 };
const TEST_RANK = { failed: 0, flaky: 1, skipped: 2, passed: 3 };

areas.sort((a, b) => AREA_RANK[a.status] - AREA_RANK[b.status] || a.label.localeCompare(b.label, "it"));

const labelById = Object.fromEntries(areas.map((a) => [a.id, a.label]));
tests.sort(
  (a, b) =>
    TEST_RANK[a.status] - TEST_RANK[b.status] ||
    labelById[a.area].localeCompare(labelById[b.area], "it") ||
    a.title.localeCompare(b.title, "it")
);

/* ---------- metadati del run ---------- */

const startedAt = report.stats?.startTime ?? new Date().toISOString();
const finishedAt = new Date(Date.parse(startedAt) + stats.durationMs).toISOString();
const sha = need(env.GITHUB_SHA ?? args.sha, "GITHUB_SHA");

const run = {
  id: env.GITHUB_RUN_ID ?? args["run-id"] ?? "locale",
  attempt: Number(env.GITHUB_RUN_ATTEMPT ?? args.attempt ?? 1),
  url:
    env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
      ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
      : args.url ?? "https://example.invalid/run-locale",
  status: interrupted ? "interrupted" : "completed",
  environment: {
    id: options.environmentId,
    label: options.environmentId.charAt(0).toUpperCase() + options.environmentId.slice(1),
    isProduction: options.productionEnvIds.includes(options.environmentId),
  },
  suiteLabel: options.suiteLabel,
  triggeredBy: env.GITHUB_ACTOR ?? args.actor ?? "sconosciuto",
  startedAt: new Date(Date.parse(startedAt)).toISOString(),
  finishedAt,
  durationMs: stats.durationMs,
  timezone: options.timezone,
  commit: {
    sha,
    shortSha: sha.slice(0, 7),
    branch: env.GITHUB_REF_NAME ?? args.branch ?? "sconosciuto",
    message: (env.COMMIT_MESSAGE ?? args["commit-message"] ?? "").split("\n")[0],
  },
};

/* ---------- scrittura ---------- */

writeFileSync(options.out, JSON.stringify({ schemaVersion: SCHEMA_VERSION, run, stats, areas, tests }, null, 2) + "\n");

console.log(`Scritto ${options.out}: ${stats.total} test, ${stats.failed} falliti, ${stats.flaky} instabili.`);
for (const w of warnings) console.warn(`  avviso: ${w}`);
if (run.status !== "completed") console.warn(`  avviso: run ${run.status}, le statistiche sono parziali.`);
