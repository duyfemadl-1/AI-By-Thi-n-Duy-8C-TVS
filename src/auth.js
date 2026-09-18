// src/auth.js
import fs from "fs";
import path from "path";
import { logger } from "./log.js";

let cachedKey = null;

function loadKey() {
  if (cachedKey) return cachedKey;
  const envFile = path.resolve(".env");
  if (fs.existsSync(envFile)) {
    const txt = fs.readFileSync(envFile, "utf8");
    const m = txt.match(/^API_KEY=(.+)$/m);
    if (m) cachedKey = m[1].trim();
  }
  cachedKey = cachedKey || process.env.API_KEY || "dev-key";
  return cachedKey;
}

export function authMiddleware(req, res, next) {
  if (req.method === "OPTIONS") return next();

  const publicPaths = ["/options", "/health"];
  if (publicPaths.some(p => req.path.endsWith(p))) return next();

  const key = req.headers["x-api-key"] || req.query.api_key;
  if (!key || key !== loadKey()) {
    logger.warn("Từ chối truy cập", { ip: req.ip, path: req.path });
    return res.status(401).json({
      error: "Sai hoặc thiếu API key rồi~ 🔑",
      hint: "Mở /config.html để lấy key nha 🌸"
    });
  }
  next();
}

export function reloadKey() { cachedKey = null; }