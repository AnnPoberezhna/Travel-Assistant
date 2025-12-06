import { NextRequest, NextResponse } from "next/server";
import { findDirectConnections } from "@/app/lib/connections";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const startId = Number(url.searchParams.get("startId"));
  const endId = Number(url.searchParams.get("endId"));
  const limit = Number(url.searchParams.get("limit") ?? 20);

  if (Number.isNaN(startId) || Number.isNaN(endId) || startId <= 0 || endId <= 0) {
    return NextResponse.json(
      { error: "Missing or invalid startId or endId" },
      { status: 400 }
    );
  }

  const now = new Date();

  const data = await findDirectConnections(startId, endId, now, limit);

  return NextResponse.json({ results: data });
}
