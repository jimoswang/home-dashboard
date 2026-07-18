import { beforeEach, describe, expect, it } from "vitest";
import { defaultConfig, exportableConfig, loadConfig, parseImportedConfig, saveConfig } from "./config";

describe("configuration", () => {
  beforeEach(() => localStorage.clear());

  it("ships the approved 289K University Station QC profile", () => {
    const config = loadConfig();
    const board = config.profiles[0].transitBoards[0];
    expect(board.route).toBe("289K");
    expect(board.sources[0]).toMatchObject({
      stopId: "888C8A612C998895",
      stopSequence: 1,
      serviceType: "1"
    });
    expect(config.refreshSeconds).toBe(30);
  });

  it("round-trips valid config and rejects invalid refresh intervals", () => {
    saveConfig(defaultConfig);
    expect(loadConfig()).toEqual(defaultConfig);
    expect(() => parseImportedConfig(JSON.stringify({ ...defaultConfig, refreshSeconds: 5 }))).toThrow();
  });

  it("removes the admin PIN from exports", () => {
    const config = {
      ...defaultConfig,
      adminPin: { salt: "salt", hash: "hash", iterations: 1 }
    };
    expect(exportableConfig(config).adminPin).toBeUndefined();
  });
});
