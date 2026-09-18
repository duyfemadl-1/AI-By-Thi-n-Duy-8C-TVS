# 🌸 Qwen-chan — Trợ lý học code dễ thương

Bot học code với **Qwen2.5-3B** + **Qwen2.5-VL-3B**, hỗ trợ **4 ngôn ngữ** (Việt/Anh/Nhật/Trung), persona **fem/femboy**, có **weather-ward**, **image VL**, **NSFW filter**, và **log đầy đủ**.

## Cài đặt

```bash
npm install
# Chạy backend Qwen
llama-server -hf andquant/Qwen2.5-3B-Instruct-IQ4_NL-GGUF:IQ4_NL --port 8080
# Chạy app
npm start