/** New review form rules (docs/06 §3 and §13, docs/04 Scale). Pure, shared by both forms. */
import type { Scale } from "./data/types";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const NEW_PROJECT = "__new";

export type FieldError = { field: string; summary: string; message: string };

/** "v1", "v2"… the first name not used yet (case does not matter). */
export function nextVersionName(existing: string[]): string {
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()));
  let n = 1;
  while (taken.has(`v${n}`)) n++;
  return `v${n}`;
}

/** docs/04: suggest 2× when the image is wider than 2000 px, otherwise 1×. */
export function suggestScale(width: number): Scale {
  return width > 2000 ? 2 : 1;
}

/** "2.4 MB", "830 KB". */
export function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const TYPE_NAMES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/gif": "GIF",
  "image/svg+xml": "SVG",
  "image/heic": "HEIC",
  "image/heif": "HEIF",
  "image/tiff": "TIFF",
  "image/bmp": "BMP",
};

/** A readable name for a file type: "PDF", or the extension in capitals. */
export function fileTypeName(file: { name: string; type: string }): string {
  if (TYPE_NAMES[file.type]) return TYPE_NAMES[file.type]!;
  const extension = file.name.includes(".") ? file.name.split(".").pop()!.trim() : "";
  return extension ? extension.toUpperCase() : "file without a type";
}

export function isAcceptedType(type: string): boolean {
  return (ACCEPTED_TYPES as readonly string[]).includes(type);
}

const article = (word: string) => (/^[AEFHILMNORSX]/.test(word) ? "an" : "a");

/** The screenshot field: missing, wrong type (says which) or too large. */
export function fileError(
  file: { name: string; type: string; size: number } | null,
): FieldError | null {
  if (!file) {
    return {
      field: "file",
      summary: "Add a screenshot.",
      message: "Add a screenshot: drop it here, paste it, or choose a file.",
    };
  }
  if (!isAcceptedType(file.type)) {
    const name = fileTypeName(file);
    return {
      field: "file",
      summary: `The file is ${article(name)} ${name}. Use a PNG, JPG or WebP image.`,
      message: `This file is ${article(name)} ${name}. Export the screen as a PNG, JPG or WebP image, or take a screenshot of it.`,
    };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      field: "file",
      summary: `The file is ${fileSize(file.size)}. Use one up to 20 MB.`,
      message: `This file is ${fileSize(file.size)}, larger than 20 MB. Save it as a JPG or WebP, or crop it to one screen.`,
    };
  }
  return null;
}

export function projectNameError(name: string, existingNames: string[]): FieldError | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return {
      field: "project-name",
      summary: "Give the new project a name.",
      message: "Give the new project a name, like the product or screen.",
    };
  }
  if (existingNames.some((n) => n.trim().toLowerCase() === trimmed.toLowerCase())) {
    return {
      field: "project-name",
      summary: `A project called "${trimmed}" already exists.`,
      message: `A project called "${trimmed}" already exists. Pick it in Project, or use another name.`,
    };
  }
  return null;
}

export function versionError(name: string, existingVersions: string[]): FieldError | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return {
      field: "version",
      summary: "Give the version a name.",
      message: `Give the version a name, like "${nextVersionName(existingVersions)}".`,
    };
  }
  if (existingVersions.some((n) => n.trim().toLowerCase() === trimmed.toLowerCase())) {
    const next = nextVersionName(existingVersions);
    return {
      field: "version",
      summary: `"${trimmed}" already exists in this project. Try "${next}".`,
      message: `"${trimmed}" already exists. Try "${next}".`,
    };
  }
  return null;
}

const NUMBER_WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

/** "One thing needs fixing", "Two things need fixing", "12 things need fixing". */
export function errorSummaryTitle(count: number): string {
  const word = NUMBER_WORDS[count] ?? String(count);
  return count === 1 ? `${word} thing needs fixing` : `${word} things need fixing`;
}
