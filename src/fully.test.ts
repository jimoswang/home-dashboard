import { describe, expect, it, vi } from "vitest";
import { isWithinSleepWindow, syncFullySchedule } from "./fully";

describe("screen schedule", () => {
  it("handles the approved overnight 20:00–06:30 window", () => {
    expect(isWithinSleepWindow(new Date(2026, 6, 18, 20, 0), "20:00", "06:30")).toBe(true);
    expect(isWithinSleepWindow(new Date(2026, 6, 19, 6, 29), "20:00", "06:30")).toBe(true);
    expect(isWithinSleepWindow(new Date(2026, 6, 19, 6, 30), "20:00", "06:30")).toBe(false);
    expect(isWithinSleepWindow(new Date(2026, 6, 19, 12, 0), "20:00", "06:30")).toBe(false);
  });

  it("sends a whole-week schedule to Fully Kiosk", () => {
    const setStringSetting = vi.fn();
    const setBooleanSetting = vi.fn();
    window.fully = { setStringSetting, setBooleanSetting, turnScreenOff: vi.fn(), turnScreenOn: vi.fn() };
    expect(syncFullySchedule(false, "20:00", "06:30")).toBe(true);
    expect(setStringSetting).toHaveBeenCalledWith(
      "sleepSchedule",
      JSON.stringify([{ wakeUpTime: "06:30", sleepTime: "20:00", dayOfWeek: 8 }])
    );
    expect(setBooleanSetting).toHaveBeenCalledWith("keepScreenOn", true);
    delete window.fully;
  });
});
