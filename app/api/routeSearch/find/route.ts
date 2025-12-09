import { NextRequest, NextResponse } from "next/server";
import { findDirectConnections, findOneTransferConnections } from "@/app/lib/connections";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const startId = Number(url.searchParams.get("startId"));
  const endId = Number(url.searchParams.get("endId"));
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const transfers = Number(url.searchParams.get("transfers") ?? 0);
  const ignoreTime = url.searchParams.get("ignoreTime") === "1";

  if (Number.isNaN(startId) || Number.isNaN(endId) || startId <= 0 || endId <= 0) {
    return NextResponse.json(
      { error: "Missing or invalid startId or endId" },
      { status: 400 }
    );
  }

  const now = ignoreTime ? null : new Date();

  if (transfers >= 1) {
    const data = await findOneTransferConnections(startId, endId, now, limit);
    return NextResponse.json({ results: data, kind: "one-transfer" });
  } else {
    const data = await findDirectConnections(startId, endId, now, limit);
    return NextResponse.json({ results: data, kind: "direct" });
  }
}
