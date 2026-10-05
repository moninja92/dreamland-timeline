import Papa from "papaparse";
import { toJpeg, toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { Draft, RuleData, saveRow } from "./rules";

const fileBase = (d: Draft) => (d.name.trim() || "dreamland-character").replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-").toLowerCase();

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** One row in the `save` tab's column order, with a header row. */
export function exportCsv(d: Draft, data: RuleData) {
  const { header, row } = saveRow(d, data);
  const csv = Papa.unparse({ fields: header, data: [row] });
  download(new Blob([csv + "\n"], { type: "text/csv" }), `${fileBase(d)}.csv`);
}

/** Tab-separated row without a header, ready to paste straight into the `save` tab. */
export function saveRowText(d: Draft, data: RuleData): string {
  return saveRow(d, data).row.join("\t");
}

export function exportJson(d: Draft) {
  const payload = { format: "dreamland-character", version: 1, savedAt: new Date().toISOString(), character: d };
  download(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `${fileBase(d)}.json`);
}

export async function readJson(file: File): Promise<Draft> {
  const parsed = JSON.parse(await file.text());
  const c = parsed?.character ?? parsed;
  if (!c || typeof c !== "object" || !("stats" in c) || !("skills" in c)) {
    throw new Error("This file isn't a Dreamland character save.");
  }
  return c as Draft;
}

async function renderSheet(node: HTMLElement): Promise<string> {
  const bg = getComputedStyle(node).backgroundColor || getComputedStyle(document.body).backgroundColor;
  // Fonts load from Google; skip embedding errors rather than failing the export.
  return toPng(node, { pixelRatio: 2, backgroundColor: bg, cacheBust: true });
}

export async function exportPng(d: Draft, node: HTMLElement) {
  const dataUrl = await renderSheet(node);
  const blob = await (await fetch(dataUrl)).blob();
  download(blob, `${fileBase(d)}.png`);
}

export async function exportPdf(d: Draft, node: HTMLElement) {
  // JPEG keeps the PDF small (a PNG at 2x makes a 10+ MB file).
  const bg = getComputedStyle(node).backgroundColor;
  const dataUrl = await toJpeg(node, { pixelRatio: 2, quality: 0.9, backgroundColor: bg, cacheBust: true });
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const scale = Math.min((pageW - margin * 2) / img.width, (pageH - margin * 2) / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const [r, g, b] = (getComputedStyle(node).backgroundColor.match(/\d+/g) ?? ["14", "17", "20"]).map(Number);
  pdf.setFillColor(r, g, b);
  pdf.rect(0, 0, pageW, pageH, "F");
  pdf.addImage(dataUrl, "JPEG", (pageW - w) / 2, margin, w, h);
  pdf.setProperties({ title: `${d.name || "Dreamland character"} · Personnel File` });
  pdf.save(`${fileBase(d)}.pdf`);
}
