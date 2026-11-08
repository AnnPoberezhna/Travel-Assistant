import { NextRequest, NextResponse } from "next/server";
import { findRoutePaths } from "@/app/lib/routePaths";

// GET /api/routeSearch/path?startId=1&endId=2 – the stops (with coordinates) a route passes,
// for drawing it on the map. kind: "direct" (alternative paths), "transfer" (two legs) or "none".
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const startId = Number(params.get("startId"));
  const endId = Number(params.get("endId"));

  if (!Number.isInteger(startId) || !Number.isInteger(endId) || startId <= 0 || endId <= 0) {
    return NextResponse.json({ error: "Missing or invalid startId or endId" }, { status: 400 });
  }

  try {
    return NextResponse.json(await findRoutePaths(startId, endId));
  } catch (error) {
    console.error("Failed to build route path:", error);
    return NextResponse.json({ error: "Failed to build route path" }, { status: 500 });
  }
}
