"use client";

import React, { useState, useEffect } from "react";

type Stop = {
  id: number;
  nazwa: string;
  adres?: string | null;
};

type PairResult = {
  fromId: number;
  toId: number;
  fromName: string;
  toName: string;
  routes: any[];
  error?: string;
};

export default function StopSearchClient() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [selectedFrom, setSelectedFrom] = useState<Stop | null>(null);
  const [selectedTo, setSelectedTo] = useState<Stop | null>(null);

  useEffect(() => {
    // autocomplete when query changes, debounce
    const t = setTimeout(() => {
      if (!q.trim()) {
        setData(null);
        return;
      }
      doParse(q, false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function doParse(query: string, askDirect = false) {
    setLoading(true);
    try {
      const url = `/api/routeSearch/parse?q=${encodeURIComponent(query)}${askDirect ? "&direct=1" : ""}`;
      const res = await fetch(url);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setData({ error: String(err) });
    } finally {
      setLoading(false);
    }
  }

  function groupedCandidates(stops: Stop[] = []) {
    // group by address (city) or by first word fallback
    const groups = new Map<string, Stop[]>();
    for (const s of stops) {
      const key = s.adres || s.nazwa.split(/\s+/)[0] || "Inne";
      const arr = groups.get(key) ?? [];
      arr.push(s);
      groups.set(key, arr);
    }
    return groups;
  }

  function pickFrom(s: Stop) {
    setSelectedFrom(s);
  }

  function pickTo(s: Stop) {
    setSelectedTo(s);
  }

  async function searchDirect() {
    if (!selectedFrom || !selectedTo) return;
    // call parse with direct=1 but using explicit names to get candidates + directPairs
    const qtext = `${selectedFrom.nazwa} -> ${selectedTo.nazwa}`;
    await doParse(qtext, true);
  }

  return (
    <div style={{ padding: 16, maxWidth: 800 }}>
      <h3>Wyszukaj trasę (przykład: {'wrocław -> katowice'})</h3>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Wpisz zapytanie..."
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={() => doParse(q, false)} disabled={loading}>Szukaj</button>
        <button onClick={() => doParse(q, true)} disabled={loading}>Szukaj i znajdź połączenia</button>
      </div>

      {loading && <div>Ładuję...</div>}

      {data && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <strong>Rozpoznano:</strong>
            <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(data.parsed, null, 2)}</pre>
          </div>

          <div style={{ display: "flex", gap: 24 }}>
            <div style={{ flex: 1 }}>
              <strong>From candidates</strong>
              {data.fromCandidates && data.fromCandidates.length ? (
                Array.from(groupedCandidates(data.fromCandidates).entries()).map(([group, items]) => (
                  <div key={group} style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 600 }}>{group}:</div>
                    <div>
                      {items.map((s: Stop) => (
                        <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button onClick={() => pickFrom(s)} style={{ padding: 4 }}>Wybierz</button>
                          <div>{s.nazwa} {s.adres ? `- ${s.adres}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div>Brak kandydatów</div>
              )}
            </div>

            <div style={{ flex: 1 }}>
              <strong>To candidates</strong>
              {data.toCandidates && data.toCandidates.length ? (
                Array.from(groupedCandidates(data.toCandidates).entries()).map(([group, items]) => (
                  <div key={group} style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 600 }}>{group}:</div>
                    <div>
                      {items.map((s: Stop) => (
                        <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button onClick={() => pickTo(s)} style={{ padding: 4 }}>Wybierz</button>
                          <div>{s.nazwa} {s.adres ? `- ${s.adres}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div>Brak kandydatów</div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div>Wybrane: <strong>{selectedFrom ? selectedFrom.nazwa : '-'}</strong>{' -> '}<strong>{selectedTo ? selectedTo.nazwa : '-'}</strong></div>
            <div style={{ marginTop: 8 }}>
              <button onClick={searchDirect} disabled={!selectedFrom || !selectedTo}>Znajdź połączenia dla wybranych</button>
            </div>
          </div>

          {data.directPairs && (
            <div style={{ marginTop: 16 }}>
              <h4>Wyniki bezpośrednie (pary kandydatów)</h4>
              {data.directPairs.map((p: PairResult, i: number) => (
                <div key={i} style={{ borderTop: '1px solid #eee', paddingTop: 8, marginTop: 8 }}>
                  <div style={{ fontWeight: 700 }}>{p.fromName}{' -> '}{p.toName} ({p.routes.length} tras)</div>
                  {p.error && <div style={{ color: 'red' }}>{p.error}</div>}
                  {p.routes && p.routes.length ? (
                    <ul>
                      {p.routes.map((r: any, idx: number) => (
                        <li key={idx}>{r.przewoznikName}: {new Date(r.startTime).toLocaleString()}{' -> '}{new Date(r.endTime).toLocaleString()}</li>
                      ))}
                    </ul>
                  ) : (
                    <div>Brak tras dla tej pary</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
