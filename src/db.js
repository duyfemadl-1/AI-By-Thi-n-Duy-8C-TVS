// src/db.js
import Database from "better-sqlite3";
import path from "path";
import { ensureLogDir, LOG_DIR } from "./log.js";

ensureLogDir();

const db = new Database(path.join(LOG_DIR, "chat.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS chat_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    session_id TEXT, lang TEXT, persona TEXT, mode TEXT,
    temperature REAL, user_message TEXT, bot_reply TEXT,
    latency_ms INTEGER, tokens_used INTEGER,
    status TEXT, error TEXT, ip TEXT, user_agent TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_created ON chat_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_session ON chat_logs(session_id);
`);

const insertStmt = db.prepare(`
  INSERT INTO chat_logs (
    created_at, session_id, lang, persona, mode, temperature,
    user_message, bot_reply, latency_ms, tokens_used, status, error, ip, user_agent
  ) VALUES (
    @created_at, @session_id, @lang, @persona, @mode, @temperature,
    @user_message, @bot_reply, @latency_ms, @tokens_used, @status, @error, @ip, @user_agent
  )
`);

export function saveChatLog(e) {
  try { return insertStmt.run(e).lastInsertRowid; }
  catch (err) { console.error("DB insert lỗi:", err.message); return null; }
}

export function getLogs({ limit = 100, offset = 0, lang, persona, status, session_id } = {}) {
  let sql = "SELECT * FROM chat_logs WHERE 1=1";
  const p = {};
  if (lang)       { sql += " AND lang = @lang"; p.lang = lang; }
  if (persona)    { sql += " AND persona = @persona"; p.persona = persona; }
  if (status)     { sql += " AND status = @status"; p.status = status; }
  if (session_id) { sql += " AND session_id = @session_id"; p.session_id = session_id; }
  sql += " ORDER BY id DESC LIMIT @limit OFFSET @offset";
  p.limit = limit; p.offset = offset;
  return db.prepare(sql).all(p);
}

export function countLogs({ lang, persona, status } = {}) {
  let sql = "SELECT COUNT(*) n FROM chat_logs WHERE 1=1";
  const p = {};
  if (lang)    { sql += " AND lang = @lang"; p.lang = lang; }
  if (persona) { sql += " AND persona = @persona"; p.persona = persona; }
  if (status)  { sql += " AND status = @status"; p.status = status; }
  return db.prepare(sql).get(p).n;
}

export function getStats() {
  return {
    total: db.prepare("SELECT COUNT(*) n FROM chat_logs").get().n,
    errors: db.prepare("SELECT COUNT(*) n FROM chat_logs WHERE status='error'").get().n,
    blocked: db.prepare("SELECT COUNT(*) n FROM chat_logs WHERE status='blocked'").get().n,
    avgLatency: db.prepare("SELECT AVG(latency_ms) a FROM chat_logs WHERE latency_ms IS NOT NULL").get().a,
    byLang: db.prepare("SELECT lang, COUNT(*) n FROM chat_logs GROUP BY lang").all(),
    byPersona: db.prepare("SELECT persona, COUNT(*) n FROM chat_logs GROUP BY persona").all(),
    byMode: db.prepare("SELECT mode, COUNT(*) n FROM chat_logs GROUP BY mode").all()
  };
}

export function deleteOldLogs(days = 30) {
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  return db.prepare("DELETE FROM chat_logs WHERE created_at < ?").run(cutoff).changes;
}

export default { saveChatLog, getLogs, countLogs, getStats, deleteOldLogs };