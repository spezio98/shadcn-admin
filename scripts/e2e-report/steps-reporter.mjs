import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { relative, isAbsolute } from "node:path";

/**
 * Single job: serialize result.steps, which the JSON reporter doesn't
 * guarantee. No normalization, no classification, no labeling: all that
 * logic lives in extract.mjs, where it's testable against fixtures without
 * running Playwright. If this file starts making decisions, it's in the
 * wrong place.
 *
 * playwright.config.ts:
 *   reporter: [
 *     ["json", { outputFile: "results.json" }],
 *     ["./scripts/steps-reporter.mjs", { outputFile: "steps.json" }],
 *     ["html", { open: "never" }],
 *   ]
 *
 * The key is the same hash computed by extract.mjs: file + titlePath + project.
 */
export default class StepsReporter {
  constructor(options = {}) {
    this.outputFile = options.outputFile ?? "steps.json";
    this.byTestId = {};
  }

  onTestEnd(test, result) {
    if (result.status === "passed" && result.retry === 0) return;

    // The JSON reporter (extract.mjs) receives spec paths relative to testDir,
    // not to cwd: replicate the same base here or the ids will never match.
    const testProject = test.parent?.project?.();
    const testDir = testProject?.testDir;
    const absFile = test.location.file;
    const file =
      testDir && isAbsolute(absFile)
        ? relative(testDir, absFile)
        : isAbsolute(absFile)
          ? relative(process.cwd(), absFile)
          : absFile;
    const project = testProject?.name ?? "default";
    const key = [file, ...test.titlePath().slice(3), project].join("\u0000");
    const id = createHash("sha1").update(key).digest("hex").slice(0, 8);

    const serialize = (step) => ({
      title: step.title,
      category: step.category,
      duration: step.duration,
      error: step.error ? { message: step.error.message } : undefined,
      steps: step.steps?.length ? step.steps.map(serialize) : undefined,
    });

    const existing = this.byTestId[id];
    if (existing && result.status === "passed") return;
    this.byTestId[id] = result.steps.map(serialize);
  }

  onEnd() {
    writeFileSync(this.outputFile, JSON.stringify(this.byTestId, null, 2) + "\n");
  }

  printsToStdio() {
    return false;
  }
}
