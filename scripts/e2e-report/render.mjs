#!/usr/bin/env node
import { readFileSync, writeFileSync, statSync } from "node:fs";

const SUPPORTED_SCHEMA = 1;

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
};

const warnings = [];
const warn = (m) => warnings.push(m);

/* ---------- arguments ---------- */

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, "")] = argv[i + 1];
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.run || !args.out) {
  console.error("Usage: node render.mjs --run run.json --out report-business.html [--max-video 10] [--budget-mb 40]");
  process.exit(2);
}

const maxVideos = Number(args["max-video"] ?? 10);
const budgetBytes = Number(args["budget-mb"] ?? 40) * 1024 * 1024;

/* ---------- utilities ---------- */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

const jsonForScript = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

function formatDateTime(iso, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short", timeZone }).format(new Date(iso));
  } catch {
    warn(`Unrecognized timezone "${timeZone}", using UTC.`);
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso));
  }
}

function formatDuration(ms) {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* ---------- inlining attachments ---------- */

let spent = 0;
let videosInlined = 0;

function inlineFile(path, { isVideo }) {
  if (!path) return null;

  let size;
  try {
    size = statSync(path).size;
  } catch {
    warn(`Attachment not found, skipping: ${path}`);
    return null;
  }

  if (isVideo && videosInlined >= maxVideos) {
    warn(`Exceeded the limit of ${maxVideos} videos: ${path} not included.`);
    return null;
  }

  const encoded = Math.ceil((size * 4) / 3);
  if (spent + encoded > budgetBytes) {
    warn(`Exhausted the ${Math.round(budgetBytes / 1024 / 1024)} MB budget: ${path} not included.`);
    return null;
  }

  const extension = path.slice(path.lastIndexOf(".")).toLowerCase();
  const mime = MIME[extension];
  if (!mime) {
    warn(`Unhandled extension, skipping: ${path}`);
    return null;
  }

  spent += encoded;
  if (isVideo) videosInlined += 1;
  return `data:${mime};base64,${readFileSync(path).toString("base64")}`;
}

/* ---------- read ---------- */

const data = JSON.parse(readFileSync(args.run, "utf8"));
if (data.schemaVersion !== SUPPORTED_SCHEMA) {
  console.error(`schemaVersion ${data.schemaVersion} is not supported by this renderer (expected ${SUPPORTED_SCHEMA}).`);
  process.exit(1);
}

const { run, stats, areas, tests } = data;
const labelByArea = Object.fromEntries(areas.map((a) => [a.id, a.label]));
const byStatus = (s) => tests.filter((t) => t.status === s);

/* ---------- fragments ---------- */

function renderSteps(test) {
  if (!test.steps) return "";
  const items = test.steps
    .map((step) => {
      const failed = step.index === test.failedStepIndex;
      const marker = failed ? "&#10005;" : "&#10003;";
      return `<li class="step ${failed ? "step-ko" : "step-ok"}"><span class="marker">${marker}</span>${esc(step.title)}</li>`;
    })
    .join("");
  return `<ol class="steps">${items}<li class="step step-stop">Execution stopped here</li></ol>`;
}

function renderMedia(test) {
  const screenshot = inlineFile(test.attachments.screenshot, { isVideo: false });
  const video = inlineFile(test.attachments.video, { isVideo: true });
  if (!screenshot && !video) return "";

  const left = screenshot
    ? `<figure class="media"><img src="${screenshot}" alt="Screenshot at the moment of the error: ${esc(test.title)}" data-zoom><figcaption>Screenshot at the moment of the error &mdash; click to zoom</figcaption></figure>`
    : "";

  const right = video
    ? `<figure class="media"><video controls preload="metadata" src="${video}"></video><figcaption>Flow video &mdash; the issue shows up in the last few seconds</figcaption></figure>`
    : "";

  return `<div class="media-grid">${left}${right}</div>`;
}

function renderError(test) {
  if (!test.error) return "";
  const human = test.error.human
    ? `<p class="error-human">${esc(test.error.human)}</p>`
    : `<p class="error-human error-human-missing">Error not attributable to a known cause. Technical detail below.</p>`;

  return `${human}
      <details class="technical">
        <summary>Technical details</summary>
        <pre>${esc(test.error.raw)}</pre>
        <p class="technical-meta">${esc(test.error.location.file)}, line ${test.error.location.line}</p>
      </details>`;
}

function renderTestCard(test, tone) {
  const stepTitle = test.steps && test.failedStepIndex !== null ? test.steps[test.failedStepIndex].title : null;

  return `<article class="card card-${tone}">
      <div class="card-head">
        <span class="pill pill-${tone}">${esc(labelByArea[test.area])}</span>
        ${test.attempts > 1 ? `<span class="pill pill-neutral">${plural(test.attempts, "attempt", "attempts")}</span>` : ""}
        <span class="duration">${formatDuration(test.durationMs)}</span>
      </div>
      <h3>${esc(test.title)}</h3>
      ${stepTitle ? `<p class="step-line">Failed at step: <strong>${esc(stepTitle)}</strong></p>` : ""}
      ${renderError(test)}
      ${renderSteps(test)}
      ${renderMedia(test)}
      <div class="card-foot">
        <button type="button" class="copy" data-test-id="${test.id}">Copy report</button>
      </div>
    </article>`;
}

function renderSection(title, note, list, tone) {
  if (list.length === 0) return "";
  return `<section>
      <h2>${esc(title)}</h2>
      ${note ? `<p class="note">${esc(note)}</p>` : ""}
      ${list.map((t) => renderTestCard(t, tone)).join("\n")}
    </section>`;
}

function renderPassed() {
  const passed = byStatus("passed");
  const skipped = byStatus("skipped");
  if (passed.length === 0 && skipped.length === 0) return "";

  const groups = areas
    .map((area) => {
      const own = passed.filter((t) => t.area === area.id);
      if (own.length === 0) return "";
      return `<h4>${esc(area.label)}</h4><ul class="list">${own.map((t) => `<li>${esc(t.title)}</li>`).join("")}</ul>`;
    })
    .join("");

  const skippedBlock = skipped.length
    ? `<h4>Not run</h4><ul class="list">${skipped
        .map((t) => `<li>${esc(t.title)} <span class="reason">${esc(t.skipReason)}</span></li>`)
        .join("")}</ul>`
    : "";

  return `<section>
      <details>
        <summary><span class="summary-title">${plural(passed.length, "test passed", "tests passed")}${
          skipped.length ? ` &middot; ${plural(skipped.length, "not run", "not run")}` : ""
        }</span></summary>
        ${groups}${skippedBlock}
      </details>
    </section>`;
}

/* ---------- copyable report text ---------- */

const reports = Object.fromEntries(
  tests
    .filter((t) => t.status === "failed" || t.status === "flaky")
    .map((t) => {
      const stepTitle = t.steps && t.failedStepIndex !== null ? t.steps[t.failedStepIndex].title : "not available";
      return [
        t.id,
        [
          `Test: ${t.title}`,
          `Outcome: ${t.status === "flaky" ? "flaky (passed only on the second attempt)" : "failed"}`,
          `Area: ${labelByArea[t.area]}`,
          `Environment: ${run.environment.label}`,
          `Failed step: ${stepTitle}`,
          `Error: ${t.error?.human ?? t.error?.raw.split("\n")[0] ?? "not available"}`,
          `Date: ${formatDateTime(run.startedAt, run.timezone)}`,
          `Commit: ${run.commit.shortSha} (${run.commit.branch})`,
          `Run: ${run.url}`,
        ].join("\n"),
      ];
    })
);

/* ---------- header ---------- */

const failed = byStatus("failed");
const flaky = byStatus("flaky");
const tone = failed.length > 0 ? "ko" : flaky.length > 0 ? "warn" : "ok";

const verdict =
  failed.length > 0
    ? `${plural(failed.length, "test failed", "tests failed")} out of ${stats.total}`
    : `All ${stats.total} tests passed`;

const banners = [
  run.status !== "completed"
    ? `<div class="banner banner-ko">The run stopped before finishing: the numbers below are partial and don't describe the full suite.</div>`
    : "",
  run.environment.isProduction
    ? `<div class="banner banner-ko">This run used the <strong>production</strong> environment.</div>`
    : "",
].join("");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Test report &mdash; ${esc(run.environment.label)} &mdash; ${formatDateTime(run.startedAt, run.timezone)}</title>
<style>
:root { --ko:#a32d2d; --ko-bg:#fceded; --warn:#854f0b; --warn-bg:#faeeda; --ok:#0f6e56; --ok-bg:#e1f5ee;
  --text:#22201d; --muted:#6b6862; --border:#e2ded6; --bg:#faf9f7; --card:#ffffff; }
* { box-sizing:border-box; }
body { margin:0; padding:24px 16px 64px; background:var(--bg); color:var(--text);
  font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
main { max-width:860px; margin:0 auto; }
h1 { font-size:28px; margin:0 0 4px; }
h2 { font-size:20px; margin:40px 0 12px; }
h3 { font-size:17px; margin:0 0 8px; }
h4 { font-size:15px; margin:20px 0 6px; color:var(--muted); }
p { margin:0 0 10px; }
.header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;
  background:var(--card); border:1px solid var(--border); border-radius:10px; padding:20px 24px; }
.verdict-ko h1 { color:var(--ko); } .verdict-warn h1 { color:var(--warn); } .verdict-ok h1 { color:var(--ok); }
.meta { color:var(--muted); font-size:14px; margin:0; }
.environment { font-size:15px; font-weight:600; padding:10px 16px; border-radius:8px; background:var(--warn-bg); color:var(--warn); }
.environment-prod { background:var(--ko-bg); color:var(--ko); }
.banner { margin-top:12px; padding:12px 16px; border-radius:8px; font-size:15px; }
.banner-ko { background:var(--ko-bg); color:var(--ko); }
.numbers { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-top:12px; }
.number { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:14px 16px; }
.number span { display:block; font-size:13px; color:var(--muted); }
.number strong { display:block; font-size:26px; font-weight:600; margin-top:2px; }
.areas { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:16px 20px; margin-top:12px; }
.area { display:flex; align-items:center; gap:10px; padding:6px 0; font-size:15px; }
.area em { font-style:normal; color:var(--muted); margin-left:auto; font-size:14px; }
.dot { width:10px; height:10px; border-radius:50%; flex:none; }
.dot-ok { background:var(--ok); } .dot-degraded { background:var(--warn); } .dot-broken { background:var(--ko); }
.card { background:var(--card); border:1px solid var(--border); border-left:4px solid var(--border); border-radius:0 10px 10px 0; padding:18px 22px; margin-bottom:14px; }
.card-ko { border-left-color:var(--ko); } .card-warn { border-left-color:var(--warn); }
.card-head { display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap; }
.pill { font-size:12px; padding:3px 10px; border-radius:20px; }
.pill-ko { background:var(--ko-bg); color:var(--ko); } .pill-warn { background:var(--warn-bg); color:var(--warn); }
.pill-neutral { background:#efece7; color:var(--muted); }
.duration { margin-left:auto; font-size:13px; color:var(--muted); }
.step-line { font-size:15px; }
.error-human { font-size:15px; }
.error-human-missing { color:var(--muted); font-style:italic; }
.steps { list-style:none; margin:12px 0; padding:0; }
.step { font-size:14px; padding:3px 0; display:flex; gap:8px; }
.marker { width:16px; flex:none; }
.step-ok { color:var(--muted); } .step-ko { color:var(--ko); font-weight:600; }
.step-stop { color:var(--muted); font-style:italic; padding-left:24px; }
.media-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px; margin:14px 0; }
.media { margin:0; }
.media img, .media video { width:100%; border:1px solid var(--border); border-radius:8px; display:block; background:#000; }
.media img { cursor:zoom-in; background:var(--bg); }
.media figcaption { font-size:12px; color:var(--muted); margin-top:6px; }
.technical { margin:10px 0; }
.technical summary { cursor:pointer; font-size:14px; color:var(--muted); }
.technical pre { background:#f4f2ee; border-radius:8px; padding:12px; overflow-x:auto; font-size:13px; margin:8px 0 4px; }
.technical-meta { font-size:12px; color:var(--muted); }
.card-foot { margin-top:12px; }
button { font:inherit; font-size:14px; padding:8px 16px; border:1px solid #c9c4ba; background:var(--card);
  border-radius:8px; cursor:pointer; }
button:hover { background:var(--bg); }
.note { color:var(--muted); font-size:14px; }
details > summary { cursor:pointer; }
.summary-title { font-size:16px; }
.list { margin:0 0 10px; padding-left:22px; color:var(--muted); font-size:14px; }
.reason { font-style:italic; }
.empty { background:var(--ok-bg); color:var(--ok); border-radius:10px; padding:20px 24px; margin-top:20px; }
footer { margin-top:48px; padding-top:20px; border-top:1px solid var(--border); font-size:13px; color:var(--muted); }
footer a { color:inherit; }
#zoom { position:fixed; inset:0; background:rgba(0,0,0,.85); display:none; align-items:center; justify-content:center;
  padding:32px; cursor:zoom-out; z-index:10; }
#zoom img { max-width:100%; max-height:100%; }
@media print {
  body { background:#fff; padding:0; }
  video, button, #zoom { display:none !important; }
  .card { break-inside:avoid; border:1px solid #999; }
}
</style>
</head>
<body>
<main>

<header class="header verdict-${tone}">
  <div>
    <h1>${esc(verdict)}</h1>
    <p class="meta">${esc(run.suiteLabel)} &middot; triggered by ${esc(run.triggeredBy)} &middot; ${formatDateTime(
  run.startedAt,
  run.timezone
)} &middot; duration ${formatDuration(run.durationMs)}</p>
  </div>
  <div class="environment ${run.environment.isProduction ? "environment-prod" : ""}">Environment: ${esc(
  run.environment.label.toUpperCase()
)}</div>
</header>
${banners}

<div class="numbers">
  <div class="number"><span>Passed</span><strong>${stats.passed}</strong></div>
  <div class="number"><span>Failed</span><strong>${stats.failed}</strong></div>
  <div class="number"><span>Flaky</span><strong>${stats.flaky}</strong></div>
  <div class="number"><span>Pass rate</span><strong>${stats.passRate}%</strong></div>
</div>

<div class="areas">
  ${areas
    .map(
      (a) =>
        `<div class="area"><span class="dot dot-${a.status}"></span>${esc(a.label)}<em>${a.passed}/${a.total} passed</em></div>`
    )
    .join("")}
</div>

${
  failed.length === 0 && flaky.length === 0
    ? `<div class="empty"><strong>No issues found.</strong> All tests that ran passed on the first attempt.</div>`
    : ""
}

${renderSection("Failed tests", null, failed, "ko")}
${renderSection(
  "To keep an eye on",
  "These tests passed, but only on the second attempt. This usually doesn't indicate the site is broken: they're flagged because inconsistent behavior can hide a real issue.",
  flaky,
  "warn"
)}
${renderPassed()}

<footer>
  <p>Commit ${esc(run.commit.shortSha)} on branch ${esc(run.commit.branch)}${
  run.commit.message ? ` &mdash; ${esc(run.commit.message)}` : ""
}</p>
  <p><a href="${esc(run.url)}">Open the run on GitHub</a> to rerun the tests or download the full attachments.</p>
  <p>Times in the ${esc(run.timezone)} timezone.</p>
</footer>

</main>
<div id="zoom"><img alt=""></div>
<script>
const REPORTS = ${jsonForScript(reports)};

document.addEventListener("click", (event) => {
  const copy = event.target.closest(".copy");
  if (copy) {
    const text = REPORTS[copy.dataset.testId];
    navigator.clipboard.writeText(text).then(
      () => { copy.textContent = "Copied"; setTimeout(() => { copy.textContent = "Copy report"; }, 2000); },
      () => { copy.textContent = "Copy failed"; }
    );
    return;
  }

  const image = event.target.closest("[data-zoom]");
  const zoom = document.getElementById("zoom");
  if (image) {
    zoom.querySelector("img").src = image.src;
    zoom.style.display = "flex";
  } else if (event.target.closest("#zoom")) {
    zoom.style.display = "none";
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") document.getElementById("zoom").style.display = "none";
});

let reopen = [];
addEventListener("beforeprint", () => {
  reopen = [...document.querySelectorAll("details:not([open])")];
  reopen.forEach((d) => d.setAttribute("open", ""));
});
addEventListener("afterprint", () => reopen.forEach((d) => d.removeAttribute("open")));
</script>
</body>
</html>
`;

writeFileSync(args.out, html);

const megabytes = (Buffer.byteLength(html) / 1024 / 1024).toFixed(1);
console.log(`Wrote ${args.out}: ${megabytes} MB, ${videosInlined} videos included.`);
for (const w of warnings) console.warn(`  warning: ${w}`);
