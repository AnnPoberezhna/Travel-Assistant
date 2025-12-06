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
    const sql = `SELECT id, nazwa, adres FROM "Przystanek" WHERE ${clauses.join(" AND ")} LIMIT ${limit}`;
    // $queryRawUnsafe with parameters
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const rows = (await prisma.$queryRawUnsafe(sql, ...params)) as any[];
    return rows;
  } catch (e) {
    // DB might not support unaccent or raw queries in environment — fallback to JS filtering
    const all = await prisma.przystanek.findMany();
    const strip = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    const tokensNorm = tokens.map(t => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());

    const filtered = all.filter((p) => {
      const name = strip(p.nazwa || "");
      return tokensNorm.every(t => name.includes(t));
    });

    return filtered.slice(0, limit);
  }
}

export default { parseSimpleCommand, findStopCandidates };
