// src/img.js
import sharp from "sharp";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { logger } from "./log.js";
import { chatWithImage } from "./ollama.js";  // ← THAY ĐỔI

const IMG_DIR = path.resolve("./logs/uploads");
if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

export async function saveImageFromBase64(dataUrl) {
  const m = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!m) throw new Error("Data URL không hợp lệ");
  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  const buf = Buffer.from(m[2], "base64");

  const resized = await sharp(buf)
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .toFormat(ext === "jpg" ? "jpeg" : ext, { quality: 85 })
    .toBuffer();

  const id = crypto.randomBytes(8).toString("hex");
  const file = path.join(IMG_DIR, `${id}.${ext}`);
  fs.writeFileSync(file, resized);

  logger.img("Lưu ảnh", { id, size: resized.length });
  return { id, file, ext, size: resized.length };
}

// Trả base64 KHÔNG prefix (Ollama cần vậy)
export function imageToBase64Raw(filePath) {
  return fs.readFileSync(filePath).toString("base64");
}

// Gọi Qwen2.5-VL qua Ollama
export async function askVlAboutImage(imagePath, question) {
  const b64 = imageToBase64Raw(imagePath);
  logger.img("Gửi VL Ollama", { q: question.slice(0, 60) });

  const { reply } = await chatWithImage({
    prompt: question,
    images: [b64]
  });
  return reply || "(VL không trả lời)";
}

export function cleanOldImages(days = 7) {
  const cutoff = Date.now() - days * 86400_000;
  let n = 0;
  for (const f of fs.readdirSync(IMG_DIR)) {
    const full = path.join(IMG_DIR, f);
    if (fs.statSync(full).mtimeMs < cutoff) { fs.unlinkSync(full); n++; }
  }
  if (n) logger.img(`Xoá ${n} ảnh cũ`);
  return n;
}

export { IMG_DIR };