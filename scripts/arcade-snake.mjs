// Arcade Snake generator: builds an animated SVG from your real GitHub contributions.
import fs from "node:fs";

const USER = process.env.GH_USER || "jeclique444";
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = process.env.OUT || "dist/arcade-snake.svg";

// ---------- 1. Fetch contribution data ----------
async function getCalendar() {
  if (process.env.MOCK) {
    const weeks = [];
    const start = new Date(Date.UTC(2025, 9, 5));
    for (let w = 0; w < 53; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const dt = new Date(start.getTime() + (w * 7 + d) * 864e5);
        const lvl = Math.random() < 0.55 ? 0 : 1 + Math.floor(Math.random() * 4);
        days.push({
          date: dt.toISOString().slice(0, 10),
          weekday: d,
          contributionCount: lvl * 2,
          contributionLevel: ["NONE", "FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"][lvl],
        });
      }
      weeks.push({ contributionDays: days });
    }
    return { totalContributions: 753, weeks };
  }
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date weekday contributionCount contributionLevel}}}}}}`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json", "User-Agent": "arcade-snake" },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  const json = await res.json();
  if (!json.data) throw new Error("GraphQL error: " + JSON.stringify(json));
  return json.data.user.contributionsCollection.contributionCalendar;
}

const cal = await getCalendar();
const weeks = cal.weeks;
const cols = weeks.length;

// ---------- 2. Layout ----------
const CELL = 11, GAP = 3, PITCH = CELL + GAP;
const LEFT = 72, TOP = 112;
const W = LEFT + cols * PITCH + 44;
const H = TOP + 7 * PITCH + 76;

const EMPTY = "#141a22";
const LEVEL = {
  NONE: EMPTY,
  FIRST_QUARTILE: "#0e4429",
  SECOND_QUARTILE: "#006d32",
  THIRD_QUARTILE: "#26a641",
  FOURTH_QUARTILE: "#39d353",
};

// ---------- 3. Snake path (serpentine, column by column) ----------
const path = [];
for (let c = 0; c < cols; c++) {
  const rows = [0, 1, 2, 3, 4, 5, 6];
  if (c % 2 === 1) rows.reverse();
  for (const r of rows) path.push({ c, r });
}
const stepIndex = new Map(path.map((p, i) => [`${p.c},${p.r}`, i]));

const SNAKE_LEN = 16;      // longer snake
const STEP = 0.07;         // seconds per step
const PAUSE = 24;          // idle frames before loop restarts
const n = path.length;
const F = n + SNAKE_LEN + PAUSE;
const DUR = (F * STEP).toFixed(2);

const px = (c) => LEFT + c * PITCH;
const py = (r) => TOP + r * PITCH;

// ---------- 4. Cells ----------
let cells = "";
let months = "";
let lastMonthCol = -10;
const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
let lastMonth = -1;

weeks.forEach((week, c) => {
  const first = week.contributionDays[0];
  const m = new Date(first.date + "T00:00:00Z").getUTCMonth();
  if (m !== lastMonth && c - lastMonthCol >= 3) {
    months += `<text x="${px(c)}" y="${TOP - 12}" class="mo">${monthNames[m]}</text>`;
    lastMonthCol = c;
  }
  lastMonth = m;

  week.contributionDays.forEach((day) => {
    const r = day.weekday;
    const color = LEVEL[day.contributionLevel] || EMPTY;
    const idx = stepIndex.get(`${c},${r}`);
    if (day.contributionCount > 0 && idx !== undefined) {
      const t = ((idx + 0.5) / F).toFixed(4);
      cells += `<rect x="${px(c)}" y="${py(r)}" width="${CELL}" height="${CELL}" rx="3" fill="${color}"><animate attributeName="fill" calcMode="discrete" dur="${DUR}s" repeatCount="indefinite" keyTimes="0;${t}" values="${color};${EMPTY}"/></rect>`;
    } else {
      cells += `<rect x="${px(c)}" y="${py(r)}" width="${CELL}" height="${CELL}" rx="3" fill="${EMPTY}"/>`;
    }
  });
});

// ---------- 5. Snake segments ----------
let snake = "";
for (let i = SNAKE_LEN - 1; i >= 0; i--) {
  const vals = [];
  for (let f = 0; f < F; f++) {
    const idx = f - i;
    if (idx >= 0 && idx < n) vals.push(`${px(path[idx].c)} ${py(path[idx].r)}`);
    else vals.push("-60 -60");
  }
  const isHead = i === 0;
  const t = i / (SNAKE_LEN - 1);
  const size = isHead ? CELL + 1 : CELL - Math.floor(t * 4);
  const off = (CELL - size) / 2;
  const fill = isHead ? "#f4ff5c" : `hsl(${95 + Math.round(t * 30)}, 85%, ${68 - Math.round(t * 28)}%)`;
  const op = isHead ? 1 : (1 - t * 0.55).toFixed(2);
  const eyes = isHead
    ? `<circle cx="${CELL * 0.32}" cy="${CELL * 0.4}" r="1.2" fill="#0b0f14"/><circle cx="${CELL * 0.7}" cy="${CELL * 0.4}" r="1.2" fill="#0b0f14"/>`
    : "";
  snake += `<g transform="translate(-60 -60)"><animateTransform attributeName="transform" type="translate" calcMode="discrete" dur="${DUR}s" repeatCount="indefinite" values="${vals.join(";")}"/><rect x="${off}" y="${off}" width="${size}" height="${size}" rx="3" fill="${fill}" opacity="${op}"${isHead ? ' filter="url(#glow)"' : ""}/>${eyes}</g>`;
}

// ---------- 6. Frame, legend, text ----------
const fx = 22, fy = 84, fw = W - 44, fh = H - fy - 22, b = 26;
const brackets = [
  `M${fx} ${fy + b} V${fy} H${fx + b}`,
  `M${fx + fw - b} ${fy} H${fx + fw} V${fy + b}`,
  `M${fx} ${fy + fh - b} V${fy + fh} H${fx + b}`,
  `M${fx + fw - b} ${fy + fh} H${fx + fw} V${fy + fh - b}`,
].map((d) => `<path d="${d}" fill="none" stroke="#39d353" stroke-width="2.5" stroke-linecap="square"/>`).join("");

const lx = W - 44 - 5 * PITCH - 48;
const ly = TOP + 7 * PITCH + 22;
const legend =
  `<text x="${lx - 8}" y="${ly + 9}" class="lg" text-anchor="end">LESS</text>` +
  [EMPTY, "#0e4429", "#006d32", "#26a641", "#39d353"]
    .map((c, i) => `<rect x="${lx + i * PITCH}" y="${ly}" width="${CELL}" height="${CELL}" rx="3" fill="${c}"/>`).join("") +
  `<text x="${lx + 5 * PITCH + 4}" y="${ly + 9}" class="lg">MORE</text>`;

const dayLabels = [["Mon", 1], ["Wed", 3], ["Fri", 5]]
  .map(([t, r]) => `<text x="${LEFT - 14}" y="${py(r) + 9}" class="dy" text-anchor="end">${t}</text>`).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${cal.totalContributions} contributions in the last year">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1118"/><stop offset="1" stop-color="#080b10"/></linearGradient>
  <radialGradient id="aura" cx="0.5" cy="0" r="0.8"><stop offset="0" stop-color="#1f4fff" stop-opacity="0.18"/><stop offset="1" stop-color="#1f4fff" stop-opacity="0"/></radialGradient>
  <filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <style>
    .ti{font:900 27px 'Arial Black',Impact,'Segoe UI',sans-serif;fill:#fff;letter-spacing:.3px}
    .tg{font:700 11px 'Courier New',monospace;fill:#39ff6a;letter-spacing:2px}
    .mo{font:700 11px 'Segoe UI',Arial,sans-serif;fill:#fff}
    .dy{font:700 11px 'Segoe UI',Arial,sans-serif;fill:#fff}
    .lg{font:700 10px 'Segoe UI',Arial,sans-serif;fill:#8b949e;letter-spacing:1px}
  </style>
</defs>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="18" fill="url(#bg)" stroke="#232b36" stroke-width="2"/>
<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="18" fill="url(#aura)"/>
<text x="34" y="52" class="ti">${cal.totalContributions} contributions in the last year</text>
<text x="${W - 34}" y="46" class="tg" text-anchor="end">ARCADE MODE // SNAKE RUN<animate attributeName="opacity" values="1;1;0.35;1" dur="2.4s" repeatCount="indefinite"/></text>
${brackets}
${months}
${dayLabels}
${cells}
${snake}
${legend}
</svg>`;

fs.mkdirSync(OUT.substring(0, OUT.lastIndexOf("/")) || ".", { recursive: true });
fs.writeFileSync(OUT, svg);
console.log(`Wrote ${OUT} (${(svg.length / 1024).toFixed(1)} KB, ${cal.totalContributions} contributions)`);
