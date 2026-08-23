import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DATA_DIR = path.join(ROOT_DIR, "data");
export const IMPORTS_DIR = path.join(DATA_DIR, "imports");
export const PROCESSED_DIR = path.join(DATA_DIR, "processed");
export const DB_PATH = path.join(DATA_DIR, "deusa_analytics.db");
export const SUMMARY_PATH = path.join(ROOT_DIR, "src/data/commercial-comparison-summary.json");

export function ensureDataDirs() {
  fs.mkdirSync(IMPORTS_DIR, { recursive: true });
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(SUMMARY_PATH), { recursive: true });
}

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeCnpj(value) {
  return String(value ?? "").replace(/\D/g, "");
}

export function asString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(
    String(value ?? "")
      .replace(/\./g, "")
      .replace(",", "."),
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

export function firstPresent(row, aliases) {
  const keys = Object.keys(row);
  const normalizedKeyMap = new Map(keys.map((key) => [normalizeText(key), key]));

  for (const alias of aliases) {
    const realKey = normalizedKeyMap.get(normalizeText(alias));
    if (
      realKey &&
      row[realKey] !== undefined &&
      row[realKey] !== null &&
      String(row[realKey]).trim() !== ""
    ) {
      return row[realKey];
    }
  }

  return "";
}

export function listImportFiles() {
  ensureDataDirs();
  return fs
    .readdirSync(IMPORTS_DIR)
    .filter((file) => [".csv", ".json", ".xlsx"].includes(path.extname(file).toLowerCase()))
    .map((file) => path.join(IMPORTS_DIR, file));
}

export function inferFileKind(filePath) {
  const name = path.basename(filePath).toLowerCase();
  if (name.includes("venda") || name.includes("sales")) return "sales";
  if (name.includes("extern") || name.includes("estabelec") || name.includes("prospect"))
    return "external";
  if (name.includes("cliente") || name.includes("customer") || name.includes("deusa"))
    return "customers";
  return "unknown";
}

export function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
