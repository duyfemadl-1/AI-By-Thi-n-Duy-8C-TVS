// src/weather.js
import fetch from "node-fetch";   // ✅
import { logger } from "./log.js";

const GEO = "https://geocoding-api.open-meteo.com/v1/search";
const WX  = "https://api.open-meteo.com/v1/forecast";

export async function getWeather(city) {
  try {
    logger.weather("Tra cứu", { city });
    const g = await (await fetch(`${GEO}?name=${encodeURIComponent(city)}&count=1&language=vi`)).json();
    if (!g.results?.length) throw new Error("Không tìm thấy thành phố");

    const { latitude, longitude, name, country } = g.results[0];
    const w = await (await fetch(
      `${WX}?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`
    )).json();

    const result = {
      city: name, country,
      temp: w.current.temperature_2m,
      humidity: w.current.relative_humidity_2m,
      wind: w.current.wind_speed_10m,
      code: w.current.weather_code,
      desc: codeToText(w.current.weather_code)
    };
    logger.weather("OK", result);
    return result;
  } catch (err) {
    logger.error("Lỗi weather", { city, error: err.message });
    throw err;
  }
}

function codeToText(c) {
  const m = {
    0:"☀️ Trời quang",1:"🌤️ Ít mây",2:"⛅ Có mây",3:"☁️ Nhiều mây",
    45:"🌫️ Sương mù",48:"🌫️ Sương giá",
    51:"🌦️ Mưa phùn nhẹ",53:"🌦️ Mưa phùn",55:"🌧️ Mưa phùn nặng",
    61:"🌧️ Mưa nhẹ",63:"🌧️ Mưa",65:"⛈️ Mưa to",
    71:"🌨️ Tuyết nhẹ",73:"🌨️ Tuyết",75:"❄️ Tuyết dày",
    80:"🌦️ Mưa rào",81:"🌧️ Mưa rào to",82:"⛈️ Mưa rào mạnh",
    95:"⛈️ Giông",96:"⛈️ Giông mưa đá",99:"⛈️ Giông lớn"
  };
  return m[c] || "🌈 Không rõ";
}