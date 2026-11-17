export type Line = { id: number; kind: "title" | "scene" | "dialogue"; speaker: string; text: string; filename: string };
const japanese = /[\u3040-\u30ff\u3400-\u9fff]/;

export function parseScript(input: string): Line[] {
  const lines: Line[] = [];
  const rows = input.replace(/^\uFEFF/, "").split(/\r?\n/);
  const header = rows.findIndex(row => /^\s*speaker\s*\t\s*ja\s*\t\s*vi\s*$/i.test(row));
  if (header >= 0) {
    const title = rows.slice(0, header).map(row => row.match(/^\s*#\s*title\s*:\s*(.+?)\s*$/i)?.[1]).find(Boolean);
    if (title && japanese.test(title)) lines.push({ id: lines.length, kind: "title", speaker: "Người dẫn", text: title, filename: "title.wav" });
    for (const row of rows.slice(header + 1)) {
      if (!row.trim() || /^\s*#/.test(row)) continue;
      const [speaker, ja] = row.split("\t");
      if (!speaker?.trim() || !ja?.trim() || !japanese.test(ja)) continue;
      const number = lines.filter(line => line.kind === "dialogue").length + 1;
      lines.push({ id: lines.length, kind: "dialogue", speaker: speaker.trim(), text: ja.trim(), filename: `s${String(number).padStart(2, "0")}.wav` });
    }
    return lines;
  }
  let number = 0;
  for (const raw of rows) {
    const clean = raw.trim().replace(/^#{1,6}\s*/, "");
    if (!clean) continue;
    const dialogue = clean.match(/^(?:\d+\s*[.．、)）]\s*)?([^：:]{1,30})[：:]\s*(.+)$/);
    const isScene = /^(場面|シーン|scene)\s*[①②③④⑤⑥⑦⑧⑨⑩\d０-９]/i.test(clean);
    if (dialogue && !isScene && japanese.test(dialogue[2])) lines.push({ id: lines.length, kind: "dialogue", speaker: dialogue[1].trim(), text: dialogue[2].trim(), filename: `s${String(++number).padStart(2, "0")}.wav` });
    else if (isScene) lines.push({ id: lines.length, kind: "scene", speaker: "Người dẫn", text: clean, filename: "" });
    else if (japanese.test(clean) && !lines.some(line => line.kind === "title")) lines.push({ id: lines.length, kind: "title", speaker: "Người dẫn", text: clean, filename: "title.wav" });
  }
  return lines;
}
