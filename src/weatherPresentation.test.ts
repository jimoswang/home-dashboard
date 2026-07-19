import { describe, expect, it } from "vitest";
import { resolveHeroScene, resolveWeatherPresentation } from "./weatherPresentation";

describe("HKO weather presentation", () => {
  it("does not show a sun for cloudy, overcast, or light rain", () => {
    expect(resolveWeatherPresentation(60)).toMatchObject({ scene: "cloudy", glyph: "cloud" });
    expect(resolveWeatherPresentation(61)).toMatchObject({ scene: "overcast", glyph: "cloud" });
    expect(resolveWeatherPresentation(62)).toMatchObject({ scene: "light-rain", glyph: "rain" });
  });

  it("maps rain, thunderstorm, and night icons", () => {
    expect(resolveWeatherPresentation(53).glyph).toBe("sun-rain");
    expect(resolveWeatherPresentation(64).scene).toBe("heavy-rain");
    expect(resolveWeatherPresentation(65).glyph).toBe("thunderstorm");
    expect(resolveWeatherPresentation(70).glyph).toBe("moon");
    expect(resolveWeatherPresentation(76).glyph).toBe("cloud-moon");
  });

  it("covers every current HKO icon code", () => {
    const codes = [50, 51, 52, 53, 54, 60, 61, 62, 63, 64, 65, 70, 71, 72, 73, 74, 75, 76, 77, 80, 81, 82, 83, 84, 85, 90, 91, 92, 93];
    for (const code of codes) {
      expect(resolveWeatherPresentation(code).scene).not.toBe("unknown");
    }
  });

  it("lets severe warnings override the hero scene", () => {
    expect(resolveHeroScene("sunny", ["WTS"])).toBe("thunderstorm");
    expect(resolveHeroScene("sunny", ["WRAINR"])).toBe("heavy-rain");
    expect(resolveHeroScene("sunny", ["WTCSGNL"])).toBe("windy");
  });
});
