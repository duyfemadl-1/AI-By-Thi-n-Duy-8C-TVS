// src/weather-ward.js
import { getWeather } from "./weather.js";
import { logger } from "./log.js";

// Ward = "bảo vệ" — đưa ra lời khuyên theo thời tiết, giọng cute
export async function getWeatherWard(city, lang = "vi") {
  const w = await getWeather(city);

  const advice = buildAdvice(w, lang);
  const cute = cuteWrap(w, lang);

  logger.weather("Weather-ward xong", { city, temp: w.temp });

  return { ...w, advice, cute };
}

function buildAdvice(w, lang) {
  const tips = [];
  const c = w.code;

  if (w.temp >= 35) tips.push(pick(lang, "🥵 Nóng lắm đó, nhớ uống nhiều nước nha!", "🥵 It's super hot, drink lots of water!", "🥵 暑いよ、水分補給してね！", "🥵 好热呀，多喝水哦！"));
  else if (w.temp <= 10) tips.push(pick(lang, "🧣 Lạnh rồi, mặc ấm vào nha~", "🧣 It's cold, dress warmly~", "🧣 寒いよ、暖かくしてね〜", "🧣 好冷，记得穿暖和~"));

  if (c >= 51 && c <= 67) tips.push(pick(lang, "☔ Có mưa, mang dù theo nha!", "☔ Rainy, bring an umbrella!", "☔ 雨だよ、傘を持ってね！", "☔ 下雨啦，带伞哦！"));
  if (c >= 95) tips.push(pick(lang, "⛈️ Có giông, hạn chế ra ngoài nha~", "⛈️ Thunderstorm, stay inside~", "⛈️ 雷雨、外出控えめに〜", "⛈️ 雷雨，尽量别出门~"));
  if (w.humidity > 80) tips.push(pick(lang, "💧 Ẩm cao, cẩn thận cảm lạnh nha~", "💧 High humidity, watch out for colds~", "💧 湿度高、風邪に気をつけて〜", "💧 湿度高，小心感冒~"));
  if (w.wind > 30) tips.push(pick(lang, "💨 Gió mạnh, cẩn thận nha~", "💨 Strong wind, be careful~", "💨 強風、気をつけて〜", "💨 风大，小心点~"));

  if (!tips.length) tips.push(pick(lang, "🌸 Thời tiết đẹp, đi chơi thôi!", "🌸 Nice weather, go out!", "🌸 いい天気、出かけよう！", "🌸 天气不错，出去玩吧！"));

  return tips;
}

function cuteWrap(w, lang) {
  const t = w.temp;
  const emoji = t >= 35 ? "🔥" : t >= 25 ? "☀️" : t >= 15 ? "🌤️" : t >= 5 ? "🍃" : "❄️";
  const hello = pick(lang,
    `${emoji} ${w.city} đang ${w.desc.toLowerCase()} nha~ ${t}°C thôi đó 💕`,
    `${emoji} ${w.city} is ${w.desc.toLowerCase()}~ only ${t}°C 💕`,
    `${emoji} ${w.city}は${w.desc}、${t}°Cだよ〜 💕`,
    `${emoji} ${w.city}现在${w.desc}，才${t}°C哦 💕`
  );
  return hello;
}

function pick(lang, vi, en, ja, zh) {
  return { vi, en, ja, zh }[lang] || vi;
}