import "../style.css";
import "./character.css";
import { CATEGORIES, Computed, Draft, NameStyle, RULES, RuleData, STATS, Stat, clampLevel, compute, emptyDraft, randomDraft, randomName, tidy } from "./rules";
import { loadRules } from "./data";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));
const pct = (n: number) => (n === 0 ? "0%" : n <= 1 ? `${fmt(n * 100)}%` : `${fmt(n)}%`);

// Descriptions from the gen tab.
const STAT_INFO: Record<Stat, [string, string]> = {
  Power: ["A measure of your strength.", "Carry, Leap"],
  Energy: ["A measure of your endurance.", "HP, Regen, edible potency"],
  Reflex: ["A measure of your dexterity.", "Speed, Defense"],
  Fortune: ["A measure of your opportunity.", "Luck, crit damage, loot"],
  Ego: ["A measure of your charisma.", "Influence, Sanity, barter"],
  Curiosity: ["A measure of your intelligence.", "Educations, Sanity, hacking"],
  Tact: ["A measure of your awareness.", "Sight, Hearing, Sanity"],
};
const SKILL_INFO: Record<string, [string, string]> = {
  Martial: ["Close-quarters weapons for enemies in close range.", "Melee · Unarmed · Thrown"],
  Ballistic: ["Weapons that fire bullets or other projectiles.", "Sidearm · Rifle · Shotgun · Sniper · MG"],
  Advanced: ["Unusual weapons that take training to use well.", "Tech · Explosive"],
  Natural: ["Biology, nature and the natural world.", "Medicine · Survival"],
  Applied: ["Crafting, repair, science and technology.", "Crafting · Science"],
  Mythos: ["Magazines, music and occult objects.", "Media · Occult"],
  Moxie: ["Facing difficulty with spirit or courage.", "Intimidation · Leadership"],
  Influence: ["Swaying the people around you.", "Persuasion · Deception"],
  Vigilance: ["Perceiving the dangers around you.", "Observation · Awareness"],
  Entry: ["Breaking into locked places.", "Hack · Lockpick"],
  Intrusion: ["Getting into places unseen.", "Stealth · Pickpocket"],
  Transport: ["Piloting and repairing vehicles.", "Pilot · Mechanic"],
};
const STORE_KEY = "dreamland-character-draft";
const NAME_STYLE_KEY = "dreamland-name-style";

let nameStyle: NameStyle = (() => {
  try { const v = localStorage.getItem(NAME_STYLE_KEY); return v === "male" || v === "female" ? v : "any"; } catch { return "any"; }
})();

let data: RuleData;
let draft: Draft = emptyDraft();
let calc: Computed;

/* ---------- persistence (per browser, best effort) ---------- */

function saveDraft() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(draft)); } catch { /* storage blocked */ }
}
function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? { ...emptyDraft(), ...JSON.parse(raw) } : null;
  } catch { return null; }
}

/* ---------- theme ---------- */

function setTheme(t: "dark" | "light") {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("dreamland-theme", t); } catch { /* ignore */ }
  $("theme").textContent = t === "dark" ? "Light mode" : "Dark mode";
}
const currentTheme = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

/* ---------- form ---------- */

const stepper = (id: string, value: number, min: number, max: number, label: string) => `
  <span class="stepper" role="group" aria-label="${esc(label)}">
    <button type="button" data-step="${id}" data-d="-1" ${value <= min ? "disabled" : ""} aria-label="Lower ${esc(label)}">−</button>
    <output id="${id}-out">${value}</output>
    <button type="button" data-step="${id}" data-d="1" ${value >= max ? "disabled" : ""} aria-label="Raise ${esc(label)}">+</button>
  </span>`;

const options = (items: { name: string }[], selected: string, placeholder: string) =>
  `<option value="">${esc(placeholder)}</option>` +
  items.map((i) => `<option value="${esc(i.name)}" ${i.name === selected ? "selected" : ""}>${esc(i.name)}</option>`).join("");

const stars = (w: number) => "★".repeat(Math.round(w * 4)) + "☆".repeat(4 - Math.round(w * 4));

function counter(left: number, label: string) {
  const cls = left === 0 ? "done" : left < 0 ? "over" : "";
  return `<span class="counter ${cls}">${left < 0 ? `${-left} over` : `${left} ${label} left`}</span>`;
}

function renderForm() {
  const c = calc;
  const kin = data.kindreds.find((k) => k.name === draft.kindred);
  const bio = data.bios.find((b) => b.name === draft.bio);
  const car = data.careers.find((x) => x.name === draft.career);
  const level = clampLevel(draft.level);

  const identity = `
  <section class="step" aria-labelledby="s1">
    <h2 id="s1"><span class="no">01</span> Identity</h2>
    <div class="grid2">
      <div class="field wide"><label for="name"><span>Name</span></label>
        <div class="name-row">
          <input id="name" type="text" maxlength="60" value="${esc(draft.name)}" placeholder="Full name as it appears on file">
          ${data.names.surnames.length ? `<button type="button" class="act" id="roll-name">Random name</button>` : ""}
        </div>
        ${data.names.surnames.length ? `<div class="name-style" role="radiogroup" aria-label="Random name style">${(["any", "male", "female"] as NameStyle[]).map((s) => `<button type="button" role="radio" aria-checked="${nameStyle === s}" data-name-style="${s}">${s === "any" ? "Any" : s === "male" ? "Male" : "Female"}</button>`).join("")}</div>` : ""}
      </div>
      <div class="field"><span>Level</span>${stepper("level", level, 1, RULES.maxLevel, "Level")}</div>
    </div>
    <div class="pickers">
      <label class="field" for="kindred"><span>Kindred</span>
        <select id="kindred">${options(data.kindreds, draft.kindred, "Choose a Kindred")}</select>
        <small>${kin ? `<b>${esc(kin.type)}.</b> ${esc(kin.desc)}` : "Your people. Sets your resistances."}</small></label>
      <label class="field" for="bio"><span>Bio</span>
        <select id="bio">${options(data.bios, draft.bio, "Choose a Bio")}</select>
        <small>${bio ? `<b>${esc(bio.type)}.</b> ${esc(bio.desc)}` : "Where you grew up. Counts as your first education."}</small></label>
      <label class="field" for="career"><span>Career</span>
        <select id="career">${options(data.careers, draft.career, "Choose a Career")}</select>
        <small>${car ? `<b>${esc(car.mission)}</b><span class="ranks">${CATEGORIES.map((k) => `<span>${k.name} <i>${stars(car.weights[k.key])}</i></span>`).join("")}</span>` : "Your trade. Sets your skill points in each category."}</small></label>
    </div>
  </section>`;

  const statRows = STATS.map((s) => `
    <tr>
      <th scope="row">${s}<small>${esc(STAT_INFO[s][0])} <em>${esc(STAT_INFO[s][1])}</em></small></th>
      <td>${stepper(`stat-${s}`, draft.stats[s], RULES.statMinPoints, RULES.statMaxPoints, s)}</td>
      <td class="num">${c.statTotals[s]}</td>
      <td class="num mod">${c.statMods[s]}</td>
    </tr>`).join("");
  const bonusPick = (lvl: 5 | 10) => {
    const key = lvl === 5 ? "bonus5" : "bonus10";
    return `<label class="field" for="${key}"><span>Level ${lvl} bonus +1</span>
      <select id="${key}">${options(STATS.map((n) => ({ name: n })), draft[key], "Choose a stat")}</select></label>`;
  };
  const stats = `
  <section class="step" aria-labelledby="s2">
    <h2 id="s2"><span class="no">02</span> Stats ${counter(c.statPointsLeft, c.statPointsLeft === 1 ? "point" : "points")}</h2>
    <p class="hint">Spend ${RULES.statPoints} points, ${RULES.statMinPoints} to ${RULES.statMaxPoints} per stat. Each stat starts at ${RULES.statBase}. Every 3 points of total gives +1 modifier.</p>
    <div class="table-scroll"><table class="tbl">
      <thead><tr><th>Stat</th><th>Points</th><th class="num">Total</th><th class="num">Mod</th></tr></thead>
      <tbody>${statRows}</tbody>
    </table></div>
    ${level >= 5 ? `<div class="grid2">${bonusPick(5)}${level >= 10 ? bonusPick(10) : ""}</div>` : ""}
  </section>`;

  const cats = CATEGORIES.map((cat) => {
    const rows = cat.skills.map((s) => {
      const focused = draft.focus.includes(s);
      const canFocus = focused || c.focusLeft > 0;
      return `<tr>
        <th scope="row">${s}<small>${esc(SKILL_INFO[s][0])} <em>${esc(SKILL_INFO[s][1])}</em></small></th>
        <td>${stepper(`skill-${s}`, draft.skills[s], 0, Math.min(c.maxPerSkill, draft.skills[s] + Math.max(0, c.poolLeft[cat.key])), s)}</td>
        <td><button type="button" class="focus ${focused ? "on" : ""}" data-focus="${s}" aria-pressed="${focused}" ${canFocus ? "" : "disabled"}>${focused ? "Focus +2" : "Focus"}</button></td>
        <td class="num">${c.skillTotals[s]}</td>
      </tr>`;
    }).join("");
    return `<div class="cat-block">
      <h3>${cat.name} <span class="pool">${c.pools[cat.key]} ${c.pools[cat.key] === 1 ? "point" : "points"}</span> ${c.pools[cat.key] ? counter(c.poolLeft[cat.key], "") : ""}</h3>
      <div class="table-scroll"><table class="tbl"><tbody>${rows}</tbody></table></div>
    </div>`;
  }).join("");
  const skills = `
  <section class="step" aria-labelledby="s3">
    <h2 id="s3"><span class="no">03</span> Skills <span class="counter ${c.focusLeft === 0 ? "done" : ""}">${draft.focus.length} of ${RULES.focusLimit} focus</span></h2>
    <p class="hint">Your Career gives points per category: its weight times your level, rounded down. A skill can hold up to your level in points. Choose ${RULES.focusLimit} Focus skills for +${RULES.focusBonus} each. Points or Focus unlock that skill's educations.</p>
    ${draft.career ? cats : `<p class="empty-step">Choose a Career first. It decides how many skill points you get.</p>`}
  </section>`;

  const slotSelects = Array.from({ length: c.eduSlots }, (_, i) => {
    const opts = c.eduOptions[i];
    const groups = new Map<string, typeof opts>();
    opts.forEach((e) => groups.set(e.skill, [...(groups.get(e.skill) ?? []), e]));
    const sel = draft.educations[i] ?? "";
    const chosen = data.educations.find((e) => e.name === sel);
    return `<label class="field" for="edu-${i}"><span>Edu ${i + 3}</span>
      <select id="edu-${i}" data-edu="${i}" ${opts.length ? "" : "disabled"}>
        <option value="">${opts.length ? "Choose an education" : "Put points or Focus into a skill first"}</option>
        ${[...groups].map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((e) => `<option value="${esc(e.name)}" ${e.name === sel ? "selected" : ""}>${esc(e.name)} (${esc(e.tag)} +1)</option>`).join("")}</optgroup>`).join("")}
      </select>
      <small>${chosen ? `<b>${esc(chosen.tag)} +1.</b> ${esc(chosen.desc)}` : ""}</small></label>`;
  }).join("");
  const educations = `
  <section class="step" aria-labelledby="s4">
    <h2 id="s4"><span class="no">04</span> Educations <span class="counter">${c.eduSlots} extra ${c.eduSlots === 1 ? "slot" : "slots"}</span></h2>
    <p class="hint">Your Bio and Career are your first two educations. You get extra slots equal to your Curiosity modifier plus 1, up to ${RULES.maxExtraEducations}. Each one adds +1 to a specialty.</p>
    <div class="fixed-edu">
      <div><span>Edu 1 · Bio</span><b>${esc(draft.bio || "Not chosen")}</b></div>
      <div><span>Edu 2 · Career</span><b>${esc(draft.career || "Not chosen")}</b></div>
    </div>
    <div class="pickers">${slotSelects}</div>
  </section>`;

  const review = `
  <section class="step review ${c.complete ? "ok" : ""}" aria-labelledby="s5" aria-live="polite">
    <h2 id="s5"><span class="no">05</span> Review</h2>
    ${c.complete
      ? `<p><span class="stamp ok">Approved</span> This file is complete. Export it from the panel beside the sheet.</p>`
      : `<p>Before this file can be approved:</p><ul>${c.problems.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`}
  </section>`;

  // Keep focus on the same control across re-renders.
  const active = document.activeElement as HTMLElement | null;
  const activeKey = active?.id || (active?.dataset.step ? `step:${active.dataset.step}:${active.dataset.d}` : active?.dataset.focus ? `focus:${active.dataset.focus}` : "");
  const sel = active instanceof HTMLInputElement ? [active.selectionStart, active.selectionEnd] : null;
  $("form").innerHTML = identity + stats + skills + educations + review;
  if (activeKey) {
    let el: HTMLElement | null = null;
    if (activeKey.startsWith("step:")) { const [, id, d] = activeKey.split(":"); el = document.querySelector(`[data-step="${id}"][data-d="${d}"]`); }
    else if (activeKey.startsWith("focus:")) el = document.querySelector(`[data-focus="${activeKey.slice(6)}"]`);
    else el = document.getElementById(activeKey);
    if (el && !(el as HTMLButtonElement).disabled) {
      el.focus({ preventScroll: true });
      if (sel && el instanceof HTMLInputElement) el.setSelectionRange(sel[0], sel[1]);
    }
  }
}

/* ---------- sheet preview (also what PNG and PDF export) ---------- */

function renderSheet() {
  const c = calc;
  const d = draft;
  const today = new Date();
  const stamp = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
  const fileNo = d.name.trim() ? String([...d.name].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 9000, 7) + 1000) : "----";
  const tagList = Object.entries(c.tags).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const vitals: [string, string][] = [
    ["HP", `${fmt(c.hp)}`], ["Regen", fmt(c.regen)], ["Sanity", String(c.sanity)], ["Rads", String(c.rads)],
    ["Speed", String(c.speed)], ["Defense", String(c.defense)], ["Sight", String(c.sight)], ["Hearing", String(c.hearing)],
    ["Carry", String(c.carry)], ["Luck", String(c.luck)],
  ];
  $("sheet").innerHTML = `
    <div class="sh-tab">Personnel file no. ${fileNo}</div>
    <span class="stamp sh-stamp ${c.complete ? "ok" : ""}">${c.complete ? "Approved" : "Incomplete"}</span>
    <header class="sh-head">
      <div class="sh-name">${esc(d.name.trim() || "Unnamed subject")}</div>
      <div class="sh-ident">
        <span><i>Level</i>${clampLevel(d.level)}</span>
        <span><i>Kindred</i>${esc(d.kindred || "—")}</span>
        <span><i>Bio</i>${esc(d.bio || "—")}</span>
        <span><i>Career</i>${esc(d.career || "—")}</span>
      </div>
    </header>
    <div class="sh-grid">
      <section class="sh-box">
        <h4>Stats</h4>
        <dl class="sh-stats">${STATS.map((s) => `<div><dt>${s}</dt><dd>${c.statTotals[s]}<small>(${c.statMods[s]})</small></dd></div>`).join("")}</dl>
      </section>
      <section class="sh-box">
        <h4>Vitals</h4>
        <dl class="sh-vitals">${vitals.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
      </section>
      <section class="sh-box">
        <h4>Body · HP</h4>
        <dl class="sh-vitals">${c.limbs.map(([k, v]) => `<div><dt>${k}</dt><dd>${fmt(v)}</dd></div>`).join("")}</dl>
      </section>
      <section class="sh-box">
        <h4>Resistances</h4>
        <dl class="sh-vitals">
          <div><dt>Physical</dt><dd>${pct(c.resist.physical)}</dd></div>
          <div><dt>Elemental</dt><dd>${pct(c.resist.elemental)}</dd></div>
          <div><dt>Explosion</dt><dd>${pct(c.resist.explosion)}</dd></div>
          <div><dt>Radiation</dt><dd>${pct(c.resist.radiation)}</dd></div>
        </dl>
      </section>
      <section class="sh-box span2">
        <h4>Skills</h4>
        <div class="sh-skills">${CATEGORIES.map((cat) => `
          <div><h5>${cat.name}</h5>${cat.skills.map((s) => `<p class="${c.skillTotals[s] ? "" : "zero"}"><span>${s}${d.focus.includes(s) ? ' <b class="f">F</b>' : ""}</span><span>${c.skillTotals[s]}</span></p>`).join("")}</div>`).join("")}
        </div>
        ${tagList.length ? `<p class="sh-tags">${tagList.map(([t, n]) => `<span>${esc(t)} +${n}</span>`).join("")}</p>` : ""}
      </section>
      <section class="sh-box span2">
        <h4>Educations</h4>
        <ol class="sh-edu">${c.educationList.map((e) => `<li><span>${esc(e.slot)}</span><b>${esc(e.name || "—")}</b>${e.edu?.desc ? `<small>${esc(e.edu.desc)}</small>` : ""}</li>`).join("")}</ol>
      </section>
      <section class="sh-box span2">
        <h4>Equipment</h4>
        <p class="sh-equip">${RULES.handSlots.map((s) => `<span><i>${s}</i>Fist</span>`).join("")}${[...RULES.armorSlots, ...RULES.clothingSlots].map((s) => `<span><i>${s}</i>Empty</span>`).join("")}</p>
      </section>
    </div>
    <footer class="sh-foot"><span>Dreamland Archive · Form DL-7</span><span>Filed ${stamp}</span></footer>`;
}

/* ---------- update loop ---------- */

function update(next: Draft, opts: { form?: boolean } = {}) {
  draft = tidy(next, data);
  calc = compute(draft, data);
  if (opts.form !== false) renderForm();
  else {
    // Name typing: refresh only the review list, leave the form alone so typing isn't interrupted.
    const review = document.querySelector(".step.review");
    if (review) {
      review.classList.toggle("ok", calc.complete);
      review.innerHTML = `<h2 id="s5"><span class="no">05</span> Review</h2>` + (calc.complete
        ? `<p><span class="stamp ok">Approved</span> This file is complete. Export it from the panel beside the sheet.</p>`
        : `<p>Before this file can be approved:</p><ul>${calc.problems.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`);
    }
  }
  renderSheet();
  const csvBtn = document.querySelector<HTMLButtonElement>('[data-export="csv"]')!;
  const copyBtn = document.querySelector<HTMLButtonElement>('[data-export="copy"]')!;
  csvBtn.disabled = copyBtn.disabled = !calc.complete;
  $("export-note").textContent = calc.complete
    ? "CSV and Copy row match the save tab's columns. Paste the row under the last character in save."
    : "Finish the review list to unlock the CSV for the sheet. Image, PDF and Save file work any time.";
  saveDraft();
}

function wire() {
  const form = $("form");
  form.addEventListener("input", (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.id === "name") update({ ...draft, name: t.value }, { form: false });
  });
  form.addEventListener("change", (ev) => {
    const t = ev.target as HTMLSelectElement;
    if (t.id === "kindred" || t.id === "bio" || t.id === "career") update({ ...draft, [t.id]: t.value });
    else if (t.id === "bonus5" || t.id === "bonus10") update({ ...draft, [t.id]: t.value as Stat | "" });
    else if (t.dataset.edu) {
      const educations = [...draft.educations];
      educations[Number(t.dataset.edu)] = t.value;
      update({ ...draft, educations });
    }
  });
  form.addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b || b.disabled) return;
    if (b.id === "roll-name") {
      const name = randomName(data.names, nameStyle);
      if (name) update({ ...draft, name });
      return;
    }
    if (b.dataset.nameStyle) {
      nameStyle = b.dataset.nameStyle as NameStyle;
      try { localStorage.setItem(NAME_STYLE_KEY, nameStyle); } catch { /* ignore */ }
      renderForm();
      return;
    }
    if (b.dataset.step) {
      const id = b.dataset.step;
      const delta = Number(b.dataset.d);
      if (id === "level") update({ ...draft, level: clampLevel(draft.level + delta) });
      else if (id.startsWith("stat-")) {
        const s = id.slice(5) as Stat;
        update({ ...draft, stats: { ...draft.stats, [s]: draft.stats[s] + delta } });
      } else if (id.startsWith("skill-")) {
        const s = id.slice(6);
        update({ ...draft, skills: { ...draft.skills, [s]: draft.skills[s] + delta } });
      }
    } else if (b.dataset.focus) {
      const s = b.dataset.focus;
      const focus = draft.focus.includes(s) ? draft.focus.filter((f) => f !== s) : [...draft.focus, s];
      update({ ...draft, focus });
    }
  });
  form.addEventListener("submit", (ev) => ev.preventDefault());

  // Keeps a name the player typed; otherwise rolls one from the calc tab.
  $("randomize").addEventListener("click", () => update(randomDraft(data, draft.level, draft.name.trim() ? draft.name : randomName(data.names, nameStyle))));
  $("new").addEventListener("click", () => {
    const btn = $("new");
    if (btn.dataset.confirm !== "1") {
      btn.dataset.confirm = "1";
      btn.textContent = "Clear this file?";
      setTimeout(() => { btn.dataset.confirm = ""; btn.textContent = "New file"; }, 3000);
      return;
    }
    btn.dataset.confirm = "";
    btn.textContent = "New file";
    update(emptyDraft());
  });
  $<HTMLInputElement>("load").addEventListener("change", async (ev) => {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const { readJson } = await import("./export");
      update({ ...emptyDraft(), ...(await readJson(file)) });
      note(`Loaded ${file.name}.`);
    } catch (err) {
      note(err instanceof Error ? err.message : "That file couldn't be read.");
    }
  });
  $("theme").addEventListener("click", () => setTheme(currentTheme() === "dark" ? "light" : "dark"));

  document.querySelector(".exports")!.addEventListener("click", async (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>("[data-export]");
    if (!b || b.disabled) return;
    const kind = b.dataset.export;
    const label = b.textContent;
    try {
      const { exportCsv, exportJson, exportPdf, exportPng, saveRowText } = await import("./export");
      if (kind === "csv") exportCsv(draft, data);
      else if (kind === "json") exportJson(draft);
      else if (kind === "copy") {
        await navigator.clipboard.writeText(saveRowText(draft, data));
        note("Row copied. In the save tab, click column A of the first empty row and paste.");
      } else if (kind === "png" || kind === "pdf") {
        b.disabled = true;
        b.textContent = "Rendering…";
        const sheet = $("sheet");
        sheet.classList.add("exporting");
        await (kind === "png" ? exportPng(draft, sheet) : exportPdf(draft, sheet));
        sheet.classList.remove("exporting");
      }
    } catch (err) {
      note(kind === "copy" ? "Your browser blocked copying. Use the CSV button instead." : `Export failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      $("sheet").classList.remove("exporting");
      b.textContent = label;
      b.disabled = (kind === "csv" || kind === "copy") && !calc.complete;
    }
  });
}

function note(msg: string) {
  $("export-note").textContent = msg;
}

async function boot() {
  setTheme(currentTheme());
  try {
    const res = await loadRules();
    data = res.data;
    $("status").innerHTML = res.snapshotTabs.length
      ? `<div>Couldn't reach ${res.snapshotTabs.join(", ")} in the sheet, using the bundled copy for ${res.snapshotTabs.length === 1 ? "it" : "those"}.</div>`
      : `<div>Kindreds, Bios, Careers, Educations and names are live from the Dreamland sheet.</div>`;
  } catch (err) {
    $("form").innerHTML = `<p class="empty">The personnel forms couldn't load: ${esc(err instanceof Error ? err.message : String(err))}. Refresh to try again.</p>`;
    return;
  }
  wire();
  update(loadDraft() ?? emptyDraft());
}

boot();
