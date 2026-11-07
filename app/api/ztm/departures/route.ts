import { NextRequest, NextResponse } from "next/server";
import { getDepartures } from "@/app/lib/warsawApi";
import { warsawApiErrorResponse } from "@/app/lib/apiErrors";

// GET /api/ztm/departures – next departures from a stop (timetable from the Warsaw API)
//   ?stopId=7009   stop group number
//   ?stopNr=01     stop post number within the group
//   ?line=523      optional, a single line only
//   ?limit=20      number of departures
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const stopId = params.get("stopId")?.trim();
  const stopNr = params.get("stopNr")?.trim();
  const line = params.get("line")?.trim() || undefined;
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 20) || 20, 1), 100);

  if (!stopId || !stopNr || !/^\d+$/.test(stopId) || !/^\d+$/.test(stopNr)) {
    return NextResponse.json(
      { error: "Podaj stopId (numer zespołu przystankowego) i stopNr (numer słupka), np. ?stopId=7009&stopNr=01" },
      { status: 400 }
    );
  }

  try {
    const departures = await getDepartures(stopId, stopNr, { line, limit });
    return NextResponse.json({ stopId, stopNr, count: departures.length, departures });
  } catch (error) {
    return warsawApiErrorResponse(error);
  }
}
