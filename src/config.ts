import { z } from "zod";
import type { AppConfig } from "./types";

export const CONFIG_KEY = "jimos-home-dashboard.config.v1";

const sourceSchema = z.object({
  provider: z.enum(["kmb", "citybus"]),
  operator: z.enum(["KMB/LWB", "CTB"]),
  route: z.string().min(1),
  direction: z.enum(["inbound", "outbound"]),
  directionCode: z.enum(["I", "O"]),
  serviceType: z.string(),
  stopId: z.string().min(1),
  stopSequence: z.number().int().positive(),
  stopNameTc: z.string().min(1),
  stopNameEn: z.string().min(1),
  destinationTc: z.string(),
  destinationEn: z.string()
});

const configSchema = z.object({
  schemaVersion: z.literal(1),
  activeProfileId: z.string().min(1),
  refreshSeconds: z.number().int().min(30).max(300),
  adminPin: z.object({
    salt: z.string(),
    hash: z.string(),
    iterations: z.number().int().positive()
  }).optional(),
  profiles: z.array(z.object({
    id: z.string().min(1),
    nameTc: z.string().min(1),
    nameEn: z.string().min(1),
    weatherStationTc: z.string().min(1),
    weatherStationEn: z.string().min(1),
    transitBoards: z.array(z.object({
      id: z.string().min(1),
      labelTc: z.string(),
      labelEn: z.string(),
      route: z.string().min(1),
      sources: z.array(sourceSchema).min(1),
      etaLimit: z.number().int().min(1).max(3),
      sortOrder: z.number().int()
    })),
    display: z.object({
      alwaysOn: z.boolean(),
      sleepTime: z.string().regex(/^\d{2}:\d{2}$/),
      wakeTime: z.string().regex(/^\d{2}:\d{2}$/),
      theme: z.enum(["kmb", "dark"]),
      pixelShift: z.boolean(),
      weatherAnimation: z.boolean().optional()
    })
  })).min(1)
});

export const defaultConfig: AppConfig = {
  schemaVersion: 1,
  activeProfileId: "hong-kong-home",
  refreshSeconds: 30,
  profiles: [
    {
      id: "hong-kong-home",
      nameTc: "香港屋企",
      nameEn: "Hong Kong Home",
      weatherStationTc: "沙田",
      weatherStationEn: "Sha Tin",
      display: {
        alwaysOn: false,
        sleepTime: "20:00",
        wakeTime: "06:30",
        theme: "kmb",
        pixelShift: true,
        weatherAnimation: true
      },
      transitBoards: [
        {
          id: "kmb-289k-university",
          labelTc: "大學站",
          labelEn: "University Station",
          route: "289K",
          etaLimit: 3,
          sortOrder: 0,
          sources: [
            {
              provider: "kmb",
              operator: "KMB/LWB",
              route: "289K",
              direction: "outbound",
              directionCode: "O",
              serviceType: "1",
              stopId: "888C8A612C998895",
              stopSequence: 1,
              stopNameTc: "大學站 (ST906)",
              stopNameEn: "UNIVERSITY STATION (ST906)",
              destinationTc: "富安花園 (循環線)",
              destinationEn: "Chevalier Garden (Circular)"
            }
          ]
        }
      ]
    }
  ]
};

export function loadConfig(): AppConfig {
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) return structuredClone(defaultConfig);
  try {
    return configSchema.parse(JSON.parse(raw));
  } catch {
    return structuredClone(defaultConfig);
  }
}

export function saveConfig(config: AppConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function parseImportedConfig(raw: string): AppConfig {
  return configSchema.parse(JSON.parse(raw));
}

export function exportableConfig(config: AppConfig): AppConfig {
  const copy = structuredClone(config);
  delete copy.adminPin;
  return copy;
}
