import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { relative, isAbsolute } from "node:path";

/**
 * Unico compito: serializzare result.steps, che il reporter JSON non garantisce.
 * Nessuna normalizzazione, nessuna classificazione, nessuna etichetta: tutta la
 * logica sta in extract.mjs, dove e testabile contro le fixture senza far girare
 * Playwright. Se questo file inizia a prendere decisioni, e nel posto sbagliato.
 *
 * playwright.config.ts:
 *   reporter: [
 *     ["json", { outputFile: "results.json" }],
 *     ["./scripts/steps-reporter.mjs", { outputFile: "steps.json" }],
 *     ["html", { open: "never" }],
 *   ]
 *
 * La chiave e lo stesso hash calcolato da extract.mjs: file + titlePath + progetto.
 */
export default class StepsReporter {
  constructor(options = {}) {
    this.outputFile = options.outputFile ?? "steps.json";
    this.byTestId = {};
  }

  onTestEnd(test, result) {
    if (result.status === "passed" && result.retry === 0) return;

    const file = isAbsolute(test.location.file) ? relative(process.cwd(), test.location.file) : test.location.file;
    const project = test.parent?.project?.()?.name ?? "default";
    const key = [file, ...test.titlePath().slice(1), project].join("\u0000");
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
