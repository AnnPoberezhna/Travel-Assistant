import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/app/lib/db";

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;

// GET /api/stops – stops with coordinates, used by the map
//   ?bbox=minLon,minLat,maxLon,maxLat   (optional, only stops inside this area)
//   ?limit=1000                         (optional, max number of stops, 1–5000)
//   ?ids=12,34                          (optional, only these stops – e.g. for links that open the map)
// The response has truncated=true when more stops match than the limit allows.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const where: Prisma.PrzystanekWhereInput = {
    latitude: { not: null },
    longitude: { not: null },
  };

  const bboxParam = params.get("bbox");
  if (bboxParam) {
    const bbox = bboxParam.split(",").map(Number);
    if (bbox.length !== 4 || bbox.some((n) => !Number.isFinite(n))) {
      return NextResponse.json(
        { error: "bbox must be four numbers: minLon,minLat,maxLon,maxLat" },
        { status: 400 }
      );
    }
    const [minLon, minLat, maxLon, maxLat] = bbox;
    where.latitude = { gte: minLat, lte: maxLat };
    where.longitude = { gte: minLon, lte: maxLon };
  }

  const idsParam = params.get("ids");
  if (idsParam) {
    const ids = idsParam.split(",").map(Number);
    if (ids.length === 0 || ids.length > 100 || ids.some((n) => !Number.isInteger(n) || n <= 0)) {
      return NextResponse.json({ error: "ids must be a comma-separated list of up to 100 stop ids" }, { status: 400 });
    }
    where.id = { in: ids };
  }

  try {
    const rows = await db.przystanek.findMany({
      where,
      select: { id: true, nazwa: true, adres: true, latitude: true, longitude: true },
      orderBy: { id: "asc" },
      take: limit + 1,
    });

    const stops = rows.slice(0, limit).map((s) => ({
      id: s.id,
      name: s.nazwa,
      address: s.adres,
      lat: s.latitude as number,
      lon: s.longitude as number,
    }));

    return NextResponse.json({ count: stops.length, truncated: rows.length > limit, stops });
  } catch (error) {
    console.error("Failed to load stops:", error);
    return NextResponse.json({ error: "Failed to load stops" }, { status: 500 });
  }
}
