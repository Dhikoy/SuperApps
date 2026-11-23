import fs from "fs/promises";
import path from "path";

const SELFIE_ROOT = path.join(process.cwd(), "data", "selfies");

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error("Format foto tidak valid");
  const ext = match[1] === "image/png" ? "png" : "jpg";
  return { buffer: Buffer.from(match[2], "base64"), ext };
}

export async function saveSelfieImage(
  dataUrl: string,
  opts: { userNik: string; kind: "in" | "out"; date?: Date }
): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) {
    return dataUrl;
  }

  const { buffer, ext } = parseDataUrl(dataUrl);
  const date = opts.date ?? new Date();
  const dateKey = date.toISOString().slice(0, 10);
  const dir = path.join(SELFIE_ROOT, opts.userNik);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${dateKey}-${opts.kind}.${ext}`;
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, buffer);

  return `/api/selfies/${opts.userNik}/${filename}`;
}

export function resolveSelfiePath(relativePath: string): string | null {
  if (relativePath.startsWith("data:image/")) return null;
  const cleaned = relativePath.replace(/^\/api\/selfies\//, "");
  const full = path.join(SELFIE_ROOT, cleaned);
  if (!full.startsWith(SELFIE_ROOT)) return null;
  return full;
}
