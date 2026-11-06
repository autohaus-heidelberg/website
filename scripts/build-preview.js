/* eslint-disable no-console */
// Baut ein Preview-Paket der öffentlichen Seite zum Teilen (z.B. per Netlify Drop).
// Verändert das Repo nicht: gebaut wird in einer temporären Kopie, in die Beispieldaten
// für die Community-Seite (Treffen, "Wir suchen") eingefügt werden.
//
// Aufruf: npm run preview:package [-- <Zielordner>]
// Standard-Ziel: ~/Desktop/carousel-preview (+ .zip daneben)
import { cpSync, copyFileSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.resolve(process.argv[2] ?? path.join(homedir(), "Desktop", "carousel-preview"));
const SKIP_TOP_LEVEL = new Set(["node_modules", "dist", "build", ".git", "test-results", "e2e", ".gh-pages-worktree"]);

// Nächster Dienstag + n Wochen, 19:30 (Winterzeit) – damit die Beispiel-Treffen immer in der Zukunft liegen.
function tuesday(weeksAhead) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((2 - d.getUTCDay() + 7) % 7 || 7) + weeksAhead * 7);
  d.setUTCHours(18, 30, 0, 0);
  return d.toISOString();
}

const meeting = (id, weeksAhead, title, text) => ({
  id, date: tuesday(weeksAhead), endDate: null, title, fee: "", feeAk: "",
  descriptionShort: `<p>${text}</p>`, descriptionLong: "", shopLink: "", img: "",
  cancelled: false, type: "community", artists: [],
});

const demoMeetings = [
  meeting("preview-plenum", 0, "Plenum & Bar-Schulung", "Wir treffen uns im Laden, besprechen das Programm und zeigen Neuen, wie die Bar funktioniert. Jede:r ist willkommen."),
  meeting("preview-plakate", 2, "Plakate-Abend", "Gemeinsam Plakate falten, Flyer verteilen und Kleister anrühren."),
];

const demoCommunity = {
  helpRequests: [
    { title: "Bar-Schichten", text: "Freitags und samstags brauchen wir Leute hinter dem Tresen. Einarbeitung gibt es vor Ort." },
    { title: "Technik", text: "Licht und Ton – Erfahrung ist schön, Neugier reicht." },
    { title: "Plakate kleben", text: "Ein paar Stunden pro Monat, mit dem Rad durch die Stadt." },
  ],
};

const work = mkdtempSync(path.join(tmpdir(), "carousel-preview-"));
try {
  cpSync(root, work, {
    recursive: true,
    filter: (src) => !SKIP_TOP_LEVEL.has(path.relative(root, src).split(path.sep)[0]),
  });
  symlinkSync(path.join(root, "node_modules"), path.join(work, "node_modules"));

  const eventsFile = path.join(work, "src", "events.json");
  const events = JSON.parse(readFileSync(eventsFile, "utf-8"));
  writeFileSync(eventsFile, JSON.stringify([...demoMeetings, ...events], null, 4));
  writeFileSync(path.join(work, "src", "community.json"), JSON.stringify(demoCommunity, null, 4));

  console.log("Baue Preview...");
  execFileSync("npx", ["vite", "build"], { cwd: work, stdio: "inherit" });

  const dist = path.join(work, "dist");
  // Ohne CNAME, sonst beansprucht die Preview-Seite die Domain altesauto.haus.
  rmSync(path.join(dist, "CNAME"), { force: true });
  // SPA-Fallback: direkte Aufrufe von /community, /event/... (Netlify: _redirects, GitHub Pages: 404.html)
  copyFileSync(path.join(dist, "index.html"), path.join(dist, "404.html"));
  writeFileSync(path.join(dist, "_redirects"), "/*    /index.html   200\n");

  rmSync(outDir, { recursive: true, force: true });
  rmSync(`${outDir}.zip`, { force: true });
  cpSync(dist, outDir, { recursive: true });
  try {
    execFileSync("zip", ["-qr", `${outDir}.zip`, path.basename(outDir)], { cwd: path.dirname(outDir) });
  } catch {
    console.warn("zip nicht verfügbar – nur der Ordner wurde erstellt.");
  }
  console.log(`\nFertig: ${outDir}\nHochladen: https://app.netlify.com/drop (Ordner ins Fenster ziehen)`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
