import fs from "node:fs";
import path from "node:path";
import { readSheet } from "read-excel-file/node";

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if ((char === "," || char === ";") && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);
  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => String(header ?? "").trim());
  return rows.slice(1).map((values) =>
    headers.reduce((acc, header, index) => {
      acc[header || `coluna_${index + 1}`] = values[index] ?? "";
      return acc;
    }, {}),
  );
}

export async function readRowsFromFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".json") {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.data)) return parsed.data;
    if (Array.isArray(parsed.items)) return parsed.items;
    throw new Error("JSON precisa ser um array ou conter data/items como array.");
  }

  if (extension === ".csv") {
    return parseCsv(fs.readFileSync(filePath, "utf8"));
  }

  if (extension === ".xlsx") {
    const rows = await readSheet(filePath);
    if (rows.length === 0) return [];

    const headers = rows[0].map((header, index) => String(header ?? "").trim() || `coluna_${index + 1}`);
    return rows.slice(1).map((values) =>
      headers.reduce((acc, header, index) => {
        const value = values[index];
        acc[header] = value instanceof Date ? value.toISOString() : value ?? "";
        return acc;
      }, {}),
    );
  }

  throw new Error(`Formato nao suportado: ${extension}`);
}
