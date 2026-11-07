import { NextRequest, NextResponse } from "next/server";
import { findLiveDirectDepartures } from "@/app/lib/liveRoutes";
import { warsawApiErrorResponse } from "@/app/lib/apiErrors";

// GET /api/routeSearch/live?startId=1&endId=2 – next real departures (Warsaw API timetable)
// of the lines that go directly from startId to endId, with estimated arrival times.
//   ?limit=8   number of departures (1–30)
// Responds with available: false when the start stop isn't a Warsaw ZTM stop.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const startId = Number(params.get("startId"));
  const endId = Number(params.get("endId"));
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 8) || 8, 1), 30);

  if (!Number.isInteger(startId) || !Number.isInteger(endId) || startId <= 0 || endId <= 0) {
    return NextResponse.json({ error: "Missing or invalid startId or endId" }, { status: 400 });
  }

  try {
    const result = await findLiveDirectDepartures(startId, endId, { limit });
    return NextResponse.json({ ...result, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return warsawApiErrorResponse(error);
  }
}
