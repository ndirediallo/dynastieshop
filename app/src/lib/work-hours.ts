// Logique partagée pour les horaires de connexion (voir auth.ts pour
// l'application à la connexion, settings-form.tsx pour le réglage global,
// et utilisateurs/[id]/work-hours-card.tsx pour la surcharge par compte).

export const WORK_HOURS_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type WorkHoursDay = (typeof WORK_HOURS_DAYS)[number];

export const WORK_HOURS_DAY_LABELS: Record<WorkHoursDay, string> = {
  MON: "Lun",
  TUE: "Mar",
  WED: "Mer",
  THU: "Jeu",
  FRI: "Ven",
  SAT: "Sam",
  SUN: "Dim",
};

// Index renvoyé par Date.getDay() : 0 = dimanche, 1 = lundi, ...
const JS_DAY_INDEX_TO_CODE: WorkHoursDay[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export interface WorkHoursConfig {
  enabled: boolean;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  days: string[];
}

function minutesSinceMidnight(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => Number(n) || 0);
  return h * 60 + m;
}

// Vrai si `now` tombe dans la plage autorisée. Une plage où l'heure de fin
// est inférieure à l'heure de début (ex. 22:00 → 06:00) est traitée comme
// traversant minuit.
export function isWithinWorkHours(config: WorkHoursConfig, now: Date = new Date()): boolean {
  if (!config.enabled) return true;

  const dayCode = JS_DAY_INDEX_TO_CODE[now.getDay()];
  if (!config.days.includes(dayCode)) return false;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = minutesSinceMidnight(config.start);
  const endMinutes = minutesSinceMidnight(config.end);

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  // Plage traversant minuit (ex. 22:00 → 06:00).
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

// Résout la config effective pour un compte donné : INHERIT suit le
// réglage global, UNRESTRICTED désactive toute restriction, CUSTOM utilise
// l'horaire propre au compte.
export function resolveWorkHoursConfig(params: {
  mode: "INHERIT" | "CUSTOM" | "UNRESTRICTED";
  customStart: string | null;
  customEnd: string | null;
  customDays: string[];
  globalEnabled: boolean;
  globalStart: string;
  globalEnd: string;
  globalDays: string[];
}): WorkHoursConfig {
  if (params.mode === "UNRESTRICTED") {
    return { enabled: false, start: "00:00", end: "23:59", days: [] };
  }
  if (params.mode === "CUSTOM") {
    return {
      enabled: true,
      start: params.customStart ?? "08:00",
      end: params.customEnd ?? "20:00",
      days: params.customDays,
    };
  }
  return {
    enabled: params.globalEnabled,
    start: params.globalStart,
    end: params.globalEnd,
    days: params.globalDays,
  };
}
