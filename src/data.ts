import Papa from "papaparse";
import { CONFIG } from "./config";
import { DDate, parseDate } from "./calendar";

export type Visibility = "public" | "spoiler" | "gm";

export interface TimelineEvent {
  id: string;
  rank: number;
  title: string;
  category: string;
  start: DDate;
  end: DDate | null;
  /** True when date_end says "ongoing" (still alive / still running at the end of the timeline). */
  ongoing: boolean;
  /** Last day covered, for overlap math. Equals start for single-day events. */
  endIdx: number;
  branch: string;
  forksFrom: string | null;
  description: string;
  related: string[];
  bible: string;
  visibility: Visibility;
  /** CSS color for the category, e.g. var(--cat-war). */
  color: string;
  searchText: string;
}

export interface RowProblem {
  row: number; // spreadsheet row number, header = 1
  title: string;
  message: string;
}

export interface LoadResult {
  events: TimelineEvent[];
  problems: RowProblem[];
  source: "live" | "snapshot";
  sourceError?: string;
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

async function fetchCsv(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const text = await res.text();
  if (/^\s*<!doctype html|^\s*<html/i.test(text)) {
    throw new Error("The sheet link returned a web page instead of CSV. Check that the sheet is shared or published.");
  }
  return text;
}

export async function loadTimeline(): Promise<LoadResult> {
  let csv: string;
  let source: LoadResult["source"] = "live";
  let sourceError: string | undefined;
  try {
    csv = await fetchCsv(CONFIG.sheetCsvUrl);
  } catch (err) {
    sourceError = err instanceof Error ? err.message : String(err);
    source = "snapshot";
    csv = await fetchCsv(new URL(CONFIG.fallbackCsvPath, document.baseURI).toString());
  }
  return { ...normalize(csv), source, sourceError };
}

function cell(row: Record<string, string>, ...names: string[]): string {
  for (const n of names) {
    const v = row[n];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

const splitList = (s: string) => s.split(/[;\n]/).map((x) => x.trim()).filter(Boolean);

export function normalize(csv: string): { events: TimelineEvent[]; problems: RowProblem[] } {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  const problems: RowProblem[] = [];
  const events: TimelineEvent[] = [];
  const usedIds = new Set<string>();

  parsed.data.forEach((row, i) => {
    const rowNum = i + 2;
    const title = cell(row, "title");
    const begin = cell(row, "date_begin", "start");
    if (!title && !begin) return; // blank row
    if (!title) {
      problems.push({ row: rowNum, title: "(untitled)", message: "Missing a title." });
      return;
    }
    let start: DDate | null;
    let end: DDate | null = null;
    const endRaw = cell(row, "date_end", "end");
    const ongoing = /^ongoing$/i.test(endRaw);
    try {
      start = parseDate(begin);
      if (!start) throw new Error("Missing date_begin.");
      if (!ongoing) end = parseDate(endRaw);
      if (end && end.idx < start.idx) throw new Error("date_end is before date_begin.");
    } catch (err) {
      problems.push({ row: rowNum, title, message: err instanceof Error ? err.message : String(err) });
      return;
    }

    let id = slugify(cell(row, "id") || title) || `row-${rowNum}`;
    if (usedIds.has(id)) {
      let n = 2;
      while (usedIds.has(`${id}-${n}`)) n++;
      problems.push({ row: rowNum, title, message: `Shares its id with another entry, so it was renamed ${id}-${n}. Give it a unique id.` });
      id = `${id}-${n}`;
    }
    usedIds.add(id);

    const category = cell(row, "category") || "Uncategorized";
    const visRaw = cell(row, "visibility").toLowerCase();
    const visibility: Visibility = visRaw === "spoiler" || visRaw === "gm" ? visRaw : "public";
    const description = cell(row, "description");
    const branch = cell(row, "branch") || "main";

    events.push({
      id,
      rank: Number(cell(row, "rank")) || 0,
      title,
      category,
      start,
      end,
      ongoing,
      endIdx: end ? end.idx : start.idx,
      branch,
      forksFrom: cell(row, "forks_from") ? slugify(cell(row, "forks_from")) : null,
      description,
      related: splitList(cell(row, "related")).map(slugify),
      bible: cell(row, "bible"),
      visibility,
      color: `var(${CONFIG.categoryColors[category] ?? "--accent"})`,
      searchText: [title, category, branch, String(start.y), end ? String(end.y) : "", description].join(" ").toLowerCase(),
    });
  });

  // Flag links that point nowhere so typos get caught in the sheet.
  const ids = new Set(events.map((e) => e.id));
  for (const e of events) {
    for (const r of e.related) {
      if (!ids.has(r)) problems.push({ row: 0, title: e.title, message: `Related entry "${r}" doesn't match any event id or title.` });
    }
    if (e.forksFrom && !ids.has(e.forksFrom)) {
      problems.push({ row: 0, title: e.title, message: `forks_from "${e.forksFrom}" doesn't match any event id or title.` });
    }
  }

  events.sort((a, b) => a.start.idx - b.start.idx || a.rank - b.rank);
  return { events, problems };
}
