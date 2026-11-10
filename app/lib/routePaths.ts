// Geometry of a route between two stops, for drawing it on the map: the stops a vehicle passes
// from A to B, in order, with coordinates. Lines are drawn as straight segments between stops.
//
// Direct: every distinct path of the lines that go from A to B (lines sharing a path are grouped).
// Otherwise: the shortest of the first one-transfer connections, as two legs.

import { prisma } from "@/app/lib/db";
import { findOneTransferConnections, sameTripAfter, tripOf } from "@/app/lib/connections";

export type PathStop = { id: number; name: string; lat: number; lon: number };
export type TransportType = "BUS" | "TRAM" | "RAIL" | "OTHER";
export type RouteLeg = { lines: string[]; type: TransportType; stops: PathStop[] };

export type RoutePaths =
  | { kind: "direct"; options: RouteLeg[] }
  | { kind: "transfer"; legs: [RouteLeg, RouteLeg]; transferStop: PathStop }
  | { kind: "none" };

const MAX_DIRECT_OPTIONS = 4;
const MAX_TRANSFER_CANDIDATES = 5;

type Segment = { polaczenieId: number; from: number; to: number }; // kolejnosc range on one trip

/** All stretches of trips (on the given connections) that go from one stop to another. */
async function findSegments(fromStopId: number, toStopId: number, polaczenieIds?: number[]): Promise<Segment[]> {
  const fromLegs = await prisma.trasa.findMany({
    where: { przystanekId: fromStopId, ...(polaczenieIds ? { polaczenieId: { in: polaczenieIds } } : {}) },
    select: { polaczenieId: true, kolejnosc: true },
  });
  if (!fromLegs.length) return [];
  const toLegs = await prisma.trasa.findMany({
    where: { przystanekId: toStopId, polaczenieId: { in: [...new Set(fromLegs.map((l) => l.polaczenieId))] } },
    select: { polaczenieId: true, kolejnosc: true },
  });

  // For each trip, the shortest stretch from A to B
  const best = new Map<string, Segment>();
  for (const s of fromLegs) {
    for (const e of toLegs) {
      if (e.polaczenieId !== s.polaczenieId || !sameTripAfter(s.kolejnosc, e.kolejnosc)) continue;
      const key = `${s.polaczenieId}:${tripOf(s.kolejnosc)}`;
      const current = best.get(key);
      if (!current || e.kolejnosc - s.kolejnosc < current.to - current.from) {
        best.set(key, { polaczenieId: s.polaczenieId, from: s.kolejnosc, to: e.kolejnosc });
      }
    }
  }
  return [...best.values()];
}

/** Loads the stops of each segment (in order) and the line name/type of its connection. */
async function loadSegments(segments: Segment[]) {
  if (!segments.length) return [];
  const rows = await prisma.trasa.findMany({
    where: { OR: segments.map((s) => ({ polaczenieId: s.polaczenieId, kolejnosc: { gte: s.from, lte: s.to } })) },
    select: {
      polaczenieId: true,
      kolejnosc: true,
      przystanek: { select: { id: true, nazwa: true, latitude: true, longitude: true } },
      polaczenie: { select: { nazwa: true, typ: true } },
    },
    orderBy: [{ polaczenieId: "asc" }, { kolejnosc: "asc" }],
  });

  return segments.map((seg) => {
    const own = rows.filter((r) => r.polaczenieId === seg.polaczenieId && r.kolejnosc >= seg.from && r.kolejnosc <= seg.to);
    const stops: PathStop[] = own
      .filter((r) => r.przystanek.latitude != null && r.przystanek.longitude != null)
      .map((r) => ({ id: r.przystanek.id, name: r.przystanek.nazwa, lat: r.przystanek.latitude!, lon: r.przystanek.longitude! }));
    return {
      line: own[0]?.polaczenie.nazwa ?? `Connection ${seg.polaczenieId}`,
      type: (own[0]?.polaczenie.typ ?? "OTHER") as TransportType,
      stops,
    };
  });
}

const byLineName = (a: string, b: string) => a.localeCompare(b, "pl", { numeric: true });

export async function findRoutePaths(startStopId: number, endStopId: number): Promise<RoutePaths> {
  // 1) Direct: group the lines by the exact path they take
  const direct = await loadSegments(await findSegments(startStopId, endStopId));
  if (direct.length) {
    const groups = new Map<string, RouteLeg>();
    for (const seg of direct) {
      if (seg.stops.length < 2) continue;
      const key = `${seg.type}|${seg.stops.map((s) => s.id).join(">")}`;
      const group = groups.get(key) ?? { lines: [], type: seg.type, stops: seg.stops };
      if (!group.lines.includes(seg.line)) group.lines.push(seg.line);
      groups.set(key, group);
    }
    const options = [...groups.values()]
      .map((g) => ({ ...g, lines: g.lines.sort(byLineName) }))
      .sort((a, b) => b.lines.length - a.lines.length || a.stops.length - b.stops.length)
      .slice(0, MAX_DIRECT_OPTIONS);
    if (options.length) return { kind: "direct", options };
  }

  // 2) One transfer: try the first few distinct combinations and keep the one with the fewest stops
  const transfers = await findOneTransferConnections(startStopId, endStopId, null, 40);
  const combos = new Map<string, { first: number; transfer: number; second: number }>();
  for (const t of transfers) {
    const key = `${t.firstPolaczenieId}|${t.transferStopId}|${t.secondPolaczenieId}`;
    if (!combos.has(key)) combos.set(key, { first: t.firstPolaczenieId, transfer: t.transferStopId, second: t.secondPolaczenieId });
    if (combos.size >= MAX_TRANSFER_CANDIDATES) break;
  }

  let best: { legs: [RouteLeg, RouteLeg]; length: number } | null = null;
  for (const c of combos.values()) {
    const [firstSegs, secondSegs] = await Promise.all([
      findSegments(startStopId, c.transfer, [c.first]),
      findSegments(c.transfer, endStopId, [c.second]),
    ]);
    const shortest = (segs: Segment[]) => [...segs].sort((a, b) => a.to - a.from - (b.to - b.from))[0];
    const firstSeg = shortest(firstSegs);
    const secondSeg = shortest(secondSegs);
    if (!firstSeg || !secondSeg) continue;
    const [leg1, leg2] = await loadSegments([firstSeg, secondSeg]);
    if (leg1.stops.length < 2 || leg2.stops.length < 2) continue;
    const length = leg1.stops.length + leg2.stops.length;
    if (!best || length < best.length) {
      best = {
        length,
        legs: [
          { lines: [leg1.line], type: leg1.type, stops: leg1.stops },
          { lines: [leg2.line], type: leg2.type, stops: leg2.stops },
        ],
      };
    }
  }
  if (best) return { kind: "transfer", legs: best.legs, transferStop: best.legs[1].stops[0] };

  return { kind: "none" };
}
