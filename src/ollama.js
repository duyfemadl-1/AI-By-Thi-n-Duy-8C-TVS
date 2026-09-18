// src/ollama.js
import fetch from "node-fetch";   // ✅ thêm vào
import { logger } from "./log.js";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

export const MODELS = {
  text: process.env.OLLAMA_TEXT_MODEL || "qwen2.5:3b",
  vl:   process.env.OLLAMA_VL_MODEL   || "qwen2.5vl:3b"
};

export async function chat({ messages, temperature = 0.4, max_tokens = 2048, model = MODELS.text }) {
  const start = Date.now();

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model, messages, stream: false,
      options: {
        temperature: Math.max(0.0, Math.min(1.0, temperature)),
        num_predict: max_tokens
      }
    })
  });

  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = await res.json();

  logger.info("← Ollama", { model, ms: Date.now() - start, tokens: data.eval_count });
  return { reply: data.message?.content || "", tokens: data.eval_count || null, model, raw: data };
}

export async function chatStream({ messages, temperature = 0.4, max_tokens = 2048, model = MODELS.text, onChunk }) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model, messages, stream: true,
      options: { temperature, num_predict: max_tokens }
    })
  });

  if (!res.ok) throw new Error(`Ollama stream ${res.status}`);

  let full = "", tokens = 0, buf = "";

  // node-fetch v3: res.body là Node Readable
  for await (const chunk of res.body) {
    buf += chunk.toString("utf8");
    const lines = buf.split("\n");
    buf = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        const piece = obj.message?.content || "";
        if (piece) { full += piece; onChunk?.(piece); }
        if (obj.done) tokens = obj.eval_count || 0;
      } catch {}
    }
  }

  return { reply: full, tokens, model };
}

export async function chatWithImage({ prompt, images, temperature = 0.4, model = MODELS.vl }) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt, images }],
      stream: false,
      options: { temperature }
    })
  });

  if (!res.ok) throw new Error(`Ollama VL ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { reply: data.message?.content || "", raw: data };
}

export async function healthCheck() {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    const data = await r.json();
    return { ok: true, models: data.models?.map(m => m.name) || [], url: OLLAMA_URL };
  } catch (err) {
    return { ok: false, error: err.message, url: OLLAMA_URL };
  }
}

export { OLLAMA_URL };