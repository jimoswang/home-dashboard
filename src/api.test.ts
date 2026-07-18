import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBoardEta, POLL_INTERVALS, radarCandidateUrls } from "./api";
import { defaultConfig } from "./config";

describe("KMB ETA normalization", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the departure stop sequence and excludes the circular return sequence", async () => {
    const base = Date.now() + 5 * 60_000;
    const response = {
      data: [
        { co: "KMB", route: "289K", dir: "O", service_type: 1, seq: 1, eta: new Date(base).toISOString(), rmk_tc: "原定班次", rmk_en: "Scheduled Bus" },
        { co: "KMB", route: "289K", dir: "O", service_type: 1, seq: 1, eta: new Date(base + 20 * 60_000).toISOString(), rmk_tc: "", rmk_en: "" },
        { co: "KMB", route: "289K", dir: "O", service_type: 1, seq: 10, eta: new Date(base + 2 * 60_000).toISOString(), rmk_tc: "", rmk_en: "" }
      ]
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 })));
    const snapshot = await fetchBoardEta(defaultConfig.profiles[0].transitBoards[0]);
    expect(snapshot.freshness).toBe("fresh");
    expect(snapshot.items).toHaveLength(2);
    expect(snapshot.items[0].scheduled).toBe(true);
  });
});

describe("HKO 128 km radar candidates", () => {
  it("uses six-minute HKT scan slots and falls back to earlier images", () => {
    const candidates = radarCandidateUrls(new Date("2026-07-18T05:32:00.000Z"), 3);
    expect(candidates.map((item) => item.url)).toEqual([
      "https://www.hko.gov.hk/wxinfo/radars/rad_128_png/2d128nradar_202607181330.jpg",
      "https://www.hko.gov.hk/wxinfo/radars/rad_128_png/2d128nradar_202607181324.jpg",
      "https://www.hko.gov.hk/wxinfo/radars/rad_128_png/2d128nradar_202607181318.jpg"
    ]);
    expect(candidates[1].capturedAt).toBe("2026-07-18T05:24:00.000Z");
  });

  it("checks for a new radar image every five minutes while respecting six-minute scan slots", () => {
    expect(POLL_INTERVALS.radar).toBe(5 * 60_000);
    expect(POLL_INTERVALS.warnings).toBe(5 * 60_000);
    expect(POLL_INTERVALS.weather).toBe(10 * 60_000);
  });
});
