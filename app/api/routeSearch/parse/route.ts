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

  // Loguj historię TYLKO dla zalogowanych użytkowników (userId), anonimowi są pomijani
  try {
    let userId: number | null = null;

    // Spróbuj pobrać aktywną sesję z istniejącego endpointu NextAuth bez modyfikowania auth
    try {
      const sessionRes = await fetch(`${url.origin}/api/auth/session`, {
        headers: {
          // przekaż ciasteczka z żądania, aby sesja była rozpoznana
          cookie: req.headers.get("cookie") ?? "",
        },
        cache: "no-store",
      });
      if (sessionRes.ok) {
        const sessionJson: any = await sessionRes.json().catch(() => null);
        // Preferuj bezpośrednie id z sesji, jeśli istnieje
        const sid = sessionJson?.user?.id;
        const sidNum = sid !== undefined ? Number(sid) : NaN;
        if (!Number.isNaN(sidNum)) {
          userId = sidNum;
        } else {
          // Jeśli brak id w sesji, spróbuj znaleźć użytkownika po emailu
          const email: string | undefined = sessionJson?.user?.email;
          if (email) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const { prisma } = await import("@/app/lib/db");
            const u = await prisma.user.findUnique({ where: { email } });
            if (u?.id) userId = Number(u.id);
          }
        }
      }
    } catch {
      // brak sesji lub błąd – pomijamy
    }

    // DEV-only override for testing via header/query (używane tylko gdy brak realnej sesji)
    if (process.env.NODE_ENV !== "production") {
      const testHeader = req.headers.get("x-test-user-id");
      const testQuery = url.searchParams.get("testUserId");
      const candidate = Number(testHeader ?? testQuery);
      if (!userId && !Number.isNaN(candidate)) {
        userId = candidate;
      }
    }

    if (userId && !Number.isNaN(userId)) {
      const resultsCount = Array.isArray(response.directPairs)
        ? response.directPairs.reduce((acc: number, p: any) => acc + (Array.isArray(p.routes) ? p.routes.length : 0), 0)
        : 0;

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const { prisma } = await import("@/app/lib/db");
      await prisma.searchHistory.create({
        data: {
          userId,
          query: q,
          fromText: parsed.fromNorm ?? parsed.from ?? null,
          toText: parsed.toNorm ?? parsed.to ?? null,
          resultsCount,
        },
      });
    }
  } catch (_) {
    // pomiń błędy logowania
  }

  return NextResponse.json(response);
}
