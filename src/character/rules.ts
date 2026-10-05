// Dreamland character rules, mirrored from the Dreamland Brain workbook (gen, control, save.handler).
// See CharacterGeneration.md for where each number comes from.

export const STATS = ["Power", "Energy", "Reflex", "Fortune", "Ego", "Curiosity", "Tact"] as const;
export type Stat = (typeof STATS)[number];

export const CATEGORIES = [
  { name: "Combat", key: "combat", skills: ["Martial", "Ballistic", "Advanced"] },
  { name: "Knowledge", key: "knowledge", skills: ["Natural", "Applied", "Mythos"] },
  { name: "Social", key: "social", skills: ["Moxie", "Influence", "Vigilance"] },
  { name: "Exploration", key: "exploration", skills: ["Entry", "Intrusion", "Transport"] },
] as const;
export type CategoryKey = (typeof CATEGORIES)[number]["key"];
export const SKILLS = CATEGORIES.flatMap((c) => c.skills as readonly string[]);

export const RULES = {
  statPoints: 28,
  statMinPoints: 0,
  statMaxPoints: 8,
  statBase: 2,
  focusBonus: 2,
  focusLimit: 2,
  maxExtraEducations: 4,
  maxLevel: 20,
  baseHp: 20,
  /** Head, Torso, Arm L, Arm R, Leg L, Leg R, Feet. Feet set to 0.25 for now (sheet values disagree). */
  limbs: [
    ["Head", 0.25], ["Torso", 0.5], ["Arm L", 0.35], ["Arm R", 0.35],
    ["Leg L", 0.45], ["Leg R", 0.45], ["Feet", 0.25],
  ] as [string, number][],
  handSlots: ["Hand L", "Hand R"],
  armorSlots: ["Head", "Chest", "Arm", "Leg", "Foot"],
  clothingSlots: ["Hat", "Coat", "Shirt", "Pants", "Shoes"],
};

/* ---------- lookup tables (loaded from the sheet) ---------- */

export interface Kindred { name: string; type: string; desc: string; resist: [number, number, number, number]; }
export interface Bio { name: string; type: string; summary: string; desc: string; }
export interface Career { name: string; mission: string; weights: Record<CategoryKey, number>; }
export interface Education { name: string; type: "Bio" | "Career" | "Skill" | string; skill: string; tag: string; desc: string; }

export interface NameLists { male: string[]; female: string[]; all: string[]; surnames: string[]; }
export type NameStyle = "any" | "male" | "female";

export interface RuleData {
  kindreds: Kindred[];
  bios: Bio[];
  careers: Career[];
  educations: Education[];
  /** First names and surnames from the calc tab. Empty lists if the tab can't be read. */
  names: NameLists;
}

/** First name + surname from Nat's lists in the calc tab. Returns "" if there are no names to pick from. */
export function randomName(names: NameLists, style: NameStyle = "any"): string {
  const firsts = style === "male" && names.male.length ? names.male : style === "female" && names.female.length ? names.female : names.all;
  if (!firsts.length || !names.surnames.length) return "";
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  return `${pick(firsts)} ${pick(names.surnames)}`;
}

/* ---------- a character in progress ---------- */

export interface Draft {
  name: string;
  level: number;
  kindred: string;
  bio: string;
  career: string;
  /** Points spent per stat, 0-8 each, 28 total. */
  stats: Record<Stat, number>;
  /** Stat that gets +1 at level 5 and level 10. */
  bonus5: Stat | "";
  bonus10: Stat | "";
  /** Points per skill. */
  skills: Record<string, number>;
  focus: string[];
  /** Extra educations, Edu 3 to Edu 6. */
  educations: string[];
}

export function emptyDraft(): Draft {
  return {
    name: "",
    level: 1,
    kindred: "",
    bio: "",
    career: "",
    stats: Object.fromEntries(STATS.map((s) => [s, 0])) as Record<Stat, number>,
    bonus5: "",
    bonus10: "",
    skills: Object.fromEntries(SKILLS.map((s) => [s, 0])),
    focus: [],
    educations: [],
  };
}

/* ---------- calculations ---------- */

export const mod = (total: number) => Math.floor(total / 3);
const floorTo = (n: number, step: number) => Math.floor(n / step + 1e-9) * step;

export interface Computed {
  statTotals: Record<Stat, number>;
  statMods: Record<Stat, number>;
  statPointsLeft: number;
  pools: Record<CategoryKey, number>;
  poolLeft: Record<CategoryKey, number>;
  skillTotals: Record<string, number>;
  maxPerSkill: number;
  focusLeft: number;
  eduSlots: number;
  eduOptions: Education[][];
  tags: Record<string, number>;
  educationList: { slot: string; edu: Education | undefined; name: string }[];
  hp: number;
  limbs: [string, number][];
  regen: number;
  sanity: number;
  speed: number;
  defense: number;
  sight: number;
  hearing: number;
  carry: number;
  luck: number;
  rads: number;
  resist: { physical: number; elemental: number; explosion: number; radiation: number };
  problems: string[];
  complete: boolean;
}

export function compute(d: Draft, data: RuleData): Computed {
  const kindred = data.kindreds.find((k) => k.name === d.kindred);
  const career = data.careers.find((c) => c.name === d.career);
  const level = clampLevel(d.level);

  const statTotals = {} as Record<Stat, number>;
  const statMods = {} as Record<Stat, number>;
  for (const s of STATS) {
    let t = RULES.statBase + (d.stats[s] ?? 0);
    if (d.bonus5 === s && level >= 5) t += 1;
    if (d.bonus10 === s && level >= 10) t += 1;
    statTotals[s] = t;
    statMods[s] = mod(t);
  }
  const spent = STATS.reduce((a, s) => a + (d.stats[s] ?? 0), 0);
  const statPointsLeft = RULES.statPoints - spent;

  const pools = {} as Record<CategoryKey, number>;
  const poolLeft = {} as Record<CategoryKey, number>;
  for (const c of CATEGORIES) {
    pools[c.key] = career ? Math.floor(career.weights[c.key] * level + 1e-9) : 0;
    poolLeft[c.key] = pools[c.key] - c.skills.reduce((a, s) => a + (d.skills[s] ?? 0), 0);
  }
  const skillTotals: Record<string, number> = {};
  for (const s of SKILLS) skillTotals[s] = (d.skills[s] ?? 0) + (d.focus.includes(s) ? RULES.focusBonus : 0);

  // Educations: Curiosity mod + 1 extra slots, capped at 4. Choices come from skills with points or focus.
  const eduSlots = Math.min(RULES.maxExtraEducations, statMods.Curiosity + 1);
  const viable = new Set(SKILLS.filter((s) => (d.skills[s] ?? 0) >= 1 || d.focus.includes(s)));
  const skillEdus = data.educations.filter((e) => e.type === "Skill" && viable.has(e.skill));
  const eduOptions: Education[][] = [];
  for (let i = 0; i < eduSlots; i++) {
    const others = new Set(d.educations.filter((_, j) => j !== i));
    eduOptions.push(skillEdus.filter((e) => !others.has(e.name)));
  }
  const tags: Record<string, number> = {};
  for (const name of d.educations.slice(0, eduSlots)) {
    const e = data.educations.find((x) => x.name === name);
    if (e?.tag) tags[e.tag] = (tags[e.tag] ?? 0) + 1;
  }
  const findEdu = (n: string) => data.educations.find((x) => x.name === n);
  const educationList = [
    { slot: "Edu 1 · Bio", name: d.bio, edu: findEdu(d.bio) },
    { slot: "Edu 2 · Career", name: d.career, edu: findEdu(d.career) },
    ...Array.from({ length: eduSlots }, (_, i) => ({ slot: `Edu ${i + 3}`, name: d.educations[i] ?? "", edu: findEdu(d.educations[i] ?? "") })),
  ];

  // Derived stats (control tab). HP uses the Energy total, not its modifier.
  const hp = RULES.baseHp + level * statTotals.Energy;
  const limbs = RULES.limbs.map(([n, f]) => [n, floorTo(f * hp, 0.25)] as [string, number]);
  const regen = hp / 10 + (kindred?.name === "Fish" ? 5 : 0);
  const sanity = 1 + statMods.Ego + statMods.Curiosity + statMods.Tact;
  const speed = 4 + statMods.Reflex;
  const defense = 4 + statMods.Reflex + level;
  const sight = 6 + statMods.Tact;
  const hearing = 6 + statMods.Tact * 2;
  const carry = 50 + statMods.Power * 10 + level * 10;
  const luck = statMods.Fortune;
  const r = kindred?.resist ?? [0, 0, 0, 0];
  const resist = { physical: r[0], elemental: r[1], explosion: r[2], radiation: r[3] };

  // Validation
  const problems: string[] = [];
  if (!d.name.trim()) problems.push("Give the character a name.");
  if (!kindred) problems.push("Choose a Kindred.");
  if (!data.bios.some((b) => b.name === d.bio)) problems.push("Choose a Bio.");
  if (!career) problems.push("Choose a Career.");
  if (statPointsLeft > 0) problems.push(`Spend ${statPointsLeft} more stat ${statPointsLeft === 1 ? "point" : "points"}.`);
  if (statPointsLeft < 0) problems.push(`Remove ${-statPointsLeft} stat ${statPointsLeft === -1 ? "point" : "points"}.`);
  if (level >= 5 && !d.bonus5) problems.push("Pick a stat for the level 5 bonus.");
  if (level >= 10 && !d.bonus10) problems.push("Pick a stat for the level 10 bonus.");
  for (const c of CATEGORIES) {
    if (poolLeft[c.key] > 0) problems.push(`Spend ${poolLeft[c.key]} more ${c.name} skill ${poolLeft[c.key] === 1 ? "point" : "points"}.`);
    if (poolLeft[c.key] < 0) problems.push(`${c.name} skills are over by ${-poolLeft[c.key]}.`);
  }
  if (d.focus.length < RULES.focusLimit) problems.push(`Choose ${RULES.focusLimit - d.focus.length} more Focus ${RULES.focusLimit - d.focus.length === 1 ? "skill" : "skills"}.`);
  if (d.focus.length > RULES.focusLimit) problems.push(`Only ${RULES.focusLimit} Focus skills are allowed.`);
  const picked = d.educations.slice(0, eduSlots).filter(Boolean).length;
  if (picked < eduSlots) problems.push(`Choose ${eduSlots - picked} more ${eduSlots - picked === 1 ? "education" : "educations"}.`);

  return {
    statTotals, statMods, statPointsLeft, pools, poolLeft, skillTotals, maxPerSkill: level,
    focusLeft: RULES.focusLimit - d.focus.length, eduSlots, eduOptions, tags, educationList,
    hp, limbs, regen, sanity, speed, defense, sight, hearing, carry, luck, rads: 100, resist,
    problems, complete: problems.length === 0,
  };
}

export const clampLevel = (n: number) => Math.max(1, Math.min(RULES.maxLevel, Math.round(Number(n) || 1)));

/**
 * Removes choices that are no longer allowed (after a career, level or Curiosity change):
 * skill points over the per-skill max, educations whose skill lost its points, extra edu slots.
 */
export function tidy(d: Draft, data: RuleData): Draft {
  const level = clampLevel(d.level);
  const next: Draft = { ...d, level, stats: { ...d.stats }, skills: { ...d.skills }, focus: d.focus.filter((f) => SKILLS.includes(f)).slice(0, RULES.focusLimit), educations: [...d.educations] };
  if (level < 5) next.bonus5 = "";
  if (level < 10) next.bonus10 = "";
  for (const s of STATS) next.stats[s] = Math.max(RULES.statMinPoints, Math.min(RULES.statMaxPoints, next.stats[s] ?? 0));
  for (const s of SKILLS) next.skills[s] = Math.max(0, Math.min(level, next.skills[s] ?? 0));
  // Trim each category back inside its pool.
  const career = data.careers.find((c) => c.name === next.career);
  for (const c of CATEGORIES) {
    let over = c.skills.reduce((a, s) => a + next.skills[s], 0) - (career ? Math.floor(career.weights[c.key] * level + 1e-9) : 0);
    for (const s of [...c.skills].reverse()) {
      while (over > 0 && next.skills[s] > 0) { next.skills[s]--; over--; }
    }
  }
  const c = compute(next, data);
  next.educations = next.educations.slice(0, c.eduSlots).map((name, i) => (c.eduOptions[i]?.some((e) => e.name === name) ? name : ""));
  return next;
}

/* ---------- random character (like the hidden randomizer tab) ---------- */

export function randomDraft(data: RuleData, level = 1, name = ""): Draft {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const d = emptyDraft();
  d.level = clampLevel(level);
  d.name = name;
  d.kindred = pick(data.kindreds)?.name ?? "";
  d.bio = pick(data.bios)?.name ?? "";
  d.career = pick(data.careers)?.name ?? "";
  let left = RULES.statPoints;
  while (left > 0) {
    const s = pick([...STATS]);
    if (d.stats[s] < RULES.statMaxPoints) { d.stats[s]++; left--; }
  }
  if (d.level >= 5) d.bonus5 = pick([...STATS]);
  if (d.level >= 10) d.bonus10 = pick([...STATS]);
  const career = data.careers.find((c) => c.name === d.career);
  for (const c of CATEGORIES) {
    let pool = career ? Math.floor(career.weights[c.key] * d.level + 1e-9) : 0;
    let guard = 100;
    while (pool > 0 && guard-- > 0) {
      const s = pick([...c.skills]);
      if (d.skills[s] < d.level) { d.skills[s]++; pool--; }
    }
  }
  const shuffled = [...SKILLS].sort(() => Math.random() - 0.5);
  d.focus = shuffled.slice(0, RULES.focusLimit);
  const c = compute(d, data);
  for (let i = 0; i < c.eduSlots; i++) {
    const opts = compute(d, data).eduOptions[i].filter((e) => !d.educations.includes(e.name));
    if (opts.length) d.educations[i] = pick(opts).name;
  }
  return d;
}

/* ---------- export rows ---------- */

/** Header and row in the exact column order of the `save` tab (A to AD). */
export function saveRow(d: Draft, data: RuleData): { header: string[]; row: (string | number)[] } {
  const c = compute(d, data);
  const header = ["Name", "Level", "Kindred", "Bio", "Career", ...STATS, ...SKILLS, "edu_1", "edu_2", "edu_3", "edu_4", "edu_5", "edu_6"];
  const edus = Array.from({ length: 4 }, (_, i) => (i < c.eduSlots ? d.educations[i] ?? "" : ""));
  const row = [
    d.name.trim(), clampLevel(d.level), d.kindred, d.bio, d.career,
    ...STATS.map((s) => c.statTotals[s]),
    ...SKILLS.map((s) => c.skillTotals[s]),
    d.bio, d.career, ...edus,
  ];
  return { header, row };
}
