import fs from "fs/promises";
import path from "path";

const PHOTO_ROOT = path.join(process.cwd(), "data", "asset-photos");
const PHOTO_NAME = /^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/;
const MAX_BYTES = 5 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function assetPhotoFile(serialNumber: string) {
  return `${serialNumber}.jpg`;
}

export function photoContentType(filename: string) {
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export function resolveAssetPhoto(filename: string): string | null {
  if (!PHOTO_NAME.test(filename)) return null;
  const root = path.resolve(PHOTO_ROOT);
  const full = path.resolve(root, filename);
  const relative = path.relative(root, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return full;
}

export async function assetPhotoExists(serialNumber: string) {
  const full = resolveAssetPhoto(assetPhotoFile(serialNumber));
  if (!full) return false;
  try {
    await fs.access(full);
    return true;
  } catch {
    return false;
  }
}

function matchesType(buffer: Buffer, ext: "jpg" | "png" | "webp") {
  if (ext === "jpg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (ext === "png") return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
}

export async function saveAssetPhoto(assetId: string, file: File) {
  if (!/^[A-Za-z0-9]+$/.test(assetId)) {
    throw new Error("Aset tidak valid");
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new Error("Foto maksimal 5 MB");
  }
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) throw new Error("Foto harus JPG, PNG, atau WebP");

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!matchesType(buffer, ext)) throw new Error("File foto tidak valid");

  await fs.mkdir(PHOTO_ROOT, { recursive: true });
  const filename = `${assetId}-${Date.now()}.${ext}`;
  await fs.writeFile(path.join(PHOTO_ROOT, filename), buffer);
  return filename;
}

export async function deleteAssetPhoto(filename: string | null | undefined) {
  const full = filename ? resolveAssetPhoto(filename) : null;
  if (!full) return;
  await fs.unlink(full).catch(() => {});
}
