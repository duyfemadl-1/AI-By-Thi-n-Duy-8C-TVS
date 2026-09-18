// src/nsfw.js
import { logger } from "./log.js";

// Từ khoá chặn (có thể mở rộng)
const BLOCKED_PATTERNS = [
  // Nội dung người lớn
  /\b(sex|porn|xxx|nude|nsfw|18\+|khiêu dâm|sex toy)\b/i,
  /\b(hiếp|rape|cưỡng|dâm ô)\b/i,
  // Bạo lực
  /\b(giết|kill|murder|chém|đâm|tự tử|suicide)\b/i,
  /\b(bomb|chế bom|vũ khí|weapon|súng|gun)\b/i,
  // Chất cấm
  /\b(ma tuý|cocaine|heroin|thuốc lá điện tử|vape|meth)\b/i,
  // Lừa đảo
  /\b(hack|ddos|mã độc|malware|ransomware|phishing|lừa đảo)\b/i,
  // Xúc phạm
  /\b(địt|đụ|lồn|cặc|fuck|shit)\b/i
];

// Whitelist — code hợp lệ dù chứa từ khoá
const CODE_CONTEXT = [
  /```[\s\S]*```/,
  /\b(function|class|import|const|let|var|def|public)\b/
];

export function isBlocked(text, { mode = "chat" } = {}) {
  if (!text) return { blocked: false };

  const lower = text.toLowerCase();

  // Nếu là explain/generate code → cho phép nhiều hơn
  const isCodeContext = mode === "explain" || mode === "generate" ||
    CODE_CONTEXT.some(rx => rx.test(text));

  for (const rx of BLOCKED_PATTERNS) {
    if (rx.test(lower)) {
      // Trong context code, chỉ chặn nếu không phải ví dụ học thuật
      if (isCodeContext && !/sex|porn|nude|hiếp|giết người/i.test(lower)) {
        continue;
      }
      logger.nsfw("Chặn nội dung", { match: rx.source, mode, snippet: text.slice(0, 80) });
      return { blocked: true, reason: rx.source, match: text.match(rx)?.[0] };
    }
  }
  return { blocked: false };
}

// Tin nhắn từ chối — cute, không gắt
export function getRejectionMessage(lang = "vi") {
  const m = {
    vi: "Ui~ nội dung này mình không giúp được rồi 🥺 Mình là trợ lý học code thôi nha, mình giúp bạn học lập trình thôi~ 🌸",
    en: "Oops~ I can't help with that 🥺 I'm just a coding assistant here to help you learn~ 🌸",
    ja: "あら〜それはお手伝いできないの 🥺 コード学習のサポートだけだよ〜 🌸",
    zh: "哎呀~这个我帮不了 🥺 人家只是帮你学代码的啦~ 🌸"
  };
  return m[lang] || m.vi;
}

// Lọc output bot trả về (đề phòng model tự sinh bậy)
export function sanitizeOutput(text, lang = "vi") {
  const check = isBlocked(text, { mode: "output" });
  if (check.blocked) {
    logger.nsfw("Output bị lọc", { snippet: text.slice(0, 100) });
    return getRejectionMessage(lang);
  }
  return text;
}