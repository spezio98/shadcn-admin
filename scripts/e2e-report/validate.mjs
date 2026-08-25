#!/usr/bin/env node
import { readFileSync } from "node:fs";

let Ajv, addFormats;
try {
  Ajv = (await import("ajv/dist/2020.js")).default;
  addFormats = (await import("ajv-formats")).default;
} catch {
  console.error("Manca una dipendenza. Installa con:\n\n  npm i -D ajv ajv-formats\n");
  console.error("Sono richieste solo da questo validatore: extract.mjs e render.mjs girano con Node puro.");
  process.exit(2);
}

const SCHEMA_PATH = new URL("./run-report.schema.json", import.meta.url);

const errors = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};

function validateSchema(data) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(JSON.parse(readFileSync(SCHEMA_PATH, "utf8")));
  if (!validate(data)) {
    for (const e of validate.errors) {
      errors.push(`schema ${e.instancePath || "/"}: ${e.message}`);
    }
    return false;
  }
  return true;
}

function validateStats({ stats, tests }) {
  const { total, passed, failed, flaky, skipped, passRate } = stats;

  check(
    total === passed + failed + flaky + skipped,
    `stats: total (${total}) non corrisponde alla somma degli stati (${passed + failed + flaky + skipped}). I flaky non vanno contati tra i passati.`
  );
  check(total === tests.length, `stats.total (${total}) diverso dal numero di test (${tests.length}).`);

  for (const status of ["passed", "failed", "flaky", "skipped"]) {
    const actual = tests.filter((t) => t.status === status).length;
    check(stats[status] === actual, `stats.${status} (${stats[status]}) diverso dai test con quello stato (${actual}).`);
  }

  const denominator = total - skipped;
  const expected = denominator === 0 ? 100 : Math.round((passed / denominator) * 1000) / 10;
  check(passRate === expected, `stats.passRate (${passRate}) diverso dal valore calcolato (${expected}).`);
}

function validateAreas({ areas, stats, tests }) {
  const ids = areas.map((a) => a.id);
  check(new Set(ids).size === ids.length, "areas: id duplicati.");

  const sum = (key) => areas.reduce((acc, a) => acc + a[key], 0);
  for (const key of ["total", "passed", "failed", "flaky", "skipped"]) {
    check(sum(key) === stats[key], `areas: somma di ${key} (${sum(key)}) diversa da stats.${key} (${stats[key]}).`);
  }

  for (const area of areas) {
    const own = tests.filter((t) => t.area === area.id);
    check(area.total === own.length, `area "${area.id}": total (${area.total}) diverso dai test dell'area (${own.length}).`);

    for (const status of ["passed", "failed", "flaky", "skipped"]) {
      const actual = own.filter((t) => t.status === status).length;
      check(area[status] === actual, `area "${area.id}": ${status} (${area[status]}) diverso dai test con quello stato (${actual}).`);
    }

    const expected = area.failed > 0 ? "broken" : area.flaky > 0 ? "degraded" : "ok";
    check(area.status === expected, `area "${area.id}": status "${area.status}" incoerente con i conteggi (atteso "${expected}").`);
  }

  for (const test of tests) {
    check(ids.includes(test.area), `test "${test.id}": area "${test.area}" non presente in areas[].`);
  }
}

function validateTests({ tests }) {
  const seen = new Set();

  for (const test of tests) {
    const where = `test "${test.id}" (${test.title})`;

    check(!seen.has(test.id), `${where}: id duplicato.`);
    seen.add(test.id);

    if (test.status === "passed" || test.status === "skipped") {
      check(test.error === null, `${where}: un test ${test.status} non deve avere un error.`);
      check(test.steps === null, `${where}: gli steps sono popolati solo per failed e flaky.`);
      check(test.failedStepIndex === null, `${where}: failedStepIndex deve essere null.`);
    }

    if (test.status === "failed" || test.status === "flaky") {
      check(test.error !== null, `${where}: un test ${test.status} deve avere un error.`);
      check(test.skipReason === null, `${where}: skipReason va valorizzato solo per gli skipped.`);
    }

    if (test.status === "skipped") {
      check(test.skipReason !== null, `${where}: uno skipped deve dichiarare skipReason.`);
      check(test.durationMs === 0, `${where}: uno skipped ha durata 0.`);
    }

    if (test.status === "flaky") {
      check(test.attempts >= 2, `${where}: un flaky ha almeno 2 tentativi, trovati ${test.attempts}.`);
      check(
        test.attachments.screenshot !== null || test.attachments.video !== null,
        `${where}: un flaky senza allegati non e utile. Verifica che l'extractor prenda quelli del tentativo fallito, non dell'ultimo.`
      );
    }

    if (test.steps === null) {
      check(test.failedStepIndex === null, `${where}: failedStepIndex valorizzato ma steps e null.`);
    } else {
      check(test.steps.length > 0, `${where}: steps e un array vuoto; usa null quando non ci sono step.`);
      test.steps.forEach((step, i) => {
        check(step.index === i, `${where}: step in posizione ${i} dichiara index ${step.index}.`);
      });

      const failedSteps = test.steps.filter((s) => s.status === "failed");
      check(failedSteps.length <= 1, `${where}: piu di uno step fallito (${failedSteps.length}).`);

      if (test.failedStepIndex !== null) {
        const step = test.steps[test.failedStepIndex];
        check(step !== undefined, `${where}: failedStepIndex ${test.failedStepIndex} fuori dai limiti di steps.`);
        check(
          step === undefined || step.status === "failed",
          `${where}: lo step indicato da failedStepIndex non ha status "failed".`
        );
      } else {
        check(failedSteps.length === 0, `${where}: c'e uno step fallito ma failedStepIndex e null.`);
      }
    }

    if (test.error !== null) {
      if (test.error.category === "unknown") {
        check(
          test.error.human === null,
          `${where}: con category "unknown" human deve essere null. Una frase generica e peggio del messaggio grezzo.`
        );
      }
      check(
        !/\u001b\[/.test(test.error.raw),
        `${where}: error.raw contiene codici di escape ANSI, vanno rimossi dall'extractor.`
      );
    }
  }
}

function validateOrdering({ areas, tests }) {
  const areaRank = { broken: 0, degraded: 1, ok: 2 };
  const areaKey = (a) => [areaRank[a.status], a.label];
  const areasSorted = [...areas].sort((x, y) => {
    const [rx, lx] = areaKey(x);
    const [ry, ly] = areaKey(y);
    return rx - ry || lx.localeCompare(ly, "it");
  });
  check(
    areas.every((a, i) => a.id === areasSorted[i].id),
    "areas: ordine errato. Atteso broken, degraded, ok; a parita di stato per label."
  );

  const labelById = Object.fromEntries(areas.map((a) => [a.id, a.label]));
  const testRank = { failed: 0, flaky: 1, skipped: 2, passed: 3 };
  const testsSorted = [...tests].sort(
    (x, y) =>
      testRank[x.status] - testRank[y.status] ||
      labelById[x.area].localeCompare(labelById[y.area], "it") ||
      x.title.localeCompare(y.title, "it")
  );
  check(
    tests.every((t, i) => t.id === testsSorted[i].id),
    "tests: ordine errato. Atteso failed, flaky, skipped, passed; a parita di stato per area e poi per titolo."
  );
}

function validateRun({ run }) {
  const elapsed = Date.parse(run.finishedAt) - Date.parse(run.startedAt);
  check(elapsed >= 0, "run: finishedAt precede startedAt.");
  check(
    Math.abs(elapsed - run.durationMs) <= 2000,
    `run: durationMs (${run.durationMs}) non coerente con l'intervallo startedAt/finishedAt (${elapsed}).`
  );
  check(
    run.commit.sha.startsWith(run.commit.shortSha),
    "run: shortSha non e un prefisso di sha."
  );
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Uso: node validate.mjs <run.json> [altri.json...]");
  process.exit(2);
}

let failedAny = false;

for (const file of files) {
  errors.length = 0;
  const data = JSON.parse(readFileSync(file, "utf8"));

  if (validateSchema(data)) {
    validateRun(data);
    validateStats(data);
    validateAreas(data);
    validateTests(data);
    validateOrdering(data);
  }

  if (errors.length === 0) {
    console.log(`OK  ${file}`);
  } else {
    failedAny = true;
    console.log(`KO  ${file}`);
    for (const e of errors) console.log(`    - ${e}`);
  }
}

process.exit(failedAny ? 1 : 0);
