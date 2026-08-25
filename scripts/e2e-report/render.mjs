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

/* ---------- argomenti ---------- */

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, "")] = argv[i + 1];
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.run || !args.out) {
  console.error("Uso: node render.mjs --run run.json --out report-business.html [--max-video 10] [--budget-mb 40]");
  process.exit(2);
}

const maxVideos = Number(args["max-video"] ?? 10);
const budgetBytes = Number(args["budget-mb"] ?? 40) * 1024 * 1024;

/* ---------- utilita ---------- */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

const jsonForScript = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

function formatDateTime(iso, timeZone) {
  try {
    return new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone }).format(new Date(iso));
  } catch {
    warn(`Fuso orario "${timeZone}" non riconosciuto, uso UTC.`);
    return new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso));
  }
}

function formatDuration(ms) {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* ---------- inlining degli allegati ---------- */

let spent = 0;
let videosInlined = 0;

function inlineFile(path, { isVideo }) {
  if (!path) return null;

  let size;
  try {
    size = statSync(path).size;
  } catch {
    warn(`Allegato non trovato, lo salto: ${path}`);
    return null;
  }

  if (isVideo && videosInlined >= maxVideos) {
    warn(`Superato il limite di ${maxVideos} video: ${path} non incluso.`);
    return null;
  }

  const encoded = Math.ceil((size * 4) / 3);
  if (spent + encoded > budgetBytes) {
    warn(`Budget di ${Math.round(budgetBytes / 1024 / 1024)} MB esaurito: ${path} non incluso.`);
    return null;
  }

  const extension = path.slice(path.lastIndexOf(".")).toLowerCase();
  const mime = MIME[extension];
  if (!mime) {
    warn(`Estensione non gestita, salto: ${path}`);
    return null;
  }

  spent += encoded;
  if (isVideo) videosInlined += 1;
  return `data:${mime};base64,${readFileSync(path).toString("base64")}`;
}

/* ---------- lettura ---------- */

const data = JSON.parse(readFileSync(args.run, "utf8"));
if (data.schemaVersion !== SUPPORTED_SCHEMA) {
  console.error(`schemaVersion ${data.schemaVersion} non supportata da questo renderer (attesa ${SUPPORTED_SCHEMA}).`);
  process.exit(1);
}

const { run, stats, areas, tests } = data;
const labelByArea = Object.fromEntries(areas.map((a) => [a.id, a.label]));
const byStatus = (s) => tests.filter((t) => t.status === s);

/* ---------- frammenti ---------- */

function renderSteps(test) {
  if (!test.steps) return "";
  const items = test.steps
    .map((step) => {
      const failed = step.index === test.failedStepIndex;
      const marker = failed ? "&#10005;" : "&#10003;";
      return `<li class="step ${failed ? "step-ko" : "step-ok"}"><span class="marker">${marker}</span>${esc(step.title)}</li>`;
    })
    .join("");
  return `<ol class="steps">${items}<li class="step step-stop">Esecuzione interrotta qui</li></ol>`;
}

function renderMedia(test) {
  const screenshot = inlineFile(test.attachments.screenshot, { isVideo: false });
  const video = inlineFile(test.attachments.video, { isVideo: true });
  if (!screenshot && !video) return "";

  const left = screenshot
    ? `<figure class="media"><img src="${screenshot}" alt="Schermata al momento dell'errore: ${esc(test.title)}" data-zoom><figcaption>Schermata al momento dell'errore &mdash; clicca per ingrandire</figcaption></figure>`
    : "";

  const right = video
    ? `<figure class="media"><video controls preload="metadata" src="${video}"></video><figcaption>Video del flusso &mdash; il problema si vede negli ultimi secondi</figcaption></figure>`
    : "";

  return `<div class="media-grid">${left}${right}</div>`;
}

function renderError(test) {
  if (!test.error) return "";
  const human = test.error.human
    ? `<p class="error-human">${esc(test.error.human)}</p>`
    : `<p class="error-human error-human-missing">Errore non riconducibile a una causa nota. Il dettaglio tecnico e qui sotto.</p>`;

  return `${human}
      <details class="tecnico">
        <summary>Dettagli tecnici</summary>
        <pre>${esc(test.error.raw)}</pre>
        <p class="tecnico-meta">${esc(test.error.location.file)}, riga ${test.error.location.line}</p>
      </details>`;
}

function renderTestCard(test, tone) {
  const stepTitle = test.steps && test.failedStepIndex !== null ? test.steps[test.failedStepIndex].title : null;

  return `<article class="card card-${tone}">
      <div class="card-head">
        <span class="pill pill-${tone}">${esc(labelByArea[test.area])}</span>
        ${test.attempts > 1 ? `<span class="pill pill-neutro">${plural(test.attempts, "tentativo", "tentativi")}</span>` : ""}
        <span class="durata">${formatDuration(test.durationMs)}</span>
      </div>
      <h3>${esc(test.title)}</h3>
      ${stepTitle ? `<p class="passo">Fallito al passo: <strong>${esc(stepTitle)}</strong></p>` : ""}
      ${renderError(test)}
      ${renderSteps(test)}
      ${renderMedia(test)}
      <div class="card-foot">
        <button type="button" class="copia" data-test-id="${test.id}">Copia segnalazione</button>
      </div>
    </article>`;
}

function renderSection(title, note, list, tone) {
  if (list.length === 0) return "";
  return `<section>
      <h2>${esc(title)}</h2>
      ${note ? `<p class="nota">${esc(note)}</p>` : ""}
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
      return `<h4>${esc(area.label)}</h4><ul class="elenco">${own.map((t) => `<li>${esc(t.title)}</li>`).join("")}</ul>`;
    })
    .join("");

  const skippedBlock = skipped.length
    ? `<h4>Non eseguiti</h4><ul class="elenco">${skipped
        .map((t) => `<li>${esc(t.title)} <span class="motivo">${esc(t.skipReason)}</span></li>`)
        .join("")}</ul>`
    : "";

  return `<section>
      <details>
        <summary><span class="summary-titolo">${plural(passed.length, "test passato", "test passati")}${
          skipped.length ? ` &middot; ${plural(skipped.length, "non eseguito", "non eseguiti")}` : ""
        }</span></summary>
        ${groups}${skippedBlock}
      </details>
    </section>`;
}

/* ---------- testi da copiare ---------- */

const segnalazioni = Object.fromEntries(
  tests
    .filter((t) => t.status === "failed" || t.status === "flaky")
    .map((t) => {
      const stepTitle = t.steps && t.failedStepIndex !== null ? t.steps[t.failedStepIndex].title : "non disponibile";
      return [
        t.id,
        [
          `Test: ${t.title}`,
          `Esito: ${t.status === "flaky" ? "instabile (passato solo al secondo tentativo)" : "fallito"}`,
          `Area: ${labelByArea[t.area]}`,
          `Ambiente: ${run.environment.label}`,
          `Passo fallito: ${stepTitle}`,
          `Errore: ${t.error?.human ?? t.error?.raw.split("\n")[0] ?? "non disponibile"}`,
          `Data: ${formatDateTime(run.startedAt, run.timezone)}`,
          `Commit: ${run.commit.shortSha} (${run.commit.branch})`,
          `Esecuzione: ${run.url}`,
        ].join("\n"),
      ];
    })
);

/* ---------- intestazione ---------- */

const failed = byStatus("failed");
const flaky = byStatus("flaky");
const tone = failed.length > 0 ? "ko" : flaky.length > 0 ? "warn" : "ok";

const verdict =
  failed.length > 0
    ? `${plural(failed.length, "test fallito", "test falliti")} su ${stats.total}`
    : `Tutti i ${stats.total} test sono passati`;

const banners = [
  run.status !== "completed"
    ? `<div class="banner banner-ko">L'esecuzione si e interrotta prima della fine: i numeri qui sotto sono parziali e non descrivono l'intera suite.</div>`
    : "",
  run.environment.isProduction
    ? `<div class="banner banner-ko">Questa esecuzione ha usato l'ambiente di <strong>produzione</strong>.</div>`
    : "",
].join("");

const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report test &mdash; ${esc(run.environment.label)} &mdash; ${formatDateTime(run.startedAt, run.timezone)}</title>
<style>
:root { --ko:#a32d2d; --ko-bg:#fceded; --warn:#854f0b; --warn-bg:#faeeda; --ok:#0f6e56; --ok-bg:#e1f5ee;
  --testo:#22201d; --tenue:#6b6862; --bordo:#e2ded6; --fondo:#faf9f7; --carta:#ffffff; }
* { box-sizing:border-box; }
body { margin:0; padding:24px 16px 64px; background:var(--fondo); color:var(--testo);
  font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
main { max-width:860px; margin:0 auto; }
h1 { font-size:28px; margin:0 0 4px; }
h2 { font-size:20px; margin:40px 0 12px; }
h3 { font-size:17px; margin:0 0 8px; }
h4 { font-size:15px; margin:20px 0 6px; color:var(--tenue); }
p { margin:0 0 10px; }
.testata { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;
  background:var(--carta); border:1px solid var(--bordo); border-radius:10px; padding:20px 24px; }
.verdetto-ko h1 { color:var(--ko); } .verdetto-warn h1 { color:var(--warn); } .verdetto-ok h1 { color:var(--ok); }
.meta { color:var(--tenue); font-size:14px; margin:0; }
.ambiente { font-size:15px; font-weight:600; padding:10px 16px; border-radius:8px; background:var(--warn-bg); color:var(--warn); }
.ambiente-prod { background:var(--ko-bg); color:var(--ko); }
.banner { margin-top:12px; padding:12px 16px; border-radius:8px; font-size:15px; }
.banner-ko { background:var(--ko-bg); color:var(--ko); }
.numeri { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-top:12px; }
.numero { background:var(--carta); border:1px solid var(--bordo); border-radius:10px; padding:14px 16px; }
.numero span { display:block; font-size:13px; color:var(--tenue); }
.numero strong { display:block; font-size:26px; font-weight:600; margin-top:2px; }
.aree { background:var(--carta); border:1px solid var(--bordo); border-radius:10px; padding:16px 20px; margin-top:12px; }
.area { display:flex; align-items:center; gap:10px; padding:6px 0; font-size:15px; }
.area em { font-style:normal; color:var(--tenue); margin-left:auto; font-size:14px; }
.punto { width:10px; height:10px; border-radius:50%; flex:none; }
.punto-ok { background:var(--ok); } .punto-degraded { background:var(--warn); } .punto-broken { background:var(--ko); }
.card { background:var(--carta); border:1px solid var(--bordo); border-left:4px solid var(--bordo); border-radius:0 10px 10px 0; padding:18px 22px; margin-bottom:14px; }
.card-ko { border-left-color:var(--ko); } .card-warn { border-left-color:var(--warn); }
.card-head { display:flex; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap; }
.pill { font-size:12px; padding:3px 10px; border-radius:20px; }
.pill-ko { background:var(--ko-bg); color:var(--ko); } .pill-warn { background:var(--warn-bg); color:var(--warn); }
.pill-neutro { background:#efece7; color:var(--tenue); }
.durata { margin-left:auto; font-size:13px; color:var(--tenue); }
.passo { font-size:15px; }
.error-human { font-size:15px; }
.error-human-missing { color:var(--tenue); font-style:italic; }
.steps { list-style:none; margin:12px 0; padding:0; }
.step { font-size:14px; padding:3px 0; display:flex; gap:8px; }
.marker { width:16px; flex:none; }
.step-ok { color:var(--tenue); } .step-ko { color:var(--ko); font-weight:600; }
.step-stop { color:var(--tenue); font-style:italic; padding-left:24px; }
.media-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px; margin:14px 0; }
.media { margin:0; }
.media img, .media video { width:100%; border:1px solid var(--bordo); border-radius:8px; display:block; background:#000; }
.media img { cursor:zoom-in; background:var(--fondo); }
.media figcaption { font-size:12px; color:var(--tenue); margin-top:6px; }
.tecnico { margin:10px 0; }
.tecnico summary { cursor:pointer; font-size:14px; color:var(--tenue); }
.tecnico pre { background:#f4f2ee; border-radius:8px; padding:12px; overflow-x:auto; font-size:13px; margin:8px 0 4px; }
.tecnico-meta { font-size:12px; color:var(--tenue); }
.card-foot { margin-top:12px; }
button { font:inherit; font-size:14px; padding:8px 16px; border:1px solid #c9c4ba; background:var(--carta);
  border-radius:8px; cursor:pointer; }
button:hover { background:var(--fondo); }
.nota { color:var(--tenue); font-size:14px; }
details > summary { cursor:pointer; }
.summary-titolo { font-size:16px; }
.elenco { margin:0 0 10px; padding-left:22px; color:var(--tenue); font-size:14px; }
.motivo { font-style:italic; }
.vuoto { background:var(--ok-bg); color:var(--ok); border-radius:10px; padding:20px 24px; margin-top:20px; }
footer { margin-top:48px; padding-top:20px; border-top:1px solid var(--bordo); font-size:13px; color:var(--tenue); }
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

<header class="testata verdetto-${tone}">
  <div>
    <h1>${esc(verdict)}</h1>
    <p class="meta">${esc(run.suiteLabel)} &middot; lanciato da ${esc(run.triggeredBy)} &middot; ${formatDateTime(
  run.startedAt,
  run.timezone
)} &middot; durata ${formatDuration(run.durationMs)}</p>
  </div>
  <div class="ambiente ${run.environment.isProduction ? "ambiente-prod" : ""}">Ambiente: ${esc(
  run.environment.label.toUpperCase()
)}</div>
</header>
${banners}

<div class="numeri">
  <div class="numero"><span>Passati</span><strong>${stats.passed}</strong></div>
  <div class="numero"><span>Falliti</span><strong>${stats.failed}</strong></div>
  <div class="numero"><span>Instabili</span><strong>${stats.flaky}</strong></div>
  <div class="numero"><span>Percentuale di successo</span><strong>${stats.passRate}%</strong></div>
</div>

<div class="aree">
  ${areas
    .map(
      (a) =>
        `<div class="area"><span class="punto punto-${a.status}"></span>${esc(a.label)}<em>${a.passed}/${a.total} passati</em></div>`
    )
    .join("")}
</div>

${
  failed.length === 0 && flaky.length === 0
    ? `<div class="vuoto"><strong>Nessun problema rilevato.</strong> Tutti i test eseguiti sono passati al primo tentativo.</div>`
    : ""
}

${renderSection("Test falliti", null, failed, "ko")}
${renderSection(
  "Da monitorare",
  "Questi test sono passati, ma solo al secondo tentativo. Di norma non indicano una rottura del sito: sono segnalati perche un comportamento incostante puo nascondere un problema reale.",
  flaky,
  "warn"
)}
${renderPassed()}

<footer>
  <p>Commit ${esc(run.commit.shortSha)} sul ramo ${esc(run.commit.branch)}${
  run.commit.message ? ` &mdash; ${esc(run.commit.message)}` : ""
}</p>
  <p><a href="${esc(run.url)}">Apri l'esecuzione su GitHub</a> per rilanciare i test o scaricare gli allegati completi.</p>
  <p>Orari nel fuso ${esc(run.timezone)}.</p>
</footer>

</main>
<div id="zoom"><img alt=""></div>
<script>
const SEGNALAZIONI = ${jsonForScript(segnalazioni)};

document.addEventListener("click", (event) => {
  const copia = event.target.closest(".copia");
  if (copia) {
    const testo = SEGNALAZIONI[copia.dataset.testId];
    navigator.clipboard.writeText(testo).then(
      () => { copia.textContent = "Copiato"; setTimeout(() => { copia.textContent = "Copia segnalazione"; }, 2000); },
      () => { copia.textContent = "Copia non riuscita"; }
    );
    return;
  }

  const immagine = event.target.closest("[data-zoom]");
  const zoom = document.getElementById("zoom");
  if (immagine) {
    zoom.querySelector("img").src = immagine.src;
    zoom.style.display = "flex";
  } else if (event.target.closest("#zoom")) {
    zoom.style.display = "none";
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") document.getElementById("zoom").style.display = "none";
});

let riaprire = [];
addEventListener("beforeprint", () => {
  riaprire = [...document.querySelectorAll("details:not([open])")];
  riaprire.forEach((d) => d.setAttribute("open", ""));
});
addEventListener("afterprint", () => riaprire.forEach((d) => d.removeAttribute("open")));
</script>
</body>
</html>
`;

writeFileSync(args.out, html);

const megabytes = (Buffer.byteLength(html) / 1024 / 1024).toFixed(1);
console.log(`Scritto ${args.out}: ${megabytes} MB, ${videosInlined} video inclusi.`);
for (const w of warnings) console.warn(`  avviso: ${w}`);
