import { NextRequest, NextResponse } from "next/server";
import { parseSimpleCommand, findStopCandidates } from "@/app/lib/parser";
import { findDirectConnections } from "@/app/lib/connections";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const direct = url.searchParams.get("direct");

  if (!q.trim()) {
    return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
  }

  const parsed = parseSimpleCommand(q) as any;

  // find candidate stops for parsed from/to (prefer normalized tokens if available)
  const fromText: string | undefined = parsed.fromNorm ?? parsed.from;
  const toText: string | undefined = parsed.toNorm ?? parsed.to;
  const fromCandidates: any[] = fromText ? await findStopCandidates(fromText, 6) : [];
  const toCandidates: any[] = toText ? await findStopCandidates(toText, 6) : [];

  const response: any = {
    query: q,
    parsed,
    fromCandidates,
    toCandidates,
  };

  // if user requested direct search, try combinations of top candidates (e.g. 3x3)
  if ((direct === "1" || direct === "true") && fromCandidates.length && toCandidates.length) {
    const maxPerSide = 3;
    const fromSlice = fromCandidates.slice(0, maxPerSide);
    const toSlice = toCandidates.slice(0, maxPerSide);

    const pairs: Array<{
      fromId: number;
      toId: number;
      fromName: string;
      toName: string;
    }> = [];

    for (const f of fromSlice) {
      for (const t of toSlice) {
        pairs.push({ fromId: f.id as number, toId: t.id as number, fromName: f.nazwa, toName: t.nazwa });
      }
    }

    const now = new Date();

    const pairResults = await Promise.all(
      pairs.map(async (p) => {
        try {
          const routes = await findDirectConnections(p.fromId, p.toId, now, 20);
          return { ...p, routes };
        } catch (err: any) {
          return { ...p, routes: [], error: String(err?.message ?? err) };
        }
      })
    );

    response.directPairs = pairResults;
  }

  return NextResponse.json(response);
}
