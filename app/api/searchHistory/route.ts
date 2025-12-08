import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userIdStr = url.searchParams.get("userId");
  const userEmail = url.searchParams.get("userEmail");
  const username = url.searchParams.get("username");
  const limit = Number(url.searchParams.get("limit") ?? 20);

  let userId = userIdStr ? Number(userIdStr) : NaN;
  const lim = Math.max(1, Math.min(limit, 100));

  // If userId not provided, try resolving by email or username
  if (Number.isNaN(userId) && (userEmail || username)) {
    try {
      const where: any = {};
      if (userEmail) where.email = userEmail;
      if (username) where.username = username;
      const u = await prisma.user.findFirst({ where });
      if (u?.id) userId = Number(u.id);
    } catch {
      // ignore resolution errors
    }
  }

  // Deduplicate by (userId, fromText, toText) and take the latest createdAt
  const items = await prisma.$queryRawUnsafe<any[]>(
    `
    SELECT DISTINCT ON (
      COALESCE("userId", -1),
      COALESCE("fromText", ''),
      COALESCE("toText", '')
    )
      "id", "userId", "query", "fromText", "toText", "resultsCount", "createdAt"
    FROM "SearchHistory"
    ${!Number.isNaN(userId) ? `WHERE "userId" = ${userId}` : ``}
    ORDER BY 
      COALESCE("userId", -1),
      COALESCE("fromText", ''),
      COALESCE("toText", ''),
      "createdAt" DESC
    LIMIT ${lim}
  `
  );

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
