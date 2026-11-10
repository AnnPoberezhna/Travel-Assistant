import { NextRequest, NextResponse } from "next/server";
import { findDirectConnections, findOneTransferConnections } from "@/app/lib/connections";
import { logRouteSearch } from "@/app/lib/searchHistory";

// GET /api/routeSearch/find?startId=1&endId=2 – connections between two stops (database ids)
//   ?transfers=1    connections with one transfer instead of direct ones
//   ?ignoreTime=1   any time of day, not only from now on
//   ?history=1      save the search in the logged-in user's history (the home page search does;
//                   the map only checks whether routes exist, so it doesn't)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const startId = Number(url.searchParams.get("startId"));
  const endId = Number(url.searchParams.get("endId"));
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const transfers = Number(url.searchParams.get("transfers") ?? 0);
  const ignoreTime = url.searchParams.get("ignoreTime") === "1";
  const saveHistory = url.searchParams.get("history") === "1";

  if (Number.isNaN(startId) || Number.isNaN(endId) || startId <= 0 || endId <= 0) {
    return NextResponse.json(
      { error: "Missing or invalid startId or endId" },
      { status: 400 }
    );
  }

  const now = ignoreTime ? null : new Date();

  if (transfers >= 1) {
    const data = await findOneTransferConnections(startId, endId, now, limit);
    if (saveHistory) await logRouteSearch(startId, endId, data.length);
    return NextResponse.json({ results: data, kind: "one-transfer" });
  } else {
    const data = await findDirectConnections(startId, endId, now, limit);
    if (saveHistory) await logRouteSearch(startId, endId, data.length);
    return NextResponse.json({ results: data, kind: "direct" });
  }
}
