export type Provider = "kmb" | "citybus";

export interface TransitSource {
  provider: Provider;
  operator: "KMB/LWB" | "CTB";
  route: string;
  direction: "inbound" | "outbound";
  directionCode: "I" | "O";
  serviceType: string;
  stopId: string;
  stopSequence: number;
  stopNameTc: string;
  stopNameEn: string;
  destinationTc: string;
  destinationEn: string;
}

export interface TransitBoardConfig {
  id: string;
  labelTc: string;
  labelEn: string;
  route: string;
  sources: TransitSource[];
  etaLimit: number;
  sortOrder: number;
}

export interface DisplaySettings {
  alwaysOn: boolean;
  sleepTime: string;
  wakeTime: string;
  theme: "kmb" | "dark";
  pixelShift: boolean;
  weatherAnimation?: boolean;
}

export interface Profile {
  id: string;
  nameTc: string;
  nameEn: string;
  weatherStationTc: string;
  weatherStationEn: string;
  transitBoards: TransitBoardConfig[];
  display: DisplaySettings;
}

export interface PinRecord {
  salt: string;
  hash: string;
  iterations: number;
}

export interface AppConfig {
  schemaVersion: 1;
  activeProfileId: string;
  refreshSeconds: number;
  adminPin?: PinRecord;
  profiles: Profile[];
}

export type DataFreshness = "fresh" | "stale" | "unavailable";

export interface EtaItem {
  provider: Provider;
  operator: string;
  arrivalTime: string;
  minutes: number;
  scheduled: boolean;
  remarkTc: string;
  remarkEn: string;
}

export interface TransitSnapshot {
  boardId: string;
  items: EtaItem[];
  fetchedAt: string;
  freshness: DataFreshness;
  error?: string;
}

export interface WeatherWarning {
  code: string;
  nameTc: string;
  nameEn: string;
}

export interface WeatherSnapshot {
  temperature: number | null;
  humidity: number | null;
  rainfallMin: number | null;
  rainfallMax: number | null;
  iconCode: number | null;
  warnings: WeatherWarning[];
  warningMessageTc: string[];
  warningMessageEn: string[];
  updatedAt: string;
  fetchedAt: string;
  freshness: DataFreshness;
  error?: string;
}

export interface RadarSnapshot {
  imageUrl: string;
  capturedAt: string;
  fetchedAt: string;
  freshness: DataFreshness;
  error?: string;
}

export interface RouteVariant {
  provider: Provider;
  operator: "KMB/LWB" | "CTB";
  route: string;
  direction: "inbound" | "outbound";
  directionCode: "I" | "O";
  serviceType: string;
  originTc: string;
  originEn: string;
  destinationTc: string;
  destinationEn: string;
}

export interface StopOption {
  stopId: string;
  sequence: number;
  nameTc: string;
  nameEn: string;
}
