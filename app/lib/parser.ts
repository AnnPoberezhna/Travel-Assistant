import { prisma } from "./db";

type ParseResult = {
  transport?: string;
  from?: string;
  to?: string;
  fromNorm?: string;
  toNorm?: string;
};

export function parseSimpleCommand(q: string): ParseResult {
  if (!q || !q.trim()) return {};

  const raw = q.trim();

  const normalizeText = (s: string) => {
    if (!s) return "";
    // decompose accents
    let out = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // lower-case for mapping
    out = out.toLowerCase();
    // map common Polish precomposed letters to ASCII equivalents
    out = out.replace(/[ąćęłńóśźż]/g, (c) => {
      switch (c) {
        case 'ą': return 'a';
        case 'ć': return 'c';
        case 'ę': return 'e';
        case 'ł': return 'l';
        case 'ń': return 'n';
        case 'ó': return 'o';
        case 'ś': return 's';
        case 'ź': return 'z';
        case 'ż': return 'z';
        default: return c;
      }
    });
    return out;
  };

  // split on obvious separators: arrow, ' to ', ' do ', ' na '
  const parts = raw.split(/->|→|-->|\bto\b|\bdo\b|\bna\b/i).map(p => p.trim()).filter(Boolean);

  const transportMatch = raw.match(/\b(pociąg|pociag|bus|autobus|tramwaj|pks)\b/i);
  const transport = transportMatch ? transportMatch[0].toLowerCase() : undefined;

  if (parts.length >= 2) {
    // assume first part contains optional transport + from, second is to
    const left = parts[0].replace(/\b(pociąg|pociag|bus|autobus|tramwaj|pks)\b/i, "").trim();
    const right = parts[1];
    return {
      transport,
      from: left || undefined,
      to: right || undefined,
      fromNorm: left ? normalizeText(left) : undefined,
      toNorm: right ? normalizeText(right) : undefined,
    };
  }

  // fallback: take first word(s) as from and last as to
  const words = raw.replace(/\b(pociąg|pociag|bus|autobus|tramwaj|pks)\b/ig, "").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const from = words[0];
    const to = words.slice(1).join(" ");
    return { transport, from, to, fromNorm: normalizeText(from), toNorm: normalizeText(to) };
  }

  return { transport, from: raw, fromNorm: normalizeText(raw) };
}

export async function findStopCandidates(text: string, limit = 6): Promise<any[]> {
  const cleaned = (text || "").trim();
  if (!cleaned) return [];

  const tokens = cleaned.split(/\s+/).filter(Boolean).map(t => t.toLowerCase());

  // Try DB-side unaccent + lower search (fast if DB has unaccent extension).
  try {
    const params: string[] = [];
    const clauses: string[] = [];
    tokens.forEach((t, i) => {
      params.push(`%${t}%`);
      // compare unaccented lower(nazwa) to unaccented parameter to handle diacritics
      clauses.push(`lower(unaccent(nazwa)) LIKE lower(unaccent($${i + 1}))`);
    });
    // Best matches first: exact name, then names starting with the text, then the rest (shorter first).
    // Without this, "centrum" could return "Wieliszew Centrum" before "Centrum".
    params.push(cleaned);
    const full = `lower(unaccent($${params.length}))`;
    // Warsaw stops have several posts with the same name, so the post number is added ("Centrum 01")
    const sql = `SELECT id, CASE WHEN "ztmStopNr" IS NOT NULL THEN nazwa || ' ' || "ztmStopNr" ELSE nazwa END AS nazwa, adres
      FROM "Przystanek" WHERE ${clauses.join(" AND ")}
      ORDER BY CASE WHEN lower(unaccent(nazwa)) = ${full} THEN 0 WHEN lower(unaccent(nazwa)) LIKE ${full} || '%' THEN 1 ELSE 2 END,
        length(nazwa), nazwa, "ztmStopNr" NULLS LAST
      LIMIT ${limit}`;
    // $queryRawUnsafe with parameters
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const rows = (await prisma.$queryRawUnsafe(sql, ...params)) as any[];
    return rows;
  } catch (e) {
    // DB might not support unaccent (the extension isn't installed by default) — fallback to JS filtering
    const all = await prisma.przystanek.findMany({ select: { id: true, nazwa: true, adres: true, ztmStopNr: true } });
    // Same normalization as the query text: no accents, lower case, "ł" -> "l" (NFD doesn't split "ł")
    const strip = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/ł/g, "l");

    const tokensNorm = tokens.map(strip);
    const fullNorm = strip(cleaned);
    // Best matches first: exact name, then names starting with the text, then the rest (shorter first)
    const rank = (name: string) => (name === fullNorm ? 0 : name.startsWith(fullNorm) ? 1 : 2);

    return all
      .map((p) => ({ p, name: strip(p.nazwa || "") }))
      .filter(({ name }) => tokensNorm.every((t) => name.includes(t)))
      .sort(
        (a, b) =>
          rank(a.name) - rank(b.name) ||
          a.name.length - b.name.length ||
          a.name.localeCompare(b.name) ||
          // numbered bus/tram posts before stops without a post number (metro)
          Number(!a.p.ztmStopNr) - Number(!b.p.ztmStopNr) ||
          (a.p.ztmStopNr ?? "").localeCompare(b.p.ztmStopNr ?? "")
      )
      .slice(0, limit)
      // Warsaw stops have several posts with the same name, so the post number is added ("Centrum 01")
      .map(({ p }) => ({ id: p.id, nazwa: p.ztmStopNr ? `${p.nazwa} ${p.ztmStopNr}` : p.nazwa, adres: p.adres }));
  }
}

export default { parseSimpleCommand, findStopCandidates };
