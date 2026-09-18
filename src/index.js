// src/index.js
import express from "express";
import crypto from "crypto";
import { LANGS, PERSONAS, buildSystemPrompt } from "./prompts.js";
import { logger } from "./log.js";
import { isBlocked, getRejectionMessage, sanitizeOutput } from "./nsfw.js";
import { getWeatherWard } from "./weather-ward.js";
import { saveImageFromBase64, askVlAboutImage, cleanOldImages } from "./img.js";
import { chat, chatStream, MODELS } from "./ollama.js";  // ← THAY ĐỔI

export function createRouter(db) {
  const router = express.Router();

  // Log mọi request
  router.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => logger.info(`${req.method} ${req.originalUrl}`, {
      status: res.statusCode, ms: Date.now() - start, ip: req.ip
    }));
    next();
  });

  router.get("/options", (req, res) => {
    res.json({ languages: LANGS, personas: Object.keys(PERSONAS) });
  });

  // ===== Chat (dùng Ollama) =====
  router.post("/chat", async (req, res) => {
    const start = Date.now();
    const {
      message, lang = "vi", persona = "fem",
      temperature = 0.4, mode = "chat",
      session_id = crypto.randomUUID()
    } = req.body;

    logger.chat("→ User", { session_id, lang, persona, mode, len: message?.length });

    const entry = {
      created_at: new Date().toISOString(),
      session_id, lang, persona, mode,
      temperature: Math.max(0.3, Math.min(0.5, parseFloat(temperature))),
      user_message: message, bot_reply: null,
      latency_ms: null, tokens_used: null,
      status: "pending", error: null,
      ip: req.ip, user_agent: req.headers["user-agent"] || null
    };

    try {
      if (!LANGS[lang]) throw new Error("Ngôn ngữ không hợp lệ");
      if (!PERSONAS[persona]) throw new Error("Persona không hợp lệ");
      if (!message) throw new Error("Tin nhắn trống");

      if (isBlocked(message, { mode }).blocked) {
        const reply = getRejectionMessage(lang);
        Object.assign(entry, { bot_reply: reply, status: "blocked", latency_ms: Date.now() - start });
        db.saveChatLog(entry);
        return res.json({ reply, session_id, blocked: true });
      }

      let userPrompt = message;
      if (mode === "explain") {
        userPrompt = {
          vi: `Giải thích code này nha~\n\n\`\`\`\n${message}\n\`\`\`\n\n1) Làm gì? 2) Phần quan trọng 3) Lưu ý 4) Cải thiện 🌷`,
          en: `Explain this code~\n\n\`\`\`\n${message}\n\`\`\`\n\n1) What 2) Key parts 3) Notes 4) Improve 🌷`,
          ja: `このコード説明してね〜\n\n\`\`\`\n${message}\n\`\`\`\n\n1) 何 2) 重要 3) 注意 4) 改善 🌷`,
          zh: `解释代码~\n\n\`\`\`\n${message}\n\`\`\`\n\n1) 干啥 2) 关键 3) 注意 4) 改进 🌷`
        }[lang];
      } else if (mode === "generate") {
        userPrompt = {
          vi: `Viết code giúp mình~ 👉 ${message}\n\nComment dễ hiểu 🌱`,
          en: `Write code~ 👉 ${message}\n\nClear comments 🌱`,
          ja: `コード書いて〜 👉 ${message}\n\nわかりやすいコメント 🌱`,
          zh: `写代码~ 👉 ${message}\n\n清晰注释 🌱`
        }[lang];
      }

      // ===== GỌI OLLAMA =====
      const result = await chat({
        messages: [
          { role: "system", content: buildSystemPrompt(lang, persona) },
          { role: "user", content: userPrompt }
        ],
        temperature: entry.temperature,
        max_tokens: 2048
      });

      const reply = sanitizeOutput(result.reply || "(Không có trả lời)", lang);

      Object.assign(entry, {
        bot_reply: reply,
        latency_ms: Date.now() - start,
        tokens_used: result.tokens,
        status: "ok"
      });
      db.saveChatLog(entry);

      logger.chat("← Bot", { session_id, latency_ms: entry.latency_ms, tokens: entry.tokens_used });

      res.json({
        reply, session_id,
        meta: {
          lang, persona, temperature: entry.temperature, mode,
          latency_ms: entry.latency_ms, tokens: entry.tokens_used,
          model: MODELS.text
        }
      });
    } catch (err) {
      Object.assign(entry, { status: "error", error: err.message, latency_ms: Date.now() - start });
      db.saveChatLog(entry);
      logger.error("Chat lỗi", { session_id, error: err.message });

      // Gợi ý nếu Ollama chưa chạy
      const hint = err.message.includes("ECONNREFUSED")
        ? "Ollama chưa chạy~ mở terminal gõ: ollama serve 🥺"
        : undefined;

      res.status(500).json({
        error: "Ui lỗi rồi~ thử lại nha 🥺",
        detail: err.message,
        hint, session_id
      });
    }
  });

  // ===== Chat streaming (bonus) =====
  router.post("/chat/stream", async (req, res) => {
    const { message, lang = "vi", persona = "fem", temperature = 0.4 } = req.body;
    if (!message) return res.status(400).json({ error: "Thiếu tin nhắn" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      await chatStream({
        messages: [
          { role: "system", content: buildSystemPrompt(lang, persona) },
          { role: "user", content: message }
        ],
        temperature: Math.max(0.3, Math.min(0.5, parseFloat(temperature))),
        onChunk: (piece) => res.write(`data: ${JSON.stringify({ chunk: piece })}\n\n`)
      });
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  });

  // ===== Health check Ollama =====
  router.get("/health/ollama", async (req, res) => {
    const { healthCheck } = await import("./ollama.js");
    res.json(await healthCheck());
  });

  // Weather-ward (giữ nguyên)
  router.post("/weather", async (req, res) => {
    try {
      const { city, lang = "vi", session_id = crypto.randomUUID() } = req.body;
      if (!city) return res.status(400).json({ error: "Thiếu tên thành phố~" });
      const result = await getWeatherWard(city, lang);
      db.saveChatLog({
        created_at: new Date().toISOString(),
        session_id, lang, persona: "fem", mode: "weather",
        temperature: 0, user_message: city,
        bot_reply: `${result.cute} | ${result.advice.join(" ")}`,
        latency_ms: 0, status: "ok",
        ip: req.ip, user_agent: req.headers["user-agent"] || null
      });
      res.json({ ...result, session_id });
    } catch {
      res.status(500).json({ error: "Không lấy được thời tiết 🥺" });
    }
  });

  // Image
  router.post("/image", async (req, res) => {
    try {
      const { image, question = "Đoạn code trong ảnh làm gì?", lang = "vi", session_id = crypto.randomUUID() } = req.body;
      if (!image) return res.status(400).json({ error: "Thiếu ảnh~" });
      const saved = await saveImageFromBase64(image);
      const reply = await askVlAboutImage(saved.file, question);  // ← đổi signature
      db.saveChatLog({
        created_at: new Date().toISOString(),
        session_id, lang, persona: "fem", mode: "image",
        temperature: 0.4, user_message: `[ảnh] ${question}`,
        bot_reply: reply, latency_ms: 0, status: "ok",
        ip: req.ip, user_agent: req.headers["user-agent"] || null
      });
      res.json({ reply, image_id: saved.id, session_id });
    } catch {
      res.status(500).json({ error: "Không đọc được ảnh 🥺" });
    }
  });

  // Logs (giữ nguyên)
  router.get("/logs", (req, res) => {
    const { limit = 100, offset = 0, lang, persona, status, session_id } = req.query;
    res.json({
      logs: db.getLogs({ limit: +limit, offset: +offset, lang, persona, status, session_id }),
      total: db.countLogs({ lang, persona, status })
    });
  });
  router.get("/logs/stats", (req, res) => res.json(db.getStats()));
  router.get("/logs/files", (req, res) => res.json({ files: logger.listLogs() }));
  router.get("/logs/file/:date", (req, res) => res.json({ date: req.params.date, lines: logger.readLog(req.params.date) }));

  router.delete("/logs/cleanup", (req, res) => {
    const days = parseInt(req.query.days || 30);
    res.json({
      deleted_db: db.deleteOldLogs(days),
      deleted_files: logger.cleanOldFiles(days),
      deleted_images: cleanOldImages(7),
      days
    });
  });

  return router;
}