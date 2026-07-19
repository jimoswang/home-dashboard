export type WeatherScene =
  | "sunny"
  | "partly-cloudy"
  | "showers"
  | "cloudy"
  | "overcast"
  | "light-rain"
  | "rain"
  | "heavy-rain"
  | "thunderstorm"
  | "night-clear"
  | "night-cloudy"
  | "windy"
  | "mist"
  | "unknown";

export type WeatherGlyph =
  | "sun"
  | "cloud-sun"
  | "sun-rain"
  | "rain"
  | "cloud"
  | "thunderstorm"
  | "moon"
  | "cloud-moon"
  | "wind"
  | "droplets";

export interface WeatherPresentation {
  scene: WeatherScene;
  glyph: WeatherGlyph;
  labelTc: string;
  labelEn: string;
}

export type HeroPhoto = "sunny" | "cloudy" | "rain" | "thunderstorm" | "night";

const UNKNOWN: WeatherPresentation = {
  scene: "unknown",
  glyph: "cloud",
  labelTc: "天氣資料更新中",
  labelEn: "WEATHER UPDATING"
};

const PRESENTATIONS: Record<number, WeatherPresentation> = {
  50: { scene: "sunny", glyph: "sun", labelTc: "天晴", labelEn: "SUNNY" },
  51: { scene: "sunny", glyph: "sun", labelTc: "間有陽光", labelEn: "SUNNY PERIODS" },
  52: { scene: "partly-cloudy", glyph: "cloud-sun", labelTc: "短暫陽光", labelEn: "SUNNY INTERVALS" },
  53: { scene: "showers", glyph: "sun-rain", labelTc: "間有陽光及幾陣驟雨", labelEn: "SUNNY PERIODS, A FEW SHOWERS" },
  54: { scene: "showers", glyph: "sun-rain", labelTc: "短暫陽光及有驟雨", labelEn: "SUNNY INTERVALS WITH SHOWERS" },
  60: { scene: "cloudy", glyph: "cloud", labelTc: "多雲", labelEn: "CLOUDY" },
  61: { scene: "overcast", glyph: "cloud", labelTc: "密雲", labelEn: "OVERCAST" },
  62: { scene: "light-rain", glyph: "rain", labelTc: "微雨", labelEn: "LIGHT RAIN" },
  63: { scene: "rain", glyph: "rain", labelTc: "有雨", labelEn: "RAIN" },
  64: { scene: "heavy-rain", glyph: "rain", labelTc: "大雨", labelEn: "HEAVY RAIN" },
  65: { scene: "thunderstorm", glyph: "thunderstorm", labelTc: "雷暴", labelEn: "THUNDERSTORMS" },
  70: { scene: "night-clear", glyph: "moon", labelTc: "天色良好", labelEn: "FINE AT NIGHT" },
  71: { scene: "night-clear", glyph: "moon", labelTc: "天色良好", labelEn: "FINE AT NIGHT" },
  72: { scene: "night-clear", glyph: "moon", labelTc: "天色良好", labelEn: "FINE AT NIGHT" },
  73: { scene: "night-clear", glyph: "moon", labelTc: "天色良好", labelEn: "FINE AT NIGHT" },
  74: { scene: "night-clear", glyph: "moon", labelTc: "天色良好", labelEn: "FINE AT NIGHT" },
  75: { scene: "night-clear", glyph: "moon", labelTc: "天色良好", labelEn: "FINE AT NIGHT" },
  76: { scene: "night-cloudy", glyph: "cloud-moon", labelTc: "大致多雲", labelEn: "MAINLY CLOUDY AT NIGHT" },
  77: { scene: "night-clear", glyph: "moon", labelTc: "大致天晴", labelEn: "MAINLY FINE AT NIGHT" },
  80: { scene: "windy", glyph: "wind", labelTc: "大風", labelEn: "WINDY" },
  81: { scene: "sunny", glyph: "sun", labelTc: "乾燥", labelEn: "DRY" },
  82: { scene: "mist", glyph: "droplets", labelTc: "潮濕", labelEn: "HUMID" },
  83: { scene: "mist", glyph: "cloud", labelTc: "有霧", labelEn: "FOG" },
  84: { scene: "mist", glyph: "cloud", labelTc: "薄霧", labelEn: "MIST" },
  85: { scene: "mist", glyph: "cloud", labelTc: "煙霞", labelEn: "HAZE" },
  90: { scene: "sunny", glyph: "sun", labelTc: "酷熱", labelEn: "HOT" },
  91: { scene: "sunny", glyph: "sun", labelTc: "溫暖", labelEn: "WARM" },
  92: { scene: "cloudy", glyph: "cloud", labelTc: "清涼", labelEn: "COOL" },
  93: { scene: "cloudy", glyph: "cloud", labelTc: "寒冷", labelEn: "COLD" }
};

export function resolveWeatherPresentation(code: number | null): WeatherPresentation {
  return code === null ? UNKNOWN : PRESENTATIONS[code] ?? UNKNOWN;
}

export function resolveHeroScene(baseScene: WeatherScene, warningCodes: string[]): WeatherScene {
  const codes = warningCodes.map((code) => code.toUpperCase());
  if (codes.some((code) => code === "WTS" || code.includes("THUNDER"))) return "thunderstorm";
  if (codes.some((code) => code.startsWith("WRAIN"))) return "heavy-rain";
  if (codes.some((code) => code.startsWith("WTCSGNL") || code.includes("TC"))) return "windy";
  return baseScene;
}

export function resolveHeroPhoto(scene: WeatherScene): HeroPhoto {
  if (scene === "sunny" || scene === "partly-cloudy" || scene === "showers") return "sunny";
  if (scene === "cloudy" || scene === "overcast" || scene === "windy" || scene === "mist" || scene === "unknown") return "cloudy";
  if (scene === "light-rain" || scene === "rain" || scene === "heavy-rain") return "rain";
  if (scene === "thunderstorm") return "thunderstorm";
  return "night";
}
