// Live direct connections in Warsaw: which lines go from stop A to stop B comes from the imported
// GTFS timetable in our database, the actual next departures from A come from the Warsaw API.
//
// Each imported trip stores its route variant (Trasa.wariant, e.g. "TP-MAR"). The Warsaw API
// returns the same code for every departure, so departures whose variant does not reach B
// (e.g. a bus that ends earlier or turns off) are left out.

import { prisma } from "@/app/lib/db";
import { sameTripAfter } from "@/app/lib/connections";
import { getDepartures } from "@/app/lib/warsawApi";

export type LiveDeparture = {
  line: string;
  type: "BUS" | "TRAM" | "RAIL" | "OTHER";
  /** Route variant code from the timetable, e.g. "TP-MAR" */
  variant: string;
  direction: string;
  brigade: string;
  /** "HH:MM" in Warsaw time */
  departureTime: string;
  minutesFromNow: number;
  /** Ride time from A to B, taken from the imported timetable */
  rideMinutes: number;
  /** Estimated "HH:MM" arrival at B */
  arrivalTime: string;
};

export type LiveDepartures =
  | { available: false; reason: "no-ztm-stop" }
  | { available: true; lines: string[]; departures: LiveDeparture[] };

// Only departures in the next hours count as "next" (just after midnight the timetable can
// otherwise return tomorrow evening's courses, ~23 h ahead)
const MAX_MINUTES_AHEAD = 12 * 60;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const addMinutes = (hhmm: string, minutes: number) => {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * Next direct departures from `startStopId` that reach `endStopId`.
 * Returns available: false when the start stop has no ZTM code (not a Warsaw bus/tram stop).
 * Throws WarsawApiError when the Warsaw API fails (e.g. missing WARSAW_API_KEY).
 */
export async function findLiveDirectDepartures(
  startStopId: number,
  endStopId: number,
  { limit = 8, now = new Date() }: { limit?: number; now?: Date } = {}
): Promise<LiveDepartures> {
  const start = await prisma.przystanek.findUnique({
    where: { id: startStopId },
    select: { ztmStopId: true, ztmStopNr: true },
  });
  if (!start?.ztmStopId || !start.ztmStopNr) return { available: false, reason: "no-ztm-stop" };

  // 1) Line variants that pass A and later B on the same trip, with their ride time
  const startLegs = await prisma.trasa.findMany({
    where: { przystanekId: startStopId, wariant: { not: null } },
    select: {
      polaczenieId: true,
      kolejnosc: true,
      przyjazdDt: true,
      wariant: true,
      polaczenie: { select: { nazwa: true, typ: true } },
    },
  });
  const endLegs = startLegs.length
    ? await prisma.trasa.findMany({
        where: { przystanekId: endStopId, polaczenieId: { in: [...new Set(startLegs.map((l) => l.polaczenieId))] } },
        select: { polaczenieId: true, kolejnosc: true, przyjazdDt: true },
      })
    : [];

  // "line|variant" -> ride times
  const rides = new Map<string, { line: string; type: LiveDeparture["type"]; minutes: number[] }>();
  for (const s of startLegs) {
    for (const e of endLegs) {
      if (e.polaczenieId !== s.polaczenieId || !sameTripAfter(s.kolejnosc, e.kolejnosc)) continue;
      const line = s.polaczenie.nazwa ?? "";
      const key = `${line}|${s.wariant}`;
      const ride = rides.get(key) ?? { line, type: s.polaczenie.typ, minutes: [] };
      ride.minutes.push(Math.round((e.przyjazdDt.getTime() - s.przyjazdDt.getTime()) / 60000));
      rides.set(key, ride);
    }
  }
  const lines = [...new Set([...rides.values()].map((r) => r.line))].sort((a, b) => a.localeCompare(b, "pl", { numeric: true }));
  if (lines.length === 0) return { available: true, lines, departures: [] };

  // 2) Next departures of those lines from A (Warsaw API timetable), keeping only variants that reach B.
  //    One line failing (e.g. the API has no timetable for it) shouldn't hide the others.
  const perLine = await Promise.allSettled(
    lines.map((line) => getDepartures(start.ztmStopId!, start.ztmStopNr!, { line, limit: 30, now }))
  );
  const failed = perLine.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failed.length === perLine.length) throw failed[0].reason;

  const departures: LiveDeparture[] = [];
  for (const d of perLine.flatMap((r) => (r.status === "fulfilled" ? r.value : []))) {
    const ride = rides.get(`${d.line}|${d.route}`);
    if (!ride || d.minutesFromNow > MAX_MINUTES_AHEAD) continue;
    const rideMinutes = median(ride.minutes);
    departures.push({
      line: d.line,
      type: ride.type,
      variant: d.route,
      direction: d.direction,
      brigade: d.brigade,
      departureTime: d.displayTime,
      minutesFromNow: d.minutesFromNow,
      rideMinutes,
      arrivalTime: addMinutes(d.displayTime, rideMinutes),
    });
  }
  departures.sort((a, b) => a.minutesFromNow - b.minutesFromNow || a.line.localeCompare(b.line));

  return { available: true, lines, departures: departures.slice(0, limit) };
}
