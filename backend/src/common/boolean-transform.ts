import type { TransformFnParams } from "class-transformer";

export function transformOptionalBoolean({ obj, key }: TransformFnParams): unknown {
  const value = (obj as Record<string, unknown>)[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return value;
}
