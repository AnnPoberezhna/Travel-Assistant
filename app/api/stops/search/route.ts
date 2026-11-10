import { NextRequest, NextResponse } from "next/server";
import { findStopCandidates } from "@/app/lib/parser";

// Warsaw stop names use abbreviations ("Pl. Zbawiciela", "Dw. Centralny", "Al. Zieleniecka"),
// so "plac zbawiciela" would find nothing. When the text as typed finds no stop, these words
// are tried in their short form.
const SHORT_FORMS: Record<string, string> = {
  plac: "pl",
  placu: "pl",
  dworzec: "dw",
  dworca: "dw",
  aleja: "al",
  aleje: "al",
  alei: "al",
  ulica: "ul",
  ulicy: "ul",
  osiedle: "os",
  osiedla: "os",
};
const shortForm = (text: string) =>
  text
    .split(/\s+/)
    .map((word) => SHORT_FORMS[word.toLowerCase()] ?? word)
    .join(" ");

// GET /api/stops/search?q=centrum – stops whose name matches the text, best matches first.
// Used by the From / To fields of the search on the home page (and by voice search).
//   ?limit=8   number of stops (1–20)
// Polish characters are optional ("marszalkowska" finds "Marszałkowska"). Warsaw stops have several
// posts with the same name, so the post number is part of the name ("Centrum 01").
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim();
  const limit = Math.min(Math.max(Number(params.get("limit") ?? 8) || 8, 1), 20);

  if (q.length < 2 || q.length > 100) {
    return NextResponse.json({ error: "q must be 2–100 characters of a stop name" }, { status: 400 });
  }

  try {
    let rows = await findStopCandidates(q, limit);
    const short = shortForm(q);
    if (rows.length === 0 && short !== q) rows = await findStopCandidates(short, limit);
    const stops = rows.map((r) => ({ id: Number(r.id), name: String(r.nazwa), address: r.adres ?? null }));
    return NextResponse.json({ count: stops.length, stops });
  } catch (error) {
    console.error("Failed to search stops:", error);
    return NextResponse.json({ error: "Failed to search stops" }, { status: 500 });
  }
}
