import "./style.css";
import { CONFIG } from "./config";
import { DAYS_PER_YEAR, duration, fullDate, makeDate, shortDate, yearsBetween } from "./calendar";
import { LoadResult, TimelineEvent, loadTimeline, slugify } from "./data";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const isNarrow = () => window.matchMedia("(max-width: 820px)").matches;

let events: TimelineEvent[] = [];
let byId: Record<string, TimelineEvent> = {};
let byTitleSlug: Record<string, TimelineEvent> = {};
let categories: string[] = [];
let branches: string[] = [];
let MIN = 0;
let RANGE = 1;

const state = {
  q: "",
  cats: new Set<string>(),
  branches: new Set<string>(),
  spoilers: false,
  sel: null as string | null,
};

function readSpoilerPref(): boolean {
  try { return localStorage.getItem("dreamland-spoilers") === "1"; } catch { return false; }
}
function writeSpoilerPref(v: boolean) {
  try { localStorage.setItem("dreamland-spoilers", v ? "1" : "0"); } catch { /* storage blocked */ }
}

const isCharacter = (e: TimelineEvent) => e.category === "Character";
const shownToReader = (e: TimelineEvent) => state.spoilers || e.visibility === "public";
/** Spoiler rows stay in the list as redaction bars until spoilers are on. GM rows stay out entirely. */
const redacted = (e: TimelineEvent) => !state.spoilers && e.visibility === "spoiler";

function visible(): TimelineEvent[] {
  const words = state.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return events.filter(
    (e) =>
      (shownToReader(e) || (redacted(e) && !words.length)) &&
      state.cats.has(e.category) &&
      state.branches.has(e.branch) &&
      words.every((w) => e.searchText.includes(w)),
  );
}

/* ---------- theme + clearance ---------- */

function currentTheme(): "dark" | "light" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
function setTheme(t: "dark" | "light") {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("dreamland-theme", t); } catch { /* storage blocked */ }
  const btn = $("theme");
  btn.textContent = t === "dark" ? "Light mode" : "Dark mode";
  btn.setAttribute("aria-label", `Switch to ${t === "dark" ? "light" : "dark"} mode`);
}
function renderClearance() {
  const bar = $("clearance");
  bar.classList.toggle("restricted", state.spoilers);
  $("clearance-level").textContent = state.spoilers ? "RESTRICTED" : "PUBLIC";
}

/* ---------- filters ---------- */

function renderChips() {
  const pool = events.filter(shownToReader);
  $("chips").innerHTML = categories
    .map((c) => {
      const n = pool.filter((e) => e.category === c).length;
      const color = `var(${CONFIG.categoryColors[c] ?? "--accent"})`;
      return `<button class="chip" style="--c:${color}" data-cat="${esc(c)}" aria-pressed="${state.cats.has(c)}" title="Click to toggle. Shift-click to show only this one."><span class="dot"></span>${esc(c)} <span class="n">${n}</span></button>`;
    })
    .join("");

  const branchBox = $("branches");
  branchBox.hidden = branches.length < 2;
  branchBox.innerHTML = branches
    .map((b) => {
      const n = pool.filter((e) => e.branch === b).length;
      const label = b === "main" ? "Main timeline" : b;
      return `<button class="chip branch" data-branch="${esc(b)}" aria-pressed="${state.branches.has(b)}"><span class="dot"></span>${esc(label)} <span class="n">${n}</span></button>`;
    })
    .join("");
}

function toggleIn(set: Set<string>, all: string[], value: string, solo: boolean): Set<string> {
  if (solo) return new Set([value]);
  const next = new Set(set);
  next.has(value) ? next.delete(value) : next.add(value);
  return next.size ? next : new Set(all);
}

/* ---------- ledger ---------- */

function renderEra(list: TimelineEvent[]) {
  const first = Math.floor(events[0].start.y / 10) * 10;
  const last = Math.floor(Math.max(...events.map((e) => e.start.y)) / 10) * 10;
  const counts = new Map<number, number>();
  for (let d = first; d <= last; d += 10) counts.set(d, 0);
  list.forEach((e) => counts.set(Math.floor(e.start.y / 10) * 10, (counts.get(Math.floor(e.start.y / 10) * 10) ?? 0) + 1));
  const max = Math.max(1, ...counts.values());
  const era = $("era");
  era.style.gridTemplateColumns = `repeat(${counts.size}, 1fr)`;
  era.innerHTML = [...counts]
    .map(
      ([d, n]) =>
        `<button data-dec="${d}" title="${d}s: ${n} ${n === 1 ? "entry" : "entries"}" ${n ? "" : "disabled"}><span class="bar" style="height:${(n / max) * 52}px"></span><span class="lbl" data-s="'${String(d).slice(-2)}">${d}</span></button>`,
    )
    .join("");
}

function renderList() {
  const list = visible();
  const total = events.filter((e) => shownToReader(e) || redacted(e)).length;
  $("count").textContent = `${list.length} of ${total} entries`;
  renderEra(list);
  if (!list.length) {
    $("list").innerHTML = `<p class="empty">Nothing matches “${esc(state.q)}”. Try a year or a name, or turn more categories back on.</p>`;
    return;
  }
  let html = "";
  let decade: number | null = null;
  for (const e of list) {
    const d = Math.floor(e.start.y / 10) * 10;
    if (d !== decade) {
      decade = d;
      html += `<h2 class="decade" id="d${d}">${d}s</h2>`;
    }
    const left = ((e.start.idx - MIN) / RANGE) * 100;
    const width = ((e.endIdx - e.start.idx) / RANGE) * 100;
    const span = e.end ? ` → ${e.end.y}` : e.ongoing ? " → ongoing" : isCharacter(e) ? " → ?" : "";
    if (redacted(e)) {
      html += `<div class="ev redacted" style="--c:${e.color}" title="Restricted. Turn on spoilers to read this file.">
      <span class="date">${e.start.y}<br>${shortDate(e.start)}</span>
      <span class="t"><span class="bar-redact" style="width:${Math.min(28, 8 + e.title.length * 0.6)}ch"></span><span class="meta"><span class="stamp">Restricted</span></span></span>
      <span class="track" aria-hidden="true"><span style="left:${left}%;width:${width}%"></span></span>
    </div>`;
      continue;
    }
    const tags =
      (e.branch !== "main" ? `<span class="tag">${esc(e.branch)}</span>` : "") +
      (e.visibility !== "public" ? `<span class="tag spoiler">${e.visibility}</span>` : "");
    html += `<button class="ev" style="--c:${e.color}" data-id="${e.id}" aria-current="${state.sel === e.id}">
      <span class="date">${e.start.y}<br>${shortDate(e.start)}</span>
      <span class="t">${esc(e.title)}${tags}<span class="meta"><i>${esc(e.category)}</i>${span}</span></span>
      <span class="track" aria-hidden="true"><span style="left:${left}%;width:${width}%"></span></span>
    </button>`;
  }
  $("list").innerHTML = html;
}

/* ---------- dossier ---------- */

function linkButtons(list: TimelineEvent[], extra?: (e: TimelineEvent) => string): string {
  if (!list.length) return `<p class="none">None yet.</p>`;
  return `<div class="links">${list
    .map((x) => `<button style="--c:${x.color}" data-id="${x.id}">${esc(x.title)}${extra ? ` <span class="none">${extra(x)}</span>` : ""}</button>`)
    .join("")}</div>`;
}

function bibleLinks(note: string): string {
  const parts: string[] = [];
  if (CONFIG.bibleBaseUrl) parts.push(`<a href="${esc(CONFIG.bibleBaseUrl.replace(/\/$/, ""))}/${slugify(note)}" target="_blank" rel="noopener">Read in the bible</a>`);
  if (CONFIG.obsidianVault) parts.push(`<a href="obsidian://open?vault=${encodeURIComponent(CONFIG.obsidianVault)}&file=${encodeURIComponent(note)}">Open in Obsidian</a>`);
  return parts.join("");
}

/** Turns [[Title]] and [[Title|label]] into links to events (or the bible when no event matches). */
function renderDescription(text: string): string {
  return esc(text).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target: string, label?: string) => {
    const shown = label ?? target;
    const ev = byId[slugify(target)] ?? byTitleSlug[slugify(target)];
    if (ev && shownToReader(ev)) return `<button class="wikilink" data-id="${ev.id}">${shown}</button>`;
    if (CONFIG.bibleBaseUrl) return `<a href="${esc(CONFIG.bibleBaseUrl.replace(/\/$/, ""))}/${slugify(target)}" target="_blank" rel="noopener">${shown}</a>`;
    return shown;
  });
}

function renderDossier() {
  const el = $("dossier");
  const e = state.sel ? byId[state.sel] : undefined;
  if (!e) { el.hidden = true; return; }
  el.hidden = false;

  const s = e.start.idx;
  const t = e.endIdx;
  const pool = events.filter((x) => x.id !== e.id && shownToReader(x) && (x.branch === e.branch || x.branch === "main"));
  const overlaps = (x: TimelineEvent) => x.start.idx <= t && x.endIdx >= s;
  const char = isCharacter(e);

  let rows = `<dt>${char ? "Born" : "Start"}</dt><dd>${fullDate(e.start)}</dd>`;
  if (e.end) {
    rows += `<dt>${char ? "Died" : "End"}</dt><dd>${fullDate(e.end)}</dd><dt>${char ? "Lifespan" : "Length"}</dt><dd>${duration(e.start, e.end)}</dd>`;
  } else if (e.ongoing) {
    rows += `<dt>${char ? "Died" : "End"}</dt><dd>Ongoing</dd>`;
  } else {
    rows += char ? `<dt>Died</dt><dd class="none">Not set in the sheet</dd>` : `<dt>Length</dt><dd>Single day</dd>`;
  }
  if (e.branch !== "main") {
    const fork = e.forksFrom ? byId[e.forksFrom] : undefined;
    rows += `<dt>Branch</dt><dd>${esc(e.branch)}${fork ? `, splits from <button class="wikilink" data-id="${fork.id}">${esc(fork.title)}</button>` : ""}</dd>`;
  }

  const desc = e.description
    ? `<p class="desc">${renderDescription(e.description)}</p>`
    : `<p class="desc placeholder">No description yet. Add one in the description column of the sheet.</p>`;

  const related = e.related.map((id) => byId[id] ?? byTitleSlug[id]).filter((x): x is TimelineEvent => !!x && shownToReader(x));

  let context: string;
  if (char) {
    const during = pool.filter((x) => !isCharacter(x) && overlaps(x));
    const peers = pool.filter((x) => isCharacter(x) && overlaps(x));
    context = `<h3>Events in their lifetime · ${during.length}</h3>${linkButtons(during, (x) => String(x.start.y))}
      <h3>Contemporaries · ${peers.length}</h3>${linkButtons(peers)}`;
  } else {
    const alive = pool.filter((x) => isCharacter(x) && x.start.idx <= s && (x.end ? x.end.idx >= s : true));
    const concurrent = pool.filter((x) => !isCharacter(x) && overlaps(x));
    context = `<h3>Characters alive at the start · ${alive.length}</h3>${linkButtons(alive, (x) => `age ${yearsBetween(x.start, e.start)}`)}
      <h3>Happening at the same time · ${concurrent.length}</h3>${linkButtons(concurrent, (x) => String(x.start.y))}`;
  }

  const bible = e.bible ? bibleLinks(e.bible) : "";

  el.innerHTML = `<button class="close" id="close" aria-label="Close details">Close</button>
    <div class="file-tab">File no. ${e.rank ? String(e.rank).padStart(3, "0") : esc(e.id)}</div>
    <div class="dossier-body">
    <div class="cat" style="--c:${e.color}">${esc(e.category)}${e.visibility !== "public" ? ` <span class="stamp">${e.visibility === "gm" ? "GM only" : "Restricted"}</span>` : ""}</div>
    <h2>${esc(e.title)}</h2>
    <dl class="dl">${rows}</dl>
    ${desc}
    <div class="actions"><button id="copy" type="button">Copy link</button>${bible}</div>
    ${related.length ? `<h3>Related entries · ${related.length}</h3>${linkButtons(related, (x) => String(x.start.y))}` : ""}
    ${context}
    </div>`;
  el.scrollTop = 0;
}

function select(id: string | null, scrollList: boolean) {
  state.sel = id && byId[id] ? id : null;
  try {
    history.replaceState(null, "", state.sel ? `#${state.sel}` : location.pathname + location.search);
  } catch { /* ignore */ }
  renderList();
  renderDossier();
  if (scrollList && state.sel) {
    document.querySelector(`.ev[data-id="${state.sel}"]`)?.scrollIntoView({ block: "center" });
  }
}

/** Makes sure an event is visible before jumping to it (clears filters that would hide it). */
function reveal(id: string) {
  const e = byId[id];
  if (!e) return;
  if (!shownToReader(e)) { state.spoilers = true; $<HTMLInputElement>("spoilers").checked = true; renderClearance(); }
  if (!visible().some((x) => x.id === id)) {
    state.q = "";
    $<HTMLInputElement>("q").value = "";
    state.cats = new Set(categories);
    state.branches = new Set(branches);
    renderChips();
  }
  select(id, true);
}

/* ---------- status footer ---------- */

function renderStatus(r: LoadResult) {
  const parts: string[] = [];
  parts.push(
    r.source === "live"
      ? `<div>Live from the Dreamland sheet. ${events.length} entries loaded.</div>`
      : `<div>Couldn't reach the sheet (${esc(r.sourceError ?? "unknown error")}), showing the bundled snapshot instead.</div>`,
  );
  if (r.problems.length) {
    parts.push(`<details><summary>${r.problems.length} sheet ${r.problems.length === 1 ? "row needs" : "rows need"} attention</summary><ul>${r.problems
      .map((p) => `<li>${p.row ? `Row ${p.row}, ` : ""}${esc(p.title)}: ${esc(p.message)}</li>`)
      .join("")}</ul></details>`);
  }
  $("status").innerHTML = parts.join("");
}

/* ---------- events ---------- */

function wire() {
  $("theme").addEventListener("click", () => setTheme(currentTheme() === "dark" ? "light" : "dark"));
  $<HTMLInputElement>("q").addEventListener("input", (ev) => {
    state.q = (ev.target as HTMLInputElement).value;
    renderList();
  });
  $<HTMLInputElement>("spoilers").addEventListener("change", (ev) => {
    state.spoilers = (ev.target as HTMLInputElement).checked;
    writeSpoilerPref(state.spoilers);
    renderClearance();
    if (state.sel && !shownToReader(byId[state.sel])) state.sel = null;
    renderChips();
    renderList();
    renderDossier();
  });
  $("chips").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>(".chip");
    if (!b?.dataset.cat) return;
    state.cats = toggleIn(state.cats, categories, b.dataset.cat, ev.shiftKey || ev.altKey);
    renderChips();
    renderList();
  });
  $("branches").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>(".chip");
    if (!b?.dataset.branch) return;
    state.branches = toggleIn(state.branches, branches, b.dataset.branch, ev.shiftKey || ev.altKey);
    renderChips();
    renderList();
  });
  $("era").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (b) document.getElementById(`d${b.dataset.dec}`)?.scrollIntoView();
  });
  $("list").addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>(".ev");
    if (b?.dataset.id) select(b.dataset.id, false);
  });
  $("dossier").addEventListener("click", async (ev) => {
    const target = ev.target as HTMLElement;
    if (target.id === "close") { select(null, false); return; }
    if (target.id === "copy") {
      try {
        await navigator.clipboard.writeText(location.href);
        target.textContent = "Link copied";
      } catch {
        target.textContent = location.href;
      }
      return;
    }
    const b = target.closest<HTMLElement>("[data-id]");
    if (b?.dataset.id) reveal(b.dataset.id);
  });
  document.addEventListener("keydown", (ev) => {
    const q = $<HTMLInputElement>("q");
    if (ev.key === "/" && document.activeElement !== q) { ev.preventDefault(); q.focus(); }
    if (ev.key === "Escape" && isNarrow()) select(null, false);
  });
  window.addEventListener("hashchange", () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id && id !== state.sel) reveal(id);
  });
}

/* ---------- boot ---------- */

async function boot() {
  wire();
  setTheme(currentTheme());
  let result: LoadResult;
  try {
    result = await loadTimeline();
  } catch (err) {
    $("count").textContent = "";
    $("list").innerHTML = `<p class="empty">The timeline couldn't load: ${esc(err instanceof Error ? err.message : String(err))}. Refresh to try again.</p>`;
    return;
  }
  events = result.events;
  if (!events.length) {
    $("count").textContent = "";
    $("list").innerHTML = `<p class="empty">The sheet loaded but has no usable rows. Each row needs at least a title and a date_begin.</p>`;
    renderStatus(result);
    return;
  }
  byId = Object.fromEntries(events.map((e) => [e.id, e]));
  byTitleSlug = Object.fromEntries(events.map((e) => [slugify(e.title), e]));
  categories = [...new Set(events.map((e) => e.category))].sort();
  branches = [...new Set(events.map((e) => e.branch))].sort((a, b) => (a === "main" ? -1 : b === "main" ? 1 : a.localeCompare(b)));
  state.cats = new Set(categories);
  state.branches = new Set(branches);
  state.spoilers = readSpoilerPref();
  $<HTMLInputElement>("spoilers").checked = state.spoilers;
  renderClearance();

  const firstYear = Math.floor(events[0].start.y / 10) * 10;
  const lastYear = Math.max(...events.map((e) => (e.end ?? e.start).y));
  MIN = makeDate(firstYear, 1, 1).idx;
  RANGE = Math.max(DAYS_PER_YEAR, makeDate(lastYear, 12, 28).idx - MIN);

  renderChips();
  renderStatus(result);

  const fromHash = decodeURIComponent(location.hash.slice(1));
  if (byId[fromHash]) reveal(fromHash);
  else if (!isNarrow() && byId[CONFIG.defaultEventId] && shownToReader(byId[CONFIG.defaultEventId])) select(CONFIG.defaultEventId, false);
  else renderList();
}

boot();
