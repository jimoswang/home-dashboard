import { cacheGet, cacheSet } from "./cache";
import type {
  EtaItem,
  RouteVariant,
  RadarSnapshot,
  StopOption,
  TransitBoardConfig,
  TransitSnapshot,
  TransitSource,
  WeatherSnapshot,
  WeatherWarning
} from "./types";

const KMB_BASE = "https://data.etabus.gov.hk/v1/transport/kmb";
const CITYBUS_BASE = "https://rt.data.gov.hk/v2/transport/citybus";
const HKO_BASE = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php";
const HKO_RADAR_BASE = "https://www.hko.gov.hk/wxinfo/radars/rad_128_png";
const HKO_RADAR_CACHE_KEY = "radar:hko:128km:latest";

export const POLL_INTERVALS = {
  weather: 5 * 60_000,
  warnings: 5 * 60_000,
  radar: 5 * 60_000
} as const;

interface FetchResult<T> {
  data: T;
  stale: boolean;
  storedAt: number;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function requestJson<T>(url: string, cacheKey: string, timeoutMs = 5_000): Promise<FetchResult<T>> {
  let error: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      if (attempt > 0) await new Promise((resolve) => window.setTimeout(resolve, 300 + Math.random() * 400));
      const response = await fetchWithTimeout(url, timeoutMs);
      const data = await response.json() as T;
      try {
        await cacheSet(cacheKey, data);
      } catch {
        // A successful network response must remain usable if browser storage
        // is unavailable or temporarily locked (notably older iOS Safari).
      }
      return { data, stale: false, storedAt: Date.now() };
    } catch (caught) {
      error = caught;
    }
  }
  let cached: Awaited<ReturnType<typeof cacheGet<T>>> = null;
  try {
    cached = await cacheGet<T>(cacheKey);
  } catch {
    // Cache is a fallback, never a dependency of the live API path.
  }
  if (cached) return { data: cached.value, stale: true, storedAt: cached.storedAt };
  throw error instanceof Error ? error : new Error("Network unavailable");
}

function hktTimestamp(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}${value("month")}${value("day")}${value("hour")}${value("minute")}`;
}

export function radarCandidateUrls(now = new Date(), count = 5): Array<{ url: string; capturedAt: string }> {
  const sixMinutes = 6 * 60_000;
  const rounded = Math.floor(now.getTime() / sixMinutes) * sixMinutes;
  return Array.from({ length: count }, (_, index) => {
    const captured = new Date(rounded - index * sixMinutes);
    return {
      url: `${HKO_RADAR_BASE}/2d128nradar_${hktTimestamp(captured)}.jpg`,
      capturedAt: captured.toISOString()
    };
  });
}

function probeImage(url: string, timeoutMs = 4_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      image.src = "";
      reject(new Error("Radar image timed out"));
    }, timeoutMs);
    image.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("Radar image unavailable"));
    };
    image.src = url;
  });
}

export async function fetchRadar(now = new Date()): Promise<RadarSnapshot> {
  const cached = await cacheGet<RadarSnapshot>(HKO_RADAR_CACHE_KEY);
  if (!navigator.onLine && cached) {
    return { ...cached.value, freshness: "stale", error: "離線，顯示最後雷達圖 Offline cached radar" };
  }

  for (const candidate of radarCandidateUrls(now)) {
    try {
      await probeImage(candidate.url);
      const ageMs = now.getTime() - new Date(candidate.capturedAt).getTime();
      const snapshot: RadarSnapshot = {
        imageUrl: candidate.url,
        capturedAt: candidate.capturedAt,
        fetchedAt: now.toISOString(),
        freshness: ageMs > 18 * 60_000 ? "stale" : "fresh"
      };
      await cacheSet(HKO_RADAR_CACHE_KEY, snapshot);
      return snapshot;
    } catch {
      // HKO publishes shortly after each six-minute scan. Try the previous slot.
    }
  }

  if (cached) {
    return { ...cached.value, freshness: "stale", error: "雷達圖更新延遲 Radar update delayed" };
  }
  return {
    imageUrl: "",
    capturedAt: "",
    fetchedAt: now.toISOString(),
    freshness: "unavailable",
    error: "雷達圖暫時無法連線 Radar unavailable"
  };
}

function directionFromCode(code: string): "inbound" | "outbound" {
  return code === "I" ? "inbound" : "outbound";
}

function directionCode(direction: "inbound" | "outbound"): "I" | "O" {
  return direction === "inbound" ? "I" : "O";
}

function normalizeStopName(value: string): string {
  return value
    .replace(/[（(]ST\d+[）)]/gi, "")
    .replace(/巴士總站|巴士站|總站|BUS TERMINUS|BUS STOP/gi, "")
    .replace(/[\s.,，。'’\-]/g, "")
    .toUpperCase();
}

export async function searchRouteVariants(routeInput: string): Promise<RouteVariant[]> {
  const route = routeInput.trim().toUpperCase();
  if (!route) return [];

  const variants: RouteVariant[] = [];
  const [kmbResult, citybusResult] = await Promise.allSettled([
    requestJson<{ data: Array<Record<string, string>> }>(`${KMB_BASE}/route/`, "catalog:kmb:routes", 8_000),
    requestJson<{ data: Record<string, string> }>(`${CITYBUS_BASE}/route/CTB/${encodeURIComponent(route)}`, `catalog:citybus:route:${route}`, 8_000)
  ]);

  if (kmbResult.status === "fulfilled") {
    for (const item of kmbResult.value.data.data.filter((entry) => entry.route.toUpperCase() === route)) {
      const code = item.bound === "I" ? "I" : "O";
      variants.push({
        provider: "kmb",
        operator: "KMB/LWB",
        route: item.route,
        direction: directionFromCode(code),
        directionCode: code,
        serviceType: item.service_type,
        originTc: item.orig_tc,
        originEn: item.orig_en,
        destinationTc: item.dest_tc,
        destinationEn: item.dest_en
      });
    }
  }

  if (citybusResult.status === "fulfilled" && citybusResult.value.data.data?.route) {
    const item = citybusResult.value.data.data;
    const directions: Array<"inbound" | "outbound"> = ["outbound", "inbound"];
    const directionChecks = await Promise.allSettled(directions.map((direction) =>
      requestJson<{ data: Array<Record<string, string | number>> }>(
        `${CITYBUS_BASE}/route-stop/CTB/${encodeURIComponent(route)}/${direction}`,
        `catalog:citybus:route-stops:${route}:${direction}`,
        8_000
      )
    ));
    directionChecks.forEach((check, index) => {
      if (check.status !== "fulfilled" || check.value.data.data.length === 0) return;
      const direction = directions[index];
      variants.push({
        provider: "citybus",
        operator: "CTB",
        route: item.route,
        direction,
        directionCode: directionCode(direction),
        serviceType: "",
        originTc: direction === "outbound" ? item.orig_tc : item.dest_tc,
        originEn: direction === "outbound" ? item.orig_en : item.dest_en,
        destinationTc: direction === "outbound" ? item.dest_tc : item.orig_tc,
        destinationEn: direction === "outbound" ? item.dest_en : item.orig_en
      });
    });
  }

  return variants;
}

export async function loadStops(variant: RouteVariant): Promise<StopOption[]> {
  if (variant.provider === "kmb") {
    const [routeStops, stopCatalog] = await Promise.all([
      requestJson<{ data: Array<Record<string, string>> }>(
        `${KMB_BASE}/route-stop/${encodeURIComponent(variant.route)}/${variant.direction}/${encodeURIComponent(variant.serviceType)}`,
        `catalog:kmb:route-stops:${variant.route}:${variant.direction}:${variant.serviceType}`,
        8_000
      ),
      requestJson<{ data: Array<Record<string, string>> }>(`${KMB_BASE}/stop`, "catalog:kmb:stops", 12_000)
    ]);
    const byId = new Map(stopCatalog.data.data.map((stop) => [stop.stop, stop]));
    return routeStops.data.data.map((routeStop) => {
      const stop = byId.get(routeStop.stop);
      return {
        stopId: routeStop.stop,
        sequence: Number(routeStop.seq),
        nameTc: stop?.name_tc ?? routeStop.stop,
        nameEn: stop?.name_en ?? routeStop.stop
      };
    });
  }

  const routeStops = await requestJson<{ data: Array<Record<string, string | number>> }>(
    `${CITYBUS_BASE}/route-stop/CTB/${encodeURIComponent(variant.route)}/${variant.direction}`,
    `catalog:citybus:route-stops:${variant.route}:${variant.direction}`,
    8_000
  );
  const stops = await Promise.all(routeStops.data.data.map(async (routeStop) => {
    const stopId = String(routeStop.stop);
    const stop = await requestJson<{ data: Record<string, string> }>(
      `${CITYBUS_BASE}/stop/${encodeURIComponent(stopId)}`,
      `catalog:citybus:stop:${stopId}`,
      5_000
    );
    return {
      stopId,
      sequence: Number(routeStop.seq),
      nameTc: stop.data.data.name_tc,
      nameEn: stop.data.data.name_en
    } satisfies StopOption;
  }));
  return stops;
}

export async function buildSources(
  primaryVariant: RouteVariant,
  primaryStop: StopOption,
  allVariants: RouteVariant[],
  mergeJoint: boolean
): Promise<TransitSource[]> {
  const sourceFrom = (variant: RouteVariant, stop: StopOption): TransitSource => ({
    provider: variant.provider,
    operator: variant.operator,
    route: variant.route,
    direction: variant.direction,
    directionCode: variant.directionCode,
    serviceType: variant.serviceType,
    stopId: stop.stopId,
    stopSequence: stop.sequence,
    stopNameTc: stop.nameTc,
    stopNameEn: stop.nameEn,
    destinationTc: variant.destinationTc,
    destinationEn: variant.destinationEn
  });

  const sources = [sourceFrom(primaryVariant, primaryStop)];
  if (!mergeJoint) return sources;

  const candidates = allVariants.filter((variant) =>
    variant.provider !== primaryVariant.provider &&
    variant.route === primaryVariant.route &&
    variant.directionCode === primaryVariant.directionCode
  );
  for (const candidate of candidates) {
    try {
      const stops = await loadStops(candidate);
      const match = stops.find((stop) =>
        normalizeStopName(stop.nameTc) === normalizeStopName(primaryStop.nameTc) ||
        normalizeStopName(stop.nameEn) === normalizeStopName(primaryStop.nameEn)
      );
      if (match) sources.push(sourceFrom(candidate, match));
    } catch {
      // A failed partner operator must not block saving the primary board.
    }
  }
  return sources;
}

async function fetchSourceEta(source: TransitSource): Promise<{ items: EtaItem[]; stale: boolean; storedAt: number }> {
  const url = source.provider === "kmb"
    ? `${KMB_BASE}/eta/${encodeURIComponent(source.stopId)}/${encodeURIComponent(source.route)}/${encodeURIComponent(source.serviceType)}`
    : `${CITYBUS_BASE}/eta/CTB/${encodeURIComponent(source.stopId)}/${encodeURIComponent(source.route)}`;
  const result = await requestJson<{ data: Array<Record<string, string | number | null>> }>(
    url,
    `eta:${source.provider}:${source.stopId}:${source.route}:${source.serviceType}`,
    4_000
  );
  const now = Date.now();
  const items = result.data.data
    .filter((entry) => {
      if (!entry.eta) return false;
      const seqMatches = Number(entry.seq) === source.stopSequence;
      const directionMatches = !entry.dir || String(entry.dir) === source.directionCode;
      const serviceMatches = source.provider !== "kmb" || String(entry.service_type) === source.serviceType;
      return seqMatches && directionMatches && serviceMatches;
    })
    .map((entry) => {
      const arrivalTime = String(entry.eta);
      const remarkTc = String(entry.rmk_tc ?? "");
      const remarkEn = String(entry.rmk_en ?? "");
      return {
        provider: source.provider,
        operator: String(entry.co ?? source.operator),
        arrivalTime,
        minutes: Math.max(0, Math.ceil((new Date(arrivalTime).getTime() - now) / 60_000)),
        scheduled: /原定班次|scheduled/i.test(`${remarkTc} ${remarkEn}`),
        remarkTc,
        remarkEn
      } satisfies EtaItem;
    });
  return { items, stale: result.stale, storedAt: result.storedAt };
}

export async function fetchBoardEta(board: TransitBoardConfig): Promise<TransitSnapshot> {
  const settled = await Promise.allSettled(board.sources.map(fetchSourceEta));
  const successful = settled.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchSourceEta>>> => result.status === "fulfilled");
  if (successful.length === 0) {
    return {
      boardId: board.id,
      items: [],
      fetchedAt: new Date().toISOString(),
      freshness: "unavailable",
      error: "ETA暫時無法連線 ETA unavailable"
    };
  }
  const seen = new Set<string>();
  const items = successful
    .flatMap((result) => result.value.items)
    .sort((a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime())
    .filter((item) => {
      const key = `${Math.round(new Date(item.arrivalTime).getTime() / 60_000)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, board.etaLimit);
  return {
    boardId: board.id,
    items,
    fetchedAt: new Date(Math.max(...successful.map((result) => result.value.storedAt))).toISOString(),
    freshness: successful.some((result) => result.value.stale) ? "stale" : "fresh",
    error: successful.length < board.sources.length ? "部分營辦商暫時無法連線 Partial outage" : undefined
  };
}

interface HkoCurrent {
  updateTime?: string;
  icon?: number[];
  temperature?: { data: Array<{ place: string; value: number }> };
  humidity?: { data: Array<{ place: string; value: number }> };
  rainfall?: { data: Array<{ place: string; min?: number; max?: number }> };
  warningMessage?: string[];
}

interface HkoWarningSummary {
  [code: string]: { code: string; name: string };
}

interface WeatherWarningsResult {
  warnings: WeatherWarning[];
  stale: boolean;
}

export async function fetchWeatherWarnings(): Promise<WeatherWarningsResult> {
  const [warningsTcResult, warningsEnResult] = await Promise.allSettled([
    requestJson<HkoWarningSummary>(`${HKO_BASE}?dataType=warnsum&lang=tc`, "weather:hko:warnings:tc", 12_000),
    requestJson<HkoWarningSummary>(`${HKO_BASE}?dataType=warnsum&lang=en`, "weather:hko:warnings:en", 12_000)
  ]);
  if (warningsTcResult.status === "rejected" && warningsEnResult.status === "rejected") {
    throw new Error("Weather warnings unavailable");
  }
  const warningsTc = warningsTcResult.status === "fulfilled" ? warningsTcResult.value : null;
  const warningsEn = warningsEnResult.status === "fulfilled" ? warningsEnResult.value : null;
  const warningCodes = [...new Set([
    ...Object.keys(warningsTc?.data ?? {}),
    ...Object.keys(warningsEn?.data ?? {})
  ])];
  const availableResults = [warningsTc, warningsEn].filter((result): result is FetchResult<HkoWarningSummary> => result !== null);
  return {
    warnings: warningCodes.map((code) => ({
      code,
      nameTc: warningsTc?.data[code]?.name ?? warningsEn?.data[code]?.name ?? code,
      nameEn: warningsEn?.data[code]?.name ?? warningsTc?.data[code]?.name ?? code
    })),
    // One live language response is enough to prove the warning service is
    // current. The other language can fall back without degrading the whole app.
    stale: availableResults.every((result) => result.stale)
  };
}

export async function loadWeatherStations(): Promise<Array<{ tc: string; en: string }>> {
  const [tc, en] = await Promise.all([
    requestJson<HkoCurrent>(`${HKO_BASE}?dataType=rhrread&lang=tc`, "weather:hko:current:tc"),
    requestJson<HkoCurrent>(`${HKO_BASE}?dataType=rhrread&lang=en`, "weather:hko:current:en")
  ]);
  const tcItems = tc.data.temperature?.data ?? [];
  const enItems = en.data.temperature?.data ?? [];
  return tcItems.map((item, index) => ({ tc: item.place, en: enItems[index]?.place ?? item.place }));
}

export async function fetchWeather(stationTc: string, stationEn: string): Promise<WeatherSnapshot> {
  try {
    const currentTc = await requestJson<HkoCurrent>(`${HKO_BASE}?dataType=rhrread&lang=tc`, "weather:hko:current:tc", 15_000);
    const [currentEnResult, warningResult] = await Promise.allSettled([
      requestJson<HkoCurrent>(`${HKO_BASE}?dataType=rhrread&lang=en`, "weather:hko:current:en", 12_000),
      fetchWeatherWarnings()
    ]);
    const currentEn = currentEnResult.status === "fulfilled" ? currentEnResult.value : null;
    const warnings = warningResult.status === "fulfilled" ? warningResult.value : null;
    const temperature = currentTc.data.temperature?.data.find((item) => item.place === stationTc)?.value ?? null;
    const rainfall = currentTc.data.rainfall?.data.find((item) => item.place === stationTc);
    const humidity = currentTc.data.humidity?.data[0]?.value ?? null;
    return {
      temperature,
      humidity,
      rainfallMin: rainfall?.min ?? null,
      rainfallMax: rainfall?.max ?? null,
      iconCode: currentTc.data.icon?.[0] ?? null,
      warnings: warnings?.warnings ?? [],
      warningMessageTc: currentTc.data.warningMessage ?? [],
      warningMessageEn: currentEn?.data.warningMessage ?? [],
      warningFreshness: warnings ? (warnings.stale ? "stale" : "fresh") : "unavailable",
      updatedAt: currentTc.data.updateTime ?? new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
      freshness: currentTc.stale ? "stale" : "fresh"
    };
  } catch (error) {
    return {
      temperature: null,
      humidity: null,
      rainfallMin: null,
      rainfallMax: null,
      iconCode: null,
      warnings: [],
      warningMessageTc: [],
      warningMessageEn: [],
      warningFreshness: "unavailable",
      updatedAt: "",
      fetchedAt: new Date().toISOString(),
      freshness: "unavailable",
      error: error instanceof Error && error.name === "AbortError"
        ? "天文台回應逾時，將自動重試 · HKO response timed out; retrying automatically"
        : "天文台暫時無法連線，將自動重試 · HKO temporarily unavailable; retrying automatically"
    };
  }
}
