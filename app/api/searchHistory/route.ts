import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userIdStr = url.searchParams.get("userId");
  const limit = Number(url.searchParams.get("limit") ?? 20);

  const where: any = {};
  if (userIdStr) {
    const userId = Number(userIdStr);
    if (!Number.isNaN(userId)) where.userId = userId;
  }

  const items = await prisma.searchHistory.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(limit, 100)),
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId, query, fromText, toText, resultsCount } = body as any;

  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "Missing 'query'" }, { status: 400 });
  }

  const created = await prisma.searchHistory.create({
    data: {
      userId: typeof userId === "number" ? userId : null,
      query,
      fromText: typeof fromText === "string" ? fromText : null,
      toText: typeof toText === "string" ? toText : null,
      resultsCount: typeof resultsCount === "number" ? resultsCount : 0,
    },
  });

  return NextResponse.json({ ok: true, item: created });
}
