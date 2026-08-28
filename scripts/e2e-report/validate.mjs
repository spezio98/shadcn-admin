#!/usr/bin/env node
import { readFileSync } from "node:fs";

let Ajv, addFormats;
try {
  Ajv = (await import("ajv/dist/2020.js")).default;
  addFormats = (await import("ajv-formats")).default;
} catch {
  console.error("Missing dependency. Install with:\n\n  npm i -D ajv ajv-formats\n");
  console.error("Only this validator needs them: extract.mjs and render.mjs run on plain Node.");
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
    `stats: total (${total}) doesn't match the sum of statuses (${passed + failed + flaky + skipped}). Flaky tests must not be counted as passed.`
  );
  check(total === tests.length, `stats.total (${total}) differs from the number of tests (${tests.length}).`);

  for (const status of ["passed", "failed", "flaky", "skipped"]) {
    const actual = tests.filter((t) => t.status === status).length;
    check(stats[status] === actual, `stats.${status} (${stats[status]}) differs from tests with that status (${actual}).`);
  }

  const denominator = total - skipped;
  const expected = denominator === 0 ? 100 : Math.round((passed / denominator) * 1000) / 10;
  check(passRate === expected, `stats.passRate (${passRate}) differs from the computed value (${expected}).`);
}

function validateAreas({ areas, stats, tests }) {
  const ids = areas.map((a) => a.id);
  check(new Set(ids).size === ids.length, "areas: duplicate ids.");

  const sum = (key) => areas.reduce((acc, a) => acc + a[key], 0);
  for (const key of ["total", "passed", "failed", "flaky", "skipped"]) {
    check(sum(key) === stats[key], `areas: sum of ${key} (${sum(key)}) differs from stats.${key} (${stats[key]}).`);
  }

  for (const area of areas) {
    const own = tests.filter((t) => t.area === area.id);
    check(area.total === own.length, `area "${area.id}": total (${area.total}) differs from the area's tests (${own.length}).`);

    for (const status of ["passed", "failed", "flaky", "skipped"]) {
      const actual = own.filter((t) => t.status === status).length;
      check(area[status] === actual, `area "${area.id}": ${status} (${area[status]}) differs from tests with that status (${actual}).`);
    }

    const expected = area.failed > 0 ? "broken" : area.flaky > 0 ? "degraded" : "ok";
    check(area.status === expected, `area "${area.id}": status "${area.status}" inconsistent with the counts (expected "${expected}").`);
  }

  for (const test of tests) {
    check(ids.includes(test.area), `test "${test.id}": area "${test.area}" not present in areas[].`);
  }
}

function validateTests({ tests }) {
  const seen = new Set();

  for (const test of tests) {
    const where = `test "${test.id}" (${test.title})`;

    check(!seen.has(test.id), `${where}: duplicate id.`);
    seen.add(test.id);

    if (test.status === "passed" || test.status === "skipped") {
      check(test.error === null, `${where}: a ${test.status} test must not have an error.`);
      check(test.steps === null, `${where}: steps are only populated for failed and flaky.`);
      check(test.failedStepIndex === null, `${where}: failedStepIndex must be null.`);
    }

    if (test.status === "failed" || test.status === "flaky") {
      check(test.error !== null, `${where}: a ${test.status} test must have an error.`);
      check(test.skipReason === null, `${where}: skipReason should only be set for skipped.`);
    }

    if (test.status === "skipped") {
      check(test.skipReason !== null, `${where}: a skipped test must declare skipReason.`);
      check(test.durationMs === 0, `${where}: a skipped test has duration 0.`);
    }

    if (test.status === "flaky") {
      check(test.attempts >= 2, `${where}: a flaky test has at least 2 attempts, found ${test.attempts}.`);
      check(
        test.attachments.screenshot !== null || test.attachments.video !== null,
        `${where}: a flaky test without attachments isn't useful. Check that the extractor picks the failed attempt's attachments, not the last one's.`
      );
    }

    if (test.steps === null) {
      check(test.failedStepIndex === null, `${where}: failedStepIndex is set but steps is null.`);
    } else {
      check(test.steps.length > 0, `${where}: steps is an empty array; use null when there are no steps.`);
      test.steps.forEach((step, i) => {
        check(step.index === i, `${where}: step at position ${i} declares index ${step.index}.`);
      });

      const failedSteps = test.steps.filter((s) => s.status === "failed");
      check(failedSteps.length <= 1, `${where}: more than one failed step (${failedSteps.length}).`);

      if (test.failedStepIndex !== null) {
        const step = test.steps[test.failedStepIndex];
        check(step !== undefined, `${where}: failedStepIndex ${test.failedStepIndex} is out of bounds for steps.`);
        check(
          step === undefined || step.status === "failed",
          `${where}: the step referenced by failedStepIndex doesn't have status "failed".`
        );
      } else {
        check(failedSteps.length === 0, `${where}: there is a failed step but failedStepIndex is null.`);
      }
    }

    if (test.error !== null) {
      if (test.error.category === "unknown") {
        check(
          test.error.human === null,
          `${where}: with category "unknown", human must be null. A generic sentence is worse than the raw message.`
        );
      }
      check(
        !/\u001b\[/.test(test.error.raw),
        `${where}: error.raw contains ANSI escape codes, the extractor must strip them.`
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
    return rx - ry || lx.localeCompare(ly, "en");
  });
  check(
    areas.every((a, i) => a.id === areasSorted[i].id),
    "areas: wrong order. Expected broken, degraded, ok; ties broken by label."
  );

  const labelById = Object.fromEntries(areas.map((a) => [a.id, a.label]));
  const testRank = { failed: 0, flaky: 1, skipped: 2, passed: 3 };
  const testsSorted = [...tests].sort(
    (x, y) =>
      testRank[x.status] - testRank[y.status] ||
      labelById[x.area].localeCompare(labelById[y.area], "en") ||
      x.title.localeCompare(y.title, "en")
  );
  check(
    tests.every((t, i) => t.id === testsSorted[i].id),
    "tests: wrong order. Expected failed, flaky, skipped, passed; ties broken by area then by title."
  );
}

function validateRun({ run }) {
  const elapsed = Date.parse(run.finishedAt) - Date.parse(run.startedAt);
  check(elapsed >= 0, "run: finishedAt precedes startedAt.");
  check(
    Math.abs(elapsed - run.durationMs) <= 2000,
    `run: durationMs (${run.durationMs}) inconsistent with the startedAt/finishedAt interval (${elapsed}).`
  );
  check(
    run.commit.sha.startsWith(run.commit.shortSha),
    "run: shortSha is not a prefix of sha."
  );
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node validate.mjs <run.json> [other.json...]");
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
