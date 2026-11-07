// Klient API Miasta Stołecznego Warszawy – https://api.um.warszawa.pl/
//
// Klucz API trzymamy w pliku .env jako WARSAW_API_KEY (nigdy w repozytorium).
// Ten moduł działa tylko po stronie serwera (route handlery w app/api),
// dzięki temu klucz nie trafia do przeglądarki.

const BASE_URL = "https://api.um.warszawa.pl/api/action";

// Identyfikatory zasobów w API Warszawy (sprawdzone na żywym API, listopad 2026).
// Uwaga: lista przystanków ze współrzędnymi (dbstore_get) i wyszukiwanie
// przystanku po nazwie przestały działać w tym API – przystanki trzeba brać
// z innego źródła (np. GTFS).
const RESOURCES = {
  // busestrams_get – pozycje autobusów i tramwajów na żywo
  vehicles: "f2e5503e-927d-4ad3-9500-4ab9e55deb59",
  // dbtimetable_get – linie zatrzymujące się na słupku
  linesAtStop: "88cd555f-6f31-43ca-9de4-66c479ad5942",
  // dbtimetable_get – rozkład jazdy linii na słupku
  timetable: "e923fa0e-d96c-43f9-ae6e-60518c9f3238",
} as const;

// Obszar, w którym muszą leżeć poprawne pozycje (Warszawa z okolicami).
// API czasem zwraca pojazdy z zerowymi lub zupełnie błędnymi współrzędnymi.
const WARSAW_BOUNDS = { minLat: 51.9, maxLat: 52.6, minLon: 20.6, maxLon: 21.6 };

export class WarsawApiError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "WarsawApiError";
    this.status = status;
  }
}

function getApiKey(): string {
  const key = process.env.WARSAW_API_KEY?.trim();
  if (!key) {
    throw new WarsawApiError(
      "Brak WARSAW_API_KEY w pliku .env. Zarejestruj się na https://api.um.warszawa.pl/, wklej klucz do .env i uruchom ponownie serwer.",
      500
    );
  }
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type QueryParams = Record<string, string | number | undefined>;

/**
 * Wywołuje akcję API Warszawy i zwraca pole `result`.
 * API zgłasza błędy jako tekst w `result` (np. "Błędny apikey lub jego brak"),
 * a busestrams_get potrafi losowo odpowiedzieć "Błędna metoda lub parametry
 * wywołania" – wtedy ponawiamy zapytanie.
 */
async function callApi<T>(action: string, params: QueryParams, retries = 2): Promise<T> {
  const url = new URL(`${BASE_URL}/${action}/`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  url.searchParams.set("apikey", getApiKey());

  let lastError = "nieznany błąd";
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(400 * attempt);

    let res: Response;
    try {
      res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    } catch (e) {
      lastError = `brak połączenia (${(e as Error).message})`;
      continue;
    }
    if (!res.ok) {
      lastError = `HTTP ${res.status}`;
      continue;
    }

    let json: { result?: unknown; error?: unknown };
    try {
      json = await res.json();
    } catch {
      lastError = "odpowiedź nie jest poprawnym JSON-em";
      continue;
    }

    if (json.error) throw new WarsawApiError(`API Warszawy: ${String(json.error)}`);

    if (typeof json.result === "string") {
      if (/apikey/i.test(json.result)) {
        throw new WarsawApiError(`API Warszawy: ${json.result}. Sprawdź WARSAW_API_KEY w .env.`, 401);
      }
      lastError = json.result;
      continue;
    }
    if (json.result === undefined) {
      lastError = "brak pola result w odpowiedzi";
      continue;
    }
    return json.result as T;
  }
  throw new WarsawApiError(`API Warszawy nie odpowiedziało poprawnie: ${lastError}`);
}

// --- Prosty cache w pamięci serwera, żeby nie zasypywać API zapytaniami ---

const cache = new Map<string, { expires: number; value: Promise<unknown> }>();

function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.value as Promise<T>;
  const value = load();
  cache.set(key, { expires: now + ttlMs, value });
  // nieudanych zapytań nie trzymamy w cache
  value.catch(() => cache.delete(key));
  return value;
}

// Odpowiedzi dbtimetable_get to listy par klucz–wartość, ale w dwóch postaciach:
//   linie na przystanku: [{ values: [{ key: "linia", value: "523" }] }, ...]
//   rozkład jazdy:       [[{ key: "brygada", value: "3" }, { key: "czas", value: "17:31:00" }, ...], ...]
// (wartość bywa też JSON-owym null)
type KeyValue = { key: string; value: string | null };
type KeyValueRecord = KeyValue[] | { values?: KeyValue[] };

function recordEntries(record: KeyValueRecord): KeyValue[] {
  if (Array.isArray(record)) return record;
  return Array.isArray(record?.values) ? record.values : [];
}

const nullable = (v: string | null | undefined): string | null =>
  v === undefined || v === null || v === "null" ? null : v;

function toObject(record: KeyValueRecord): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const { key, value } of recordEntries(record)) out[key] = nullable(value);
  return out;
}

// --- Czas: API podaje czas lokalny Warszawy bez strefy, np. "2026-11-07 17:15:32" ---

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - date.getTime();
}

export function parseWarsawDateTime(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  const naiveUtc = Date.UTC(y, mo - 1, d, h, mi, s);
  const offset = timeZoneOffsetMs(new Date(naiveUtc), "Europe/Warsaw");
  return new Date(naiveUtc - offset);
}

/** Bieżąca godzina w Warszawie w minutach od północy. */
function warsawMinutesNow(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return get("hour") * 60 + get("minute");
}

// ======================= Pozycje pojazdów na żywo =======================

export type VehicleType = "bus" | "tram";

export type Vehicle = {
  type: VehicleType;
  line: string;
  brigade: string;
  vehicleNumber: string;
  lat: number;
  lon: number;
  /** Czas ostatniego zgłoszenia pozycji (ISO, UTC) */
  time: string;
  /** Ile sekund temu pojazd zgłosił pozycję */
  ageSeconds: number;
};

type RawVehicle = {
  Lines: string;
  Lon: number | string;
  Lat: number | string;
  VehicleNumber: string;
  Brigade: string;
  Time: string;
};

const VEHICLE_TYPE_CODE: Record<VehicleType, number> = { bus: 1, tram: 2 };

// API ignoruje parametr line i zawsze zwraca wszystkie pojazdy danego typu,
// więc pobieramy całość (raz na 10 s) i filtrujemy po naszej stronie.
function fetchRawVehicles(type: VehicleType): Promise<RawVehicle[]> {
  return cached(`vehicles:${type}`, 10_000, () =>
    callApi<RawVehicle[]>("busestrams_get", {
      resource_id: RESOURCES.vehicles,
      type: VEHICLE_TYPE_CODE[type],
    })
  );
}

export type VehicleQuery = {
  /** bez typu = autobusy i tramwaje */
  type?: VehicleType;
  line?: string;
  brigade?: string;
  /** odrzuć pozycje starsze niż tyle sekund (domyślnie 5 minut) */
  maxAgeSeconds?: number;
};

export async function getVehicles(query: VehicleQuery = {}, now = new Date()): Promise<Vehicle[]> {
  const types: VehicleType[] = query.type ? [query.type] : ["bus", "tram"];
  const maxAge = query.maxAgeSeconds ?? 300;
  const line = query.line?.trim().toUpperCase() || undefined;
  const brigade = query.brigade?.trim() || undefined;

  const raw = await Promise.all(types.map((t) => fetchRawVehicles(t)));

  const vehicles: Vehicle[] = [];
  raw.forEach((list, i) => {
    for (const r of list) {
      if (line && String(r.Lines).trim().toUpperCase() !== line) continue;
      if (brigade && String(r.Brigade).trim() !== brigade) continue;

      const lat = Number(r.Lat);
      const lon = Number(r.Lon);
      const time = parseWarsawDateTime(String(r.Time));
      if (!time || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (
        lat < WARSAW_BOUNDS.minLat || lat > WARSAW_BOUNDS.maxLat ||
        lon < WARSAW_BOUNDS.minLon || lon > WARSAW_BOUNDS.maxLon
      ) continue;

      const ageSeconds = Math.round((now.getTime() - time.getTime()) / 1000);
      if (maxAge > 0 && ageSeconds > maxAge) continue;

      vehicles.push({
        type: types[i],
        line: String(r.Lines).trim(),
        brigade: String(r.Brigade).trim(),
        vehicleNumber: String(r.VehicleNumber).trim(),
        lat,
        lon,
        time: time.toISOString(),
        ageSeconds: Math.max(0, ageSeconds),
      });
    }
  });
  return vehicles;
}

// ============================ Rozkład jazdy =============================

export function getLinesAtStop(stopId: string, stopNr: string): Promise<string[]> {
  return cached(`lines:${stopId}:${stopNr}`, 60 * 60 * 1000, async () => {
    const records = await callApi<KeyValueRecord[]>("dbtimetable_get", {
      id: RESOURCES.linesAtStop,
      busstopId: stopId,
      busstopNr: stopNr,
    });
    if (!Array.isArray(records)) return [];
    return records
      .flatMap((r) => recordEntries(r).map((v) => nullable(v.value)))
      .filter((v): v is string => v !== null);
  });
}

export type ScheduledRide = {
  line: string;
  brigade: string;
  direction: string;
  route: string;
  /** godzina z rozkładu "HH:MM:SS"; po północy może być np. "24:15:00" */
  time: string;
};

export function getTimetable(stopId: string, stopNr: string, line: string): Promise<ScheduledRide[]> {
  return cached(`timetable:${stopId}:${stopNr}:${line}`, 60 * 60 * 1000, async () => {
    const records = await callApi<KeyValueRecord[]>("dbtimetable_get", {
      id: RESOURCES.timetable,
      busstopId: stopId,
      busstopNr: stopNr,
      line,
    });
    if (!Array.isArray(records)) return [];
    return records.map((rec) => {
      const o = toObject(rec);
      return {
        line,
        brigade: o.brygada ?? "",
        direction: o.kierunek ?? "",
        route: o.trasa ?? "",
        time: o.czas ?? "",
      };
    });
  });
}

function timeToMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export type Departure = ScheduledRide & {
  /** godzina do wyświetlenia "HH:MM" (24:15 → 00:15) */
  displayTime: string;
  minutesFromNow: number;
};

/** Najbliższe odjazdy ze słupka (wszystkie linie albo jedna wybrana). */
export async function getDepartures(
  stopId: string,
  stopNr: string,
  options: { line?: string; limit?: number; now?: Date } = {}
): Promise<Departure[]> {
  const lines = options.line ? [options.line] : await getLinesAtStop(stopId, stopNr);
  const timetables = await Promise.all(lines.map((l) => getTimetable(stopId, stopNr, l)));
  const nowMin = warsawMinutesNow(options.now);

  const departures: Departure[] = [];
  for (const ride of timetables.flat()) {
    const t = timeToMinutes(ride.time);
    if (t === null) continue;
    // kursy po północy mają w rozkładzie godziny 24:xx, 25:xx...
    const candidates = nowMin < 4 * 60 ? [t - 24 * 60, t] : [t];
    const diff = candidates.map((c) => c - nowMin).find((d) => d >= 0);
    if (diff === undefined) continue;
    const hh = String(Math.floor(t / 60) % 24).padStart(2, "0");
    const mm = String(t % 60).padStart(2, "0");
    departures.push({ ...ride, displayTime: `${hh}:${mm}`, minutesFromNow: diff });
  }
  departures.sort((a, b) => a.minutesFromNow - b.minutesFromNow || a.line.localeCompare(b.line));
  return departures.slice(0, options.limit ?? 20);
}
