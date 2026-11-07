import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { tripOf } from "@/app/lib/connections";

// GET /api/stops/reachable?from=7137 – stops reachable from a stop by a direct connection
// (a later stop on the same trip of any connection that passes through it, at any time of day).
// Returns them with coordinates, so the map can show them at any zoom level.
// Uses the same rule as findDirectConnections in app/lib/connections.ts, so the map can show
// which destinations will actually return routes.
export async function GET(req: NextRequest) {
  const from = Number(req.nextUrl.searchParams.get("from"));
  if (!Number.isInteger(from) || from <= 0) {
    return NextResponse.json({ error: "Missing or invalid from (stop id)" }, { status: 400 });
  }

  try {
    const startLegs = await db.trasa.findMany({
      where: { przystanekId: from },
      select: { polaczenieId: true, kolejnosc: true },
    });

    // Earliest position of the start stop on each trip ("connection:trip")
    const tripKey = (polaczenieId: number, kolejnosc: number) => `${polaczenieId}:${tripOf(kolejnosc)}`;
    const startSeq = new Map<string, number>();
    for (const leg of startLegs) {
      const key = tripKey(leg.polaczenieId, leg.kolejnosc);
      const seq = startSeq.get(key);
      if (seq === undefined || leg.kolejnosc < seq) startSeq.set(key, leg.kolejnosc);
    }

    const reachable = new Set<number>();
    if (startLegs.length > 0) {
      const legs = await db.trasa.findMany({
        where: { polaczenieId: { in: [...new Set(startLegs.map((l) => l.polaczenieId))] } },
        select: { polaczenieId: true, przystanekId: true, kolejnosc: true },
      });
      for (const leg of legs) {
        const seq = startSeq.get(tripKey(leg.polaczenieId, leg.kolejnosc));
        if (seq !== undefined && leg.kolejnosc > seq && leg.przystanekId !== from) {
          reachable.add(leg.przystanekId);
        }
      }
    }

    const rows =
      reachable.size > 0
        ? await db.przystanek.findMany({
            where: { id: { in: [...reachable] }, latitude: { not: null }, longitude: { not: null } },
            select: { id: true, nazwa: true, adres: true, latitude: true, longitude: true },
          })
        : [];
    const stops = rows.map((s) => ({
      id: s.id,
      name: s.nazwa,
      address: s.adres,
      lat: s.latitude as number,
      lon: s.longitude as number,
    }));

    return NextResponse.json({ from, count: stops.length, stops });
  } catch (error) {
    console.error("Failed to load reachable stops:", error);
    return NextResponse.json({ error: "Failed to load reachable stops" }, { status: 500 });
  }
}
