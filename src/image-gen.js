// src/image-gen.js
import fetch from "node-fetch";   // ✅
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { logger } from "./log.js";

const GEN_DIR = path.resolve("./logs/generated");
if (!fs.existsSync(GEN_DIR)) fs.mkdirSync(GEN_DIR, { recursive: true });

const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt";

export const STYLE_PRESETS = {
  fem: "cute anime style, soft pastel colors, kawaii, gentle lighting, detailed, masterpiece, best quality",
  femboy: "cute femboy anime style, playful, pastel pink, frilly clothes, detailed, masterpiece, best quality"
};

export async function generateImage({
  prompt, width = 512, height = 512, seed = -1,
  model = "flux", nologo = true, safe = true,
  persona = "fem"
}) {
  const start = Date.now();
  const style = STYLE_PRESETS[persona] || "";
  const finalPrompt = `${prompt}, ${style}`;

  logger.img("→ Pollinations", { prompt: prompt.slice(0, 80), model });

  const params = new URLSearchParams({
    width: width.toString(),
    height: height.toString(),
    model,
    nologo: nologo.toString(),
    safe: safe.toString()
  });
  if (seed !== -1) params.set("seed", seed.toString());

  const url = `${POLLINATIONS_BASE}/${encodeURIComponent(finalPrompt)}?${params}`;

  // Timeout 60s với AbortController
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);

  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`Pollinations ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const id = crypto.randomBytes(8).toString("hex");
  const filename = `${id}.png`;
  const file = path.join(GEN_DIR, filename);
  fs.writeFileSync(file, buffer);

  const latency = Date.now() - start;
  logger.img("← Pollinations xong", { id, ms: latency, size: buffer.length });

  return {
    id, file, filename,
    base64: buffer.toString("base64"),
    info: {
      seed: seed === -1 ? "random" : seed,
      model,
      size: `${width}x${height}`,
      latency_ms: latency
    }
  };
}

export async function healthCheck() {
  try {
    const res = await fetch(
      `${POLLINATIONS_BASE}/test?width=64&height=64&nologo=true`,
      { method: "HEAD" }
    );
    return { ok: res.ok, url: "https://image.pollinations.ai", note: "Free, no API key" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function cleanOldGenerated(days = 7) {
  const cutoff = Date.now() - days * 86400_000;
  let n = 0;
  for (const f of fs.readdirSync(GEN_DIR)) {
    const full = path.join(GEN_DIR, f);
    if (fs.statSync(full).mtimeMs < cutoff) { fs.unlinkSync(full); n++; }
  }
  if (n) logger.img(`Xoá ${n} ảnh cũ`);
  return n;
}

export { GEN_DIR };