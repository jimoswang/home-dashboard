import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BusFront,
  Cloud,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSun,
  CloudSunRain,
  Download,
  Droplets,
  GripVertical,
  Maximize2,
  MonitorOff,
  Moon,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  Wind,
  Wifi,
  WifiOff,
  X
} from "lucide-react";
import {
  buildSources,
  fetchBoardEta,
  fetchRadar,
  fetchWeather,
  fetchWeatherWarnings,
  loadStops,
  loadWeatherStations,
  POLL_INTERVALS,
  searchRouteVariants
} from "./api";
import {
  exportableConfig,
  loadConfig,
  parseImportedConfig,
  saveConfig
} from "./config";
import { hasFullyKiosk, isWithinSleepWindow, requestScreenOff, syncFullySchedule } from "./fully";
import { createPinRecord, verifyPin } from "./pin";
import type {
  AppConfig,
  Profile,
  RadarSnapshot,
  RouteVariant,
  StopOption,
  TransitBoardConfig,
  TransitSnapshot,
  WeatherSnapshot
} from "./types";
import { resolveHeroPhoto, resolveHeroScene, resolveWeatherPresentation, type WeatherGlyph } from "./weatherPresentation";

const emptyWeather: WeatherSnapshot = {
  temperature: null,
  humidity: null,
  rainfallMin: null,
  rainfallMax: null,
  iconCode: null,
  warnings: [],
  warningMessageTc: [],
  warningMessageEn: [],
  updatedAt: "",
  fetchedAt: "",
  freshness: "unavailable"
};

const emptyRadar: RadarSnapshot = {
  imageUrl: "",
  capturedAt: "",
  fetchedAt: "",
  freshness: "unavailable"
};

const APP_VERSION = "1.3.0";
const APP_BUILD = (import.meta.env.VITE_BUILD_ID || "LOCAL").slice(0, 7).toUpperCase();

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

function formatSeconds(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    second: "2-digit"
  }).format(date);
}

function formatDateTc(date: Date): string {
  return new Intl.DateTimeFormat("zh-HK", {
    timeZone: "Asia/Hong_Kong",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(date);
}

function formatDateEn(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(date);
}

function formatUpdated(value: string): string {
  if (!value) return "--:--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--:--" : formatTime(date);
}

function WeatherIcon({ glyph, size = 72 }: { glyph: WeatherGlyph; size?: number }) {
  const props = { size, strokeWidth: 1.6, "aria-hidden": true };
  if (glyph === "sun") return <Sun {...props} />;
  if (glyph === "cloud-sun") return <CloudSun {...props} />;
  if (glyph === "sun-rain") return <CloudSunRain {...props} />;
  if (glyph === "rain") return <CloudRain {...props} />;
  if (glyph === "thunderstorm") return <CloudLightning {...props} />;
  if (glyph === "moon") return <Moon {...props} />;
  if (glyph === "cloud-moon") return <CloudMoon {...props} />;
  if (glyph === "wind") return <Wind {...props} />;
  if (glyph === "droplets") return <Droplets {...props} />;
  return <Cloud {...props} />;
}

function StatusPill({ freshness }: { freshness: TransitSnapshot["freshness"] | WeatherSnapshot["freshness"] }) {
  const labels = {
    fresh: ["即時", "LIVE"],
    stale: ["快取", "CACHED"],
    unavailable: ["暫停", "OFFLINE"]
  } as const;
  return (
    <span className={`status-pill ${freshness}`}>
      <b>{labels[freshness][0]}</b><small>{labels[freshness][1]}</small>
    </span>
  );
}

interface PinDialogProps {
  title: string;
  subtitle: string;
  onSubmit: (pin: string) => Promise<boolean>;
  onClose: () => void;
}

function PinDialog({ title, subtitle, onSubmit, onClose }: PinDialogProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pin.length !== 6 || busy) return;
    setBusy(true);
    const accepted = await onSubmit(pin);
    setBusy(false);
    if (!accepted) {
      setError(true);
      setPin("");
    }
  };

  useEffect(() => {
    if (pin.length === 6) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="pin-dialog">
        <button className="icon-button close-button" onClick={onClose} aria-label="Close"><X /></button>
        <ShieldCheck size={48} />
        <h2>{title}</h2>
        <p>{subtitle}</p>
        <div className="pin-dots" aria-label={`${pin.length} digits entered`}>
          {Array.from({ length: 6 }, (_, index) => <i key={index} className={index < pin.length ? "filled" : ""} />)}
        </div>
        {error && <div className="form-error">PIN錯誤 Incorrect PIN</div>}
        <div className="pin-pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button key={digit} onClick={() => setPin((value) => `${value}${digit}`.slice(0, 6))}>{digit}</button>
          ))}
          <button className="pin-clear" onClick={() => setPin("")}>清除<small>Clear</small></button>
          <button onClick={() => setPin((value) => `${value}0`.slice(0, 6))}>0</button>
          <button className="pin-back" onClick={() => setPin((value) => value.slice(0, -1))}>⌫</button>
        </div>
      </div>
    </div>
  );
}

interface RouteBuilderProps {
  onAdd: (board: TransitBoardConfig) => void;
}

function RouteBuilder({ onAdd }: RouteBuilderProps) {
  const [route, setRoute] = useState("");
  const [variants, setVariants] = useState<RouteVariant[]>([]);
  const [variant, setVariant] = useState<RouteVariant | null>(null);
  const [stops, setStops] = useState<StopOption[]>([]);
  const [stop, setStop] = useState<StopOption | null>(null);
  const [stopQuery, setStopQuery] = useState("");
  const [mergeJoint, setMergeJoint] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const findRoute = async () => {
    setBusy(true);
    setMessage("");
    setVariant(null);
    setStops([]);
    setStop(null);
    try {
      const found = await searchRouteVariants(route);
      setVariants(found);
      if (found.length === 0) setMessage("搵唔到呢條路線 Route not found");
    } catch {
      setMessage("路線資料暫時無法連線 Route search unavailable");
    } finally {
      setBusy(false);
    }
  };

  const chooseVariant = async (selected: RouteVariant) => {
    setVariant(selected);
    setStop(null);
    setStopQuery("");
    setBusy(true);
    setMessage("");
    try {
      setStops(await loadStops(selected));
    } catch {
      setMessage("站牌資料暫時無法連線 Stops unavailable");
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!variant || !stop) return;
    setBusy(true);
    try {
      const sources = await buildSources(variant, stop, variants, mergeJoint);
      onAdd({
        id: newId("board"),
        labelTc: stop.nameTc,
        labelEn: stop.nameEn,
        route: variant.route,
        sources,
        etaLimit: 3,
        sortOrder: 999
      });
      setRoute("");
      setVariants([]);
      setVariant(null);
      setStops([]);
      setStop(null);
      setMessage("已加入 Added");
    } finally {
      setBusy(false);
    }
  };

  const filteredStops = stops.filter((item) => {
    const query = stopQuery.trim().toLowerCase();
    return !query || item.nameTc.includes(query) || item.nameEn.toLowerCase().includes(query);
  });

  return (
    <section className="settings-card route-builder">
      <div className="section-title"><Plus /><div><h3>加入巴士站</h3><p>Add bus stop</p></div></div>
      <div className="inline-form">
        <label><span>路線 Route</span><input value={route} onChange={(event) => setRoute(event.target.value.toUpperCase())} placeholder="例如 289K" /></label>
        <button className="primary-button" disabled={!route.trim() || busy} onClick={() => void findRoute()}>{busy ? "搜尋中…" : "搜尋 Search"}</button>
      </div>
      {variants.length > 0 && (
        <div className="choice-list">
          {variants.map((item) => (
            <button
              key={`${item.provider}-${item.direction}-${item.serviceType}`}
              className={variant === item ? "selected" : ""}
              onClick={() => void chooseVariant(item)}
            >
              <b>{item.operator} · {item.route}</b>
              <span>{item.originTc} → {item.destinationTc}</span>
              <small>{item.originEn} → {item.destinationEn}</small>
            </button>
          ))}
        </div>
      )}
      {stops.length > 0 && (
        <>
          <label className="full-field"><span>站名 Stop name</span><input value={stopQuery} onChange={(event) => setStopQuery(event.target.value)} placeholder="輸入中文或英文搜尋" /></label>
          <div className="stop-list">
            {filteredStops.map((item) => (
              <button key={`${item.stopId}-${item.sequence}`} className={stop?.stopId === item.stopId && stop.sequence === item.sequence ? "selected" : ""} onClick={() => setStop(item)}>
                <b>{item.sequence}</b><span>{item.nameTc}<small>{item.nameEn}</small></span>
              </button>
            ))}
          </div>
          <label className="toggle-row"><input type="checkbox" checked={mergeJoint} onChange={(event) => setMergeJoint(event.target.checked)} /><span><b>合併聯營班次</b><small>Merge matching joint-operator arrivals</small></span></label>
          <button className="primary-button wide" disabled={!stop || busy} onClick={() => void add()}>加入資訊板 Add to dashboard</button>
        </>
      )}
      {message && <div className="form-message">{message}</div>}
    </section>
  );
}

interface SettingsPanelProps {
  config: AppConfig;
  onChange: (config: AppConfig) => void;
  onClose: () => void;
}

function SettingsPanel({ config, onChange, onClose }: SettingsPanelProps) {
  const [draft, setDraft] = useState<AppConfig>(() => structuredClone(config));
  const [stations, setStations] = useState<Array<{ tc: string; en: string }>>([]);
  const [newPin, setNewPin] = useState("");
  const [pinMessage, setPinMessage] = useState("");
  const [integrationMessage, setIntegrationMessage] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const profile = draft.profiles.find((item) => item.id === draft.activeProfileId) ?? draft.profiles[0];

  useEffect(() => {
    void loadWeatherStations().then(setStations).catch(() => undefined);
  }, []);

  const updateProfile = (updater: (profile: Profile) => Profile) => {
    setDraft((current) => ({
      ...current,
      profiles: current.profiles.map((item) => item.id === current.activeProfileId ? updater(item) : item)
    }));
  };

  const saveAndClose = () => {
    saveConfig(draft);
    onChange(draft);
    const active = draft.profiles.find((item) => item.id === draft.activeProfileId) ?? draft.profiles[0];
    syncFullySchedule(active.display.alwaysOn, active.display.sleepTime, active.display.wakeTime);
    onClose();
  };

  const addProfile = () => {
    const id = newId("profile");
    const next: Profile = {
      id,
      nameTc: "新屋企",
      nameEn: "新屋企",
      weatherStationTc: "沙田",
      weatherStationEn: "Sha Tin",
      transitBoards: [],
      display: { alwaysOn: false, sleepTime: "20:00", wakeTime: "06:30", theme: "kmb", pixelShift: true, weatherAnimation: true }
    };
    setDraft((current) => ({ ...current, activeProfileId: id, profiles: [...current.profiles, next] }));
  };

  const deleteProfile = () => {
    if (draft.profiles.length <= 1) return;
    const remaining = draft.profiles.filter((item) => item.id !== draft.activeProfileId);
    setDraft((current) => ({ ...current, activeProfileId: remaining[0].id, profiles: remaining }));
  };

  const addBoard = (board: TransitBoardConfig) => updateProfile((item) => ({
    ...item,
    transitBoards: [...item.transitBoards, { ...board, sortOrder: item.transitBoards.length }]
  }));

  const removeBoard = (id: string) => updateProfile((item) => ({
    ...item,
    transitBoards: item.transitBoards.filter((board) => board.id !== id)
  }));

  const setPin = async () => {
    if (!/^\d{6}$/.test(newPin)) {
      setPinMessage("請輸入6位數字 Enter six digits");
      return;
    }
    const record = await createPinRecord(newPin);
    setDraft((current) => ({ ...current, adminPin: record }));
    setNewPin("");
    setPinMessage("PIN已更新 PIN updated");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(exportableConfig(draft), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `home-dashboard-config-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file?: File) => {
    if (!file) return;
    try {
      const imported = parseImportedConfig(await file.text());
      setDraft({ ...imported, adminPin: draft.adminPin });
      setIntegrationMessage("設定已匯入 Config imported");
    } catch {
      setIntegrationMessage("JSON格式錯誤 Invalid config file");
    }
  };

  const syncSchedule = () => {
    if (syncFullySchedule(profile.display.alwaysOn, profile.display.sleepTime, profile.display.wakeTime)) {
      setIntegrationMessage("已同步至Fully Kiosk Synced");
    } else {
      setIntegrationMessage("目前唔係Fully Kiosk環境 Not running in Fully Kiosk");
    }
  };

  return (
    <div className="settings-shell" role="dialog" aria-modal="true">
      <header className="settings-header">
        <div><h1>設定</h1><p>SETTINGS</p></div>
        <div className="settings-actions">
          <button className="secondary-button" onClick={onClose}>取消 Cancel</button>
          <button className="primary-button" disabled={!draft.adminPin} onClick={saveAndClose}>儲存完成 Save</button>
        </div>
      </header>
      <main className="settings-content">
        <section className="settings-card">
          <div className="section-title"><Settings /><div><h3>Profile</h3><p>HOME PROFILE</p></div></div>
          <div className="profile-tabs">
            {draft.profiles.map((item) => <button key={item.id} className={item.id === draft.activeProfileId ? "active" : ""} onClick={() => setDraft((current) => ({ ...current, activeProfileId: item.id }))}>{item.nameTc}</button>)}
            <button className="add-profile" onClick={addProfile}><Plus />新增</button>
          </div>
          <label className="full-field"><span>Profile 名稱 Profile name</span><input value={profile.nameTc} onChange={(event) => updateProfile((item) => ({ ...item, nameTc: event.target.value, nameEn: event.target.value }))} /></label>
          {draft.profiles.length > 1 && <button className="danger-button" onClick={deleteProfile}><Trash2 />刪除此Profile Delete</button>}
        </section>

        <section className="settings-card">
          <div className="section-title"><CloudSun /><div><h3>天氣地點</h3><p>WEATHER LOCATION</p></div></div>
          <label className="full-field"><span>香港天文台測站 HKO station</span>
            <select value={`${profile.weatherStationTc}|${profile.weatherStationEn}`} onChange={(event) => {
              const [tc, en] = event.target.value.split("|");
              updateProfile((item) => ({ ...item, weatherStationTc: tc, weatherStationEn: en }));
            }}>
              {(stations.length > 0 ? stations : [{ tc: profile.weatherStationTc, en: profile.weatherStationEn }]).map((station) => <option key={`${station.tc}-${station.en}`} value={`${station.tc}|${station.en}`}>{station.tc} · {station.en}</option>)}
            </select>
          </label>
        </section>

        <section className="settings-card">
          <div className="section-title"><MonitorOff /><div><h3>螢幕時間</h3><p>SCREEN SCHEDULE</p></div></div>
          <label className="full-field"><span>主畫面風格 Dashboard style</span>
            <select value={profile.display.theme} onChange={(event) => updateProfile((item) => ({ ...item, display: { ...item.display, theme: event.target.value as "kmb" | "dark" } }))}>
              <option value="kmb">九巴熟悉版 · KMB familiar</option>
              <option value="dark">深色版 · Dark</option>
            </select>
          </label>
          <label className="toggle-row"><input type="checkbox" checked={profile.display.alwaysOn} onChange={(event) => updateProfile((item) => ({ ...item, display: { ...item.display, alwaysOn: event.target.checked } }))} /><span><b>長開螢幕</b><small>Always on</small></span></label>
          <label className="toggle-row"><input type="checkbox" checked={profile.display.weatherAnimation !== false} onChange={(event) => updateProfile((item) => ({ ...item, display: { ...item.display, weatherAnimation: event.target.checked } }))} /><span><b>天氣背景動畫</b><small>Weather background animation</small></span></label>
          <div className="two-columns schedule-fields">
            <label><span>關閉 Sleep</span><input type="time" disabled={profile.display.alwaysOn} value={profile.display.sleepTime} onChange={(event) => updateProfile((item) => ({ ...item, display: { ...item.display, sleepTime: event.target.value } }))} /></label>
            <label><span>亮起 Wake</span><input type="time" disabled={profile.display.alwaysOn} value={profile.display.wakeTime} onChange={(event) => updateProfile((item) => ({ ...item, display: { ...item.display, wakeTime: event.target.value } }))} /></label>
          </div>
          <button className="secondary-button wide" onClick={syncSchedule}>同步至Fully Kiosk Sync schedule</button>
          <p className="helper-text">Fully Kiosk PLUS及Device Administrator權限先可以真正熄screen。Without it, dashboard uses a black fallback screen.</p>
        </section>

        <section className="settings-card">
          <div className="section-title"><BusFront /><div><h3>已選巴士站</h3><p>BUS BOARDS</p></div></div>
          <div className="board-settings-list">
            {profile.transitBoards.map((board) => (
              <div key={board.id} className="board-settings-row">
                <GripVertical />
                <strong>{board.route}</strong>
                <span>{board.labelTc}<small>{board.labelEn}</small></span>
                <em>{board.sources.map((source) => source.operator).join(" + ")}</em>
                <button className="icon-button danger" onClick={() => removeBoard(board.id)} aria-label="Delete"><Trash2 /></button>
              </div>
            ))}
            {profile.transitBoards.length === 0 && <p className="empty-note">未有巴士站 No bus stops yet</p>}
          </div>
        </section>

        <RouteBuilder onAdd={addBoard} />

        <section className="settings-card">
          <div className="section-title"><RefreshCw /><div><h3>巴士更新頻率</h3><p>BUS REFRESH RATE</p></div></div>
          <div className="segmented">
            {[30, 60, 120, 300].map((seconds) => <button key={seconds} className={draft.refreshSeconds === seconds ? "active" : ""} onClick={() => setDraft((current) => ({ ...current, refreshSeconds: seconds }))}>{seconds < 60 ? `${seconds}秒` : `${seconds / 60}分鐘`}<small>{seconds}s</small></button>)}
          </div>
          <p className="helper-text">天氣每10分鐘、警告及雷達每5分鐘更新。Weather every 10m; warnings and radar every 5m.</p>
        </section>

        <section className="settings-card">
          <div className="section-title"><ShieldCheck /><div><h3>Admin PIN</h3><p>SIX DIGITS</p></div></div>
          <div className="inline-form">
            <label><span>{draft.adminPin ? "更改PIN Change PIN" : "設定PIN Set PIN"}</span><input type="password" inputMode="numeric" maxLength={6} value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, ""))} placeholder="••••••" /></label>
            <button className="primary-button" onClick={() => void setPin()}>更新 Update</button>
          </div>
          {pinMessage && <div className="form-message">{pinMessage}</div>}
          {!draft.adminPin && <p className="helper-text">首次設定必須建立6位PIN先可以儲存。A six-digit PIN is required before first save.</p>}
        </section>

        <section className="settings-card">
          <div className="section-title"><Download /><div><h3>備份與還原</h3><p>BACKUP & RESTORE</p></div></div>
          <div className="backup-buttons">
            <button className="secondary-button" onClick={exportJson}><Download />匯出JSON Export</button>
            <button className="secondary-button" onClick={() => importRef.current?.click()}><Upload />匯入JSON Import</button>
            <input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importJson(event.target.files?.[0])} />
          </div>
          <p className="helper-text">安全起見，Export唔會包含Admin PIN。Admin PIN is never exported.</p>
        </section>
        {integrationMessage && <div className="settings-toast">{integrationMessage}</div>}
      </main>
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState<AppConfig>(() => loadConfig());
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<WeatherSnapshot>(emptyWeather);
  const [radar, setRadar] = useState<RadarSnapshot>(emptyRadar);
  const [transit, setTransit] = useState<Record<string, TransitSnapshot>>({});
  const [online, setOnline] = useState(navigator.onLine);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [manualSleep, setManualSleep] = useState(false);
  const [wakeOverride, setWakeOverride] = useState(false);
  const [radarOpen, setRadarOpen] = useState(false);
  const holdStartedAt = useRef<number | null>(null);
  const holdFrame = useRef<number | null>(null);
  const activeProfile = config.profiles.find((item) => item.id === config.activeProfileId) ?? config.profiles[0];

  const refreshTransit = useCallback(async () => {
    setRefreshing(true);
    try {
      const etaResults = await Promise.all(activeProfile.transitBoards.map(fetchBoardEta));
      setTransit(Object.fromEntries(etaResults.map((snapshot) => [snapshot.boardId, snapshot])));
    } finally {
      setRefreshing(false);
    }
  }, [activeProfile.transitBoards]);

  const refreshWeather = useCallback(async () => {
    setWeather(await fetchWeather(activeProfile.weatherStationTc, activeProfile.weatherStationEn));
  }, [activeProfile.weatherStationEn, activeProfile.weatherStationTc]);

  const refreshWarnings = useCallback(async () => {
    try {
      const result = await fetchWeatherWarnings();
      setWeather((current) => ({ ...current, warnings: result.warnings }));
    } catch {
      // Keep the last warning summary if HKO is temporarily unavailable.
    }
  }, []);

  const refreshRadar = useCallback(async () => {
    setRadar(await fetchRadar());
  }, []);

  const refreshAllAndCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      await Promise.all([refreshTransit(), refreshWeather(), refreshRadar()]);
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.update();
      }
    } catch {
      // Data requests already provide cache fallbacks. A failed update check must not interrupt the dashboard.
    } finally {
      setCheckingUpdate(false);
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    void refreshTransit();
    const timer = window.setInterval(() => void refreshTransit(), config.refreshSeconds * 1_000);
    return () => window.clearInterval(timer);
  }, [config.refreshSeconds, refreshTransit]);

  useEffect(() => {
    void refreshWeather();
    const timer = window.setInterval(() => void refreshWeather(), POLL_INTERVALS.weather);
    return () => window.clearInterval(timer);
  }, [refreshWeather]);

  useEffect(() => {
    const timer = window.setInterval(() => void refreshWarnings(), POLL_INTERVALS.warnings);
    return () => window.clearInterval(timer);
  }, [refreshWarnings]);

  useEffect(() => {
    void refreshRadar();
    const timer = window.setInterval(() => void refreshRadar(), POLL_INTERVALS.radar);
    return () => window.clearInterval(timer);
  }, [refreshRadar]);

  useEffect(() => {
    saveConfig(config);
  }, [config]);

  const startHold = () => {
    holdStartedAt.current = performance.now();
    const tick = () => {
      if (holdStartedAt.current === null) return;
      const progress = Math.min(1, (performance.now() - holdStartedAt.current) / 3_000);
      setHoldProgress(progress);
      if (progress >= 1) {
        holdStartedAt.current = null;
        setHoldProgress(0);
        if (config.adminPin) setPinOpen(true);
        else setSettingsOpen(true);
        navigator.vibrate?.(80);
        return;
      }
      holdFrame.current = requestAnimationFrame(tick);
    };
    holdFrame.current = requestAnimationFrame(tick);
  };

  const cancelHold = () => {
    holdStartedAt.current = null;
    setHoldProgress(0);
    if (holdFrame.current !== null) cancelAnimationFrame(holdFrame.current);
  };

  const scheduledSleep = useMemo(() => {
    const hongKongNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" }));
    return !activeProfile.display.alwaysOn && isWithinSleepWindow(hongKongNow, activeProfile.display.sleepTime, activeProfile.display.wakeTime);
  }, [activeProfile.display, now]);

  const sleeping = manualSleep || (!hasFullyKiosk() && scheduledSleep && !wakeOverride);

  useEffect(() => {
    if (!scheduledSleep) setWakeOverride(false);
  }, [scheduledSleep]);

  useEffect(() => {
    if (sleeping && hasFullyKiosk()) requestScreenOff();
  }, [sleeping]);

  const openSettingsAfterPin = async (pin: string) => {
    if (!config.adminPin) return true;
    const valid = await verifyPin(pin, config.adminPin);
    if (valid) {
      setPinOpen(false);
      setSettingsOpen(true);
    }
    return valid;
  };

  const profileBoards = [...activeProfile.transitBoards].sort((a, b) => a.sortOrder - b.sortOrder);
  const servicesLoaded = weather.fetchedAt !== "" && radar.fetchedAt !== "" && profileBoards.every((board) => transit[board.id]?.fetchedAt);
  const affectedServicesTc = [
    weather.freshness !== "fresh" ? "天氣" : null,
    radar.freshness !== "fresh" ? "雷達" : null,
    ...profileBoards.map((board) => {
      const snapshot = transit[board.id];
      return snapshot && (snapshot.freshness !== "fresh" || snapshot.error) ? `巴士 ${board.route}` : null;
    })
  ].filter((label): label is string => Boolean(label));
  const affectedServicesEn = [
    weather.freshness !== "fresh" ? "WEATHER" : null,
    radar.freshness !== "fresh" ? "RADAR" : null,
    ...profileBoards.map((board) => {
      const snapshot = transit[board.id];
      return snapshot && (snapshot.freshness !== "fresh" || snapshot.error) ? `BUS ${board.route}` : null;
    })
  ].filter((label): label is string => Boolean(label));
  const overallDegraded = servicesLoaded && affectedServicesTc.length > 0;
  const connectionClass = !online ? "offline" : !servicesLoaded ? "loading" : overallDegraded ? "degraded" : "online";
  const connectionTitle = !online
    ? "離線模式"
    : !servicesLoaded
      ? "正在載入資料"
      : overallDegraded
        ? `受阻：${affectedServicesTc.join(" · ")}`
        : "連線正常";
  const connectionSubtitle = !online
    ? "OFFLINE MODE"
    : !servicesLoaded
      ? "LOADING DATA"
      : overallDegraded
        ? affectedServicesEn.join(" · ")
        : "CONNECTED";
  const radarDelayed = radar.freshness === "stale" || (radar.capturedAt ? now.getTime() - new Date(radar.capturedAt).getTime() > 18 * 60_000 : false);
  const pixelShift = activeProfile.display.pixelShift ? `shift-${now.getMinutes() % 4}` : "";
  const weatherPresentation = resolveWeatherPresentation(weather.iconCode);
  const heroScene = resolveHeroScene(weatherPresentation.scene, weather.warnings.map((warning) => warning.code));
  const heroPhoto = resolveHeroPhoto(heroScene);
  const weatherMotion = activeProfile.display.weatherAnimation !== false ? "weather-motion" : "weather-still";

  if (sleeping && !settingsOpen) {
    return (
      <div className="sleep-screen" onClick={() => { setManualSleep(false); setWakeOverride(true); }}>
        <span>{formatTime(now)}</span>
        <small>輕觸返回 Tap to wake</small>
      </div>
    );
  }

  return (
    <div className={`app-shell theme-${activeProfile.display.theme} ${pixelShift}`}>
      <header className={`weather-hero scene-${heroScene} ${weatherMotion}`}>
        <div className="weather-scene" aria-hidden="true">
          <img
            className="scene-photo"
            src={`${import.meta.env.BASE_URL}weather-scenes/tolo-cuhk-${heroPhoto}.webp`}
            alt=""
            decoding="async"
          />
          <span className="scene-rain" />
          <span className="scene-lightning" />
        </div>
        <div className="weather-hero-content">
          <div
            className="clock-zone"
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerCancel={cancelHold}
            onPointerLeave={cancelHold}
            style={{ "--hold-progress": `${holdProgress * 360}deg` } as React.CSSProperties}
            title="Long press 3 seconds for settings"
          >
            <div className="clock"><span>{formatTime(now)}</span><small>{formatSeconds(now)}</small></div>
            <div className="date"><b>{formatDateTc(now)}</b><span>{formatDateEn(now)}</span></div>
          </div>
          <div className="profile-zone">
            <select value={config.activeProfileId} onChange={(event) => setConfig((current) => ({ ...current, activeProfileId: event.target.value }))}>
              {config.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.nameTc}</option>)}
            </select>
            <div className={`connection ${connectionClass}`} title={`${connectionTitle} · ${connectionSubtitle}`}>
              {online ? <Wifi /> : <WifiOff />}
              <span><b>{connectionTitle}</b><small>{connectionSubtitle}</small></span>
            </div>
            <button
              className={`refresh-button ${refreshing || checkingUpdate ? "spinning" : ""}`}
              onClick={() => void refreshAllAndCheckUpdate()}
              aria-label="更新資料及檢查新版 Refresh data and check for updates"
              title="更新資料及檢查新版"
            ><RefreshCw /></button>
          </div>
        </div>
        <div className={`hero-ribbon ${weather.warnings.length > 0 ? "warning" : "quiet"}`} title={weather.warnings.map((warning) => `${warning.nameTc} ${warning.nameEn}`).join(" · ")}>
          {weather.warnings.length > 0 ? <CloudLightning /> : <WeatherIcon glyph={weatherPresentation.glyph} size={25} />}
          <div>
            <b>{weather.warnings.length > 0 ? weather.warnings.map((warning) => warning.nameTc).join(" · ") : weatherPresentation.labelTc}</b>
            <span>{weather.warnings.length > 0 ? weather.warnings.map((warning) => warning.nameEn).join(" · ") : weatherPresentation.labelEn}</span>
          </div>
          <small>天文台更新 {formatUpdated(weather.updatedAt)} · HKO UPDATED</small>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="weather-card panel">
          <div className="panel-heading">
            <div><h2>天氣</h2><p>WEATHER · {activeProfile.weatherStationEn.toUpperCase()}</p></div>
            <StatusPill freshness={weather.freshness} />
          </div>
          <div className="weather-main">
            <WeatherIcon glyph={weatherPresentation.glyph} />
            <div className="temperature"><strong>{weather.temperature ?? "—"}</strong><sup>°C</sup></div>
            <div className="station-name"><b>{activeProfile.weatherStationTc}</b><span>{activeProfile.weatherStationEn}</span></div>
          </div>
          <div className="weather-details">
            <div><Droplets /><span><b>{weather.humidity ?? "—"}%</b><small>濕度 HUMIDITY</small></span></div>
            <div><CloudRain /><span><b>{weather.rainfallMax ?? 0} mm</b><small>過去一小時 RAINFALL</small></span></div>
          </div>
          <div className={`rain-advice ${(weather.rainfallMax ?? 0) > 0 || weather.warnings.length > 0 ? "rain" : "clear"}`}>
            <b>{(weather.rainfallMax ?? 0) > 0 ? "出門記得帶遮" : weather.warnings.length > 0 ? "留意天氣警告" : "暫未錄得降雨"}</b>
            <span>{(weather.rainfallMax ?? 0) > 0 ? "Remember your umbrella" : weather.warnings.length > 0 ? "Weather warning in force" : "No rainfall recorded"}</span>
          </div>
          {weather.warningMessageTc[0] && weather.warnings.length === 0 && <div className="weather-message"><b>{weather.warningMessageTc[0]}</b><span>{weather.warningMessageEn[0]}</span></div>}
          {radar.imageUrl ? (
            <button className="radar-preview" onClick={() => setRadarOpen(true)} aria-label="放大天文台128公里雷達圖 Enlarge HKO 128 km radar">
              <div className="radar-preview-heading">
                <span><b>雨區雷達</b><small>128公里 · RAIN RADAR</small></span>
                <span className={radarDelayed ? "radar-delay" : "radar-time"}>{radarDelayed ? "圖像延遲 · DELAYED" : `${formatUpdated(radar.capturedAt)} HKT`}<Maximize2 /></span>
              </div>
              <img src={radar.imageUrl} alt="香港天文台128公里雨區雷達圖 HKO 128 km rainfall radar" />
            </button>
          ) : (
            <div className="radar-unavailable"><CloudRain /><span><b>雷達圖暫時無法連線</b><small>Radar temporarily unavailable</small></span></div>
          )}
          <footer>天文台更新 HKO updated {formatUpdated(weather.updatedAt)} · 雷達每5分鐘檢查 Radar checked every 5m</footer>
        </section>

        <section className="bus-panel panel">
          <div className="panel-heading">
            <div><h2>巴士到站</h2><p>BUS ARRIVALS</p></div>
            <div className="next-refresh">每 {config.refreshSeconds} 秒更新<span>Refresh every {config.refreshSeconds}s</span></div>
          </div>
          <div className="bus-board-list">
            {profileBoards.map((board) => {
              const snapshot = transit[board.id];
              return (
                <article key={board.id} className="bus-board">
                  <div className="route-badge"><BusFront /><strong>{board.route}</strong><small>{board.sources.map((source) => source.operator).join(" + ")}</small></div>
                  <div className="stop-info"><b>{board.labelTc}</b><span>{board.labelEn}</span><em>往 {board.sources[0]?.destinationTc}<small>To {board.sources[0]?.destinationEn}</small></em></div>
                  <div className="eta-list">
                    {snapshot?.items.length ? snapshot.items.map((eta, index) => (
                      <div key={`${eta.arrivalTime}-${eta.operator}`} className={`eta ${index === 0 ? "next" : ""}`}>
                        <strong>{eta.minutes <= 0 ? "到站" : eta.minutes}</strong>
                        <span>{eta.minutes <= 0 ? "ARRIVING" : "分鐘 MIN"}</span>
                        <small>{formatTime(new Date(eta.arrivalTime))} · {eta.operator}{eta.scheduled ? " · 原定" : ""}</small>
                      </div>
                    )) : (
                      <div className="no-eta"><b>{snapshot?.freshness === "unavailable" ? "暫時無法連線" : "暫未有班次"}</b><span>{snapshot?.freshness === "unavailable" ? "Temporarily unavailable" : "No upcoming arrivals"}</span></div>
                    )}
                  </div>
                  <div className="board-status"><StatusPill freshness={snapshot?.freshness ?? "unavailable"} /><small>更新 {formatUpdated(snapshot?.fetchedAt ?? "")}</small></div>
                </article>
              );
            })}
            {profileBoards.length === 0 && <div className="empty-dashboard"><BusFront /><b>未設定巴士站</b><span>Long press the clock for Settings</span></div>}
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <span>資料來源 DATA: KMB · LWB · Citybus · 香港天文台 HKO</span>
        <button onClick={() => setManualSleep(true)}><MonitorOff />立即熄屏 Sleep now</button>
        <span>長按時間3秒進入設定 · Hold clock 3s for Settings<b className="app-version">VERSION v{APP_VERSION} · BUILD {APP_BUILD}</b></span>
      </footer>

      {pinOpen && <PinDialog title="管理員設定" subtitle="ENTER ADMIN PIN" onSubmit={openSettingsAfterPin} onClose={() => setPinOpen(false)} />}
      {settingsOpen && <SettingsPanel config={config} onChange={setConfig} onClose={() => setSettingsOpen(false)} />}
      {radarOpen && radar.imageUrl && (
        <div className="radar-lightbox" role="dialog" aria-modal="true" aria-label="天文台128公里雷達圖" onClick={() => setRadarOpen(false)}>
          <div className="radar-lightbox-card" onClick={(event) => event.stopPropagation()}>
            <div><span><b>雨區雷達 · 128公里</b><small>HKO RAIN RADAR · {formatUpdated(radar.capturedAt)} HKT</small></span><button className="icon-button" onClick={() => setRadarOpen(false)} aria-label="Close"><X /></button></div>
            <img src={radar.imageUrl} alt="香港天文台128公里雨區雷達圖 HKO 128 km rainfall radar" />
          </div>
        </div>
      )}
    </div>
  );
}
