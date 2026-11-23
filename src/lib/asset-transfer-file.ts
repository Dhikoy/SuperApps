import fs from "fs/promises";
import path from "path";

const DATA_ROOT = path.join(process.cwd(), "data");
const NAME = /^[A-Za-z0-9]+\.(pdf|jpg|jpeg|png|webp)$/;
const MAX_BYTES = 8 * 1024 * 1024;

type SignedDir = "asset-transfers" | "asset-loans";

const EXT_BY_TYPE: Record<string, "pdf" | "jpg" | "png" | "webp"> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const TYPE_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function looksValid(buffer: Buffer, ext: "pdf" | "jpg" | "png" | "webp") {
  if (ext === "pdf") return buffer.subarray(0, 4).toString("ascii") === "%PDF";
  if (ext === "jpg") return buffer[0] === 0xff && buffer[1] === 0xd8;
  if (ext === "png") return buffer[0] === 0x89 && buffer[1] === 0x50;
  return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
}

export async function saveSignedScan(dir: SignedDir, id: string, file: File) {
  if (!/^[A-Za-z0-9]+$/.test(id)) throw new Error("Form tidak valid");
  if (file.size <= 0 || file.size > MAX_BYTES) throw new Error("File maksimal 8 MB");
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) throw new Error("Unggah PDF, JPG, PNG, atau WebP");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!looksValid(buffer, ext)) throw new Error("File tidak valid");
  const root = path.join(DATA_ROOT, dir);
  await fs.mkdir(root, { recursive: true });
  const filename = `${id}.${ext}`;
  if (!NAME.test(filename)) throw new Error("File tidak valid");
  for (const other of Object.keys(TYPE_BY_EXT)) {
    if (other !== ext) await fs.rm(path.join(root, `${id}.${other}`), { force: true });
  }
  await fs.writeFile(path.join(root, filename), buffer);
  return filename;
}

export async function readSignedScan(dir: SignedDir, filename: string) {
  if (!NAME.test(filename)) return null;
  const ext = filename.split(".").pop()!;
  try {
    const buffer = await fs.readFile(path.join(DATA_ROOT, dir, filename));
    return { buffer, contentType: TYPE_BY_EXT[ext] };
  } catch {
    return null;
  }
}

export function saveSignedTransfer(transferId: string, file: File) {
  return saveSignedScan("asset-transfers", transferId, file);
}
