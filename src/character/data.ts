import Papa from "papaparse";
import { CONFIG } from "../config";
import type { Bio, Career, Education, Kindred, NameLists, RuleData } from "./rules";

type Row = Record<string, string>;

/** Live CSV link for one tab of the Dreamland Brain sheet. */
const tabUrl = (tab: string) =>
  `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(tab)}`;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const text = await res.text();
  if (/^\s*<(!doctype|html)/i.test(text)) throw new Error("got a web page instead of CSV");
  return text;
}

const parse = (csv: string) =>
  Papa.parse<Row>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  }).data;

const v = (r: Row, k: string) => String(r[k] ?? "").trim();
const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

/** Loads one tab live, falling back to the bundled copy. Returns rows and whether it was live. */
async function loadTab(tab: string, isValid: (rows: Row[]) => boolean): Promise<{ rows: Row[]; live: boolean }> {
  try {
    const rows = parse(await fetchText(tabUrl(tab)));
    if (isValid(rows)) return { rows, live: true };
  } catch { /* fall through to snapshot */ }
  const rows = parse(await fetchText(new URL(`data/${tab}.csv`, document.baseURI).toString()));
  return { rows, live: false };
}

export interface RuleLoad { data: RuleData; liveTabs: string[]; snapshotTabs: string[]; }

export async function loadRules(): Promise<RuleLoad> {
  const has = (...keys: string[]) => (rows: Row[]) => rows.length > 0 && keys.every((k) => k in rows[0]);
  const [kind, bio, emp, edu, calc] = await Promise.all([
    loadTab("db.kind", has("name", "resist")),
    loadTab("db.bio", has("name", "desc")),
    loadTab("db.emp", has("name", "combat", "knowledge", "social", "exploration")),
    loadTab("db.education", has("name", "type", "skill", "tag")),
    // Names are a nice-to-have: if both the live tab and the bundled copy fail, the creator still works.
    loadTab("calc", has("surname")).catch(() => ({ rows: [] as Row[], live: false })),
  ]);

  const kindreds: Kindred[] = kind.rows.filter((r) => v(r, "name")).map((r) => {
    const parts = v(r, "resist").split(",").map(num);
    return {
      name: v(r, "name"), type: v(r, "type"), desc: v(r, "desc"),
      resist: [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 0],
    };
  });
  // db.bio's short summary column has no header in the sheet; gviz names it "" or "summary".
  const bios: Bio[] = bio.rows.filter((r) => v(r, "name")).map((r) => ({
    name: v(r, "name"), type: v(r, "type"), desc: v(r, "desc"), summary: v(r, "summary") || v(r, ""),
  }));
  const careers: Career[] = emp.rows.filter((r) => v(r, "name")).map((r) => ({
    name: v(r, "name"),
    mission: v(r, "mission"),
    weights: { combat: num(v(r, "combat")), knowledge: num(v(r, "knowledge")), social: num(v(r, "social")), exploration: num(v(r, "exploration")) },
  }));
  const educations: Education[] = edu.rows.filter((r) => v(r, "name")).map((r) => ({
    name: v(r, "name"), type: v(r, "type"), skill: v(r, "skill"), tag: v(r, "tag"), desc: v(r, "desc"),
  }));

  // calc: A = All Names, B = Male First, C = Female First, D = Surname. Columns have different lengths.
  const col = (k: string) => [...new Set(calc.rows.map((r) => v(r, k)).filter(Boolean))];
  const male = col("male first");
  const female = col("female first");
  const allCol = col("all names");
  const names: NameLists = {
    male,
    female,
    all: allCol.length ? allCol : [...new Set([...male, ...female])],
    surnames: col("surname"),
  };

  const tabs = { "db.kind": kind.live, "db.bio": bio.live, "db.emp": emp.live, "db.education": edu.live, calc: calc.live };
  return {
    data: { kindreds, bios, careers, educations, names },
    liveTabs: Object.entries(tabs).filter(([, l]) => l).map(([t]) => t),
    snapshotTabs: Object.entries(tabs).filter(([, l]) => !l).map(([t]) => t),
  };
}
