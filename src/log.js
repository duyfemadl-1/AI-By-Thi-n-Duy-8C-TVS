// src/log.js
import fs from "fs";
import path from "path";

const LOG_DIR = path.resolve("./logs");

// Tạo thư mục logs/ nếu chưa có (chạy khi import)
export function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    console.log("📁 Đã tạo thư mục logs/");
  }
  return LOG_DIR;
}
ensureLogDir();

// File log theo ngày
function getLogFile() {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return path.join(LOG_DIR, `app-${ymd}.log`);
}

function write(level, message, meta = {}) {
  ensureLogDir();
  const ts = new Date().toISOString();
  const metaStr = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
  const line = `[${ts}] [${level.toUpperCase()}] ${message}${metaStr}\n`;

  try {
    fs.appendFileSync(getLogFile(), line, "utf8");
  } catch (e) {
    console.error("Không ghi được log:", e.message);
  }

  const colors = {
    info: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m",
    chat: "\x1b[35m", debug: "\x1b[90m", img: "\x1b[35m",
    weather: "\x1b[34m", nsfw: "\x1b[31m"
  };
  const c = colors[level] || "\x1b[0m";
  console.log(`${c}${line.trim()}\x1b[0m`);
}

export const logger = {
  info:    (m, meta) => write("info", m, meta),
  warn:    (m, meta) => write("warn", m, meta),
  error:   (m, meta) => write("error", m, meta),
  chat:    (m, meta) => write("chat", m, meta),
  debug:   (m, meta) => write("debug", m, meta),
  img:     (m, meta) => write("img", m, meta),
  weather: (m, meta) => write("weather", m, meta),
  nsfw:    (m, meta) => write("nsfw", m, meta),

  readLog(dateStr) {
    const file = path.join(LOG_DIR, `app-${dateStr}.log`);
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map(line => {
      const m = line.match(/^\[(.+?)\] \[(.+?)\] (.+?)(\s\{.*\})?$/);
      if (!m) return { raw: line };
      return { ts: m[1], level: m[2], message: m[3], meta: m[4] ? JSON.parse(m[4].trim()) : null };
    });
  },

  listLogs() {
    ensureLogDir();
    return fs.readdirSync(LOG_DIR)
      .filter(f => f.startsWith("app-") && f.endsWith(".log"))
      .sort().reverse();
  },

  // Xoá file log cũ hơn N ngày
  cleanOldFiles(days = 30) {
    const cutoff = Date.now() - days * 86400_000;
    let deleted = 0;
    for (const f of fs.readdirSync(LOG_DIR)) {
      if (!f.endsWith(".log")) continue;
      const full = path.join(LOG_DIR, f);
      if (fs.statSync(full).mtimeMs < cutoff) {
        fs.unlinkSync(full); deleted++;
      }
    }
    return deleted;
  },

  LOG_DIR
};

export default logger;