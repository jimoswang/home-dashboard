declare global {
  interface Window {
    fully?: {
      setStringSetting: (key: string, value: string) => void;
      setBooleanSetting: (key: string, value: boolean) => void;
      turnScreenOff: (keepAlive?: boolean) => void;
      turnScreenOn: () => void;
      isNetworkConnected?: () => boolean;
      showToast?: (text: string) => void;
    };
  }
}

export function hasFullyKiosk(): boolean {
  return typeof window.fully !== "undefined";
}

export function syncFullySchedule(alwaysOn: boolean, sleepTime: string, wakeTime: string): boolean {
  if (!window.fully) return false;
  const schedule = alwaysOn
    ? []
    : [{ wakeUpTime: wakeTime, sleepTime, dayOfWeek: 8 }];
  window.fully.setStringSetting("sleepSchedule", JSON.stringify(schedule));
  window.fully.setBooleanSetting("keepScreenOn", true);
  window.fully.showToast?.("螢幕時間已同步 Screen schedule synced");
  return true;
}

export function isWithinSleepWindow(now: Date, sleepTime: string, wakeTime: string): boolean {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [sleepHour, sleepMinute] = sleepTime.split(":").map(Number);
  const [wakeHour, wakeMinute] = wakeTime.split(":").map(Number);
  const sleep = sleepHour * 60 + sleepMinute;
  const wake = wakeHour * 60 + wakeMinute;
  if (sleep === wake) return false;
  return sleep > wake ? minutes >= sleep || minutes < wake : minutes >= sleep && minutes < wake;
}

export function requestScreenOff(): boolean {
  if (!window.fully) return false;
  window.fully.turnScreenOff(true);
  return true;
}
