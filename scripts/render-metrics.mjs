// Renders assets/generated/metrics.svg — LUONVUITUOI-branded GitHub metrics card.
// Runs in GitHub Actions (GITHUB_TOKEN) with zero npm deps (Node 20 global fetch).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const USER = "Kein95";
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "generated", "metrics.svg");

const headers = {
  "User-Agent": "kein95-profile-metrics",
  Accept: "application/vnd.github+json",
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function rest(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

async function gql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors) throw new Error(`GraphQL: ${JSON.stringify(body.errors)}`);
  return body.data;
}

const user = await rest(`/users/${USER}`);

const repos = [];
for (let page = 1; page <= 3; page++) {
  const batch = await rest(`/users/${USER}/repos?per_page=100&sort=pushed&page=${page}`);
  repos.push(...batch);
  if (batch.length < 100) break;
}
const own = repos.filter((r) => !r.fork);
const stars = own.reduce((s, r) => s + r.stargazers_count, 0);
const forks = own.reduce((s, r) => s + r.forks_count, 0);

const GITHUB_LANG_COLORS = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5", HTML: "#e34c26",
  CSS: "#563d7c", SCSS: "#c6538c", Shell: "#89e051", Dockerfile: "#384d54",
  Jinja: "#a52a22", Markdown: "#083fa1", Vue: "#41b883", Java: "#b07219",
  "Jupyter Notebook": "#DA5B0B", Makefile: "#427819", Batchfile: "#C1F12E",
};

const langBytes = {};
for (const repo of [...own].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 10)) {
  try {
    const langs = await rest(new URL(repo.languages_url).pathname);
    for (const [lang, bytes] of Object.entries(langs)) langBytes[lang] = (langBytes[lang] || 0) + bytes;
  } catch { /* one repo failing shouldn't kill the render */ }
}
const langTotal = Object.values(langBytes).reduce((a, b) => a + b, 0) || 1;
const topLangs = Object.entries(langBytes)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6)
  .map(([name, bytes], i) => ({
    name,
    pct: (bytes / langTotal) * 100,
    color: GITHUB_LANG_COLORS[name] || ["#F43A20", "#FFC247", "#B835C7", "#35C2FF", "#5A3BEA", "#155BFF"][i],
  }));

const year = new Date().getUTCFullYear();
let contributions = null;
try {
  const data = await gql(
    `query($login: String!, $from: DateTime!) {
       user(login: $login) {
         contributionsCollection(from: $from) {
           contributionCalendar { totalContributions }
         }
       }
     }`,
    { login: USER, from: `${year}-01-01T00:00:00Z` }
  );
  contributions = data.user.contributionsCollection.contributionCalendar.totalContributions;
} catch { /* calendar stays "N/A" if GraphQL hiccups */ }

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n) => (n == null ? "N/A" : Number(n).toLocaleString("en-US"));

// ---- layout ----
const W = 1200, H = 460, PAD = 56;
const stats = [
  { value: fmt(stars), label: `Stars across ${own.length} repos`, color: "#F43A20" },
  { value: fmt(forks), label: "Forks earned", color: "#FFC247" },
  { value: fmt(user.public_repos), label: "Public repositories", color: "#35C2FF" },
  { value: contributions == null ? "N/A" : fmt(contributions), label: `Contributions in ${year}`, color: "#B835C7" },
];
const colW = (W - PAD * 2) / 4;

let langBar = "";
if (topLangs.length) {
  const barW = W - PAD * 2, barX = PAD, barY = 356;
  let x = barX;
  const segs = topLangs.map((l) => {
    const w = (l.pct / 100) * barW;
    const seg = `<rect x="${x.toFixed(1)}" y="${barY}" width="${w.toFixed(1)}" height="14" rx="7" fill="${l.color}"/>`;
    x += w;
    return seg;
  });
  const labels = topLangs
    .map((l, i) => `<tspan fill="${l.color}" font-weight="700">${esc(l.name)} ${l.pct.toFixed(0)}%</tspan>${i < topLangs.length - 1 ? "<tspan fill='#55618A'>   ·   </tspan>" : ""}`)
    .join("");
  langBar = `
  ${segs.join("\n  ")}
  <text x="${PAD}" y="398" font-size="15" font-family="'Segoe UI',Arial,sans-serif">${labels}</text>`;
}

const renderedAt = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kien Ho Trung GitHub metrics">
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#F43A20"/><stop offset="0.22" stop-color="#FF5A36"/>
      <stop offset="0.48" stop-color="#B835C7"/><stop offset="0.7" stop-color="#5A3BEA"/>
      <stop offset="1" stop-color="#155BFF"/>
    </linearGradient>
    <radialGradient id="washRed" cx="0.1" cy="0" r="0.7">
      <stop offset="0" stop-color="#F43A20" stop-opacity="0.16"/><stop offset="1" stop-color="#F43A20" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="washBlue" cx="0.92" cy="0.08" r="0.7">
      <stop offset="0" stop-color="#155BFF" stop-opacity="0.2"/><stop offset="1" stop-color="#155BFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="washPurple" cx="0.5" cy="1.15" r="0.75">
      <stop offset="0" stop-color="#B835C7" stop-opacity="0.16"/><stop offset="1" stop-color="#B835C7" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="20" fill="#10142A" stroke="url(#brand)" stroke-opacity="0.45" stroke-width="1.5"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="20" fill="url(#washRed)"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="20" fill="url(#washBlue)"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="20" fill="url(#washPurple)"/>

  <text x="${PAD}" y="92" font-size="42" font-weight="800" font-family="'Segoe UI',Arial,sans-serif" fill="url(#brand)">Kien Ho Trung</text>
  <text x="${PAD}" y="128" font-size="19" font-family="'Segoe UI',Arial,sans-serif" fill="#8CA0C6">@${esc(USER)} · vibe coder · <tspan fill="#35C2FF" font-weight="600">luonvuituoi.work</tspan></text>

  <line x1="${PAD}" y1="152" x2="${W - PAD}" y2="152" stroke="url(#brand)" stroke-opacity="0.35"/>

  ${stats
    .map(
      (s, i) => `
  <text x="${PAD + i * colW}" y="228" font-size="46" font-weight="800" font-family="'Segoe UI',Arial,sans-serif" fill="${s.color}">${s.value}</text>
  <text x="${PAD + i * colW}" y="262" font-size="15" font-family="'Segoe UI',Arial,sans-serif" fill="#8CA0C6">${esc(s.label)}</text>`
    )
    .join("\n")}

  <text x="${PAD}" y="326" font-size="17" font-weight="700" letter-spacing="3" font-family="'Segoe UI',Arial,sans-serif" fill="#8CA0C6">TOP LANGUAGES</text>
  ${langBar}

  <text x="${W - PAD}" y="${H - 24}" text-anchor="end" font-size="13" font-family="'Segoe UI',Arial,sans-serif" fill="#55618A">auto-rendered by GitHub Actions · ${renderedAt}</text>
</svg>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg);
console.log(`metrics.svg written: stars=${stars} forks=${forks} repos=${user.public_repos} contributions=${contributions ?? "n/a"} langs=${topLangs.map((l) => l.name).join(",")}`);
