// server.js
import express from "express";
import cors from "cors";
import { createRouter } from "./src/index.js";
import db from "./src/db.js";
import { logger } from "./src/log.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.static("public"));

app.use("/api", createRouter(db));

// Auto cleanup mỗi 24h
setInterval(() => {
  const n = db.deleteOldLogs(30);
  if (n) logger.info(`Auto cleanup: ${n} log cũ`);
}, 24 * 3600_000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info("🌸 Qwen-chan khởi động", { port: PORT });
});