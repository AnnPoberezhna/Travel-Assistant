"use client";
import { useEffect, useState } from "react";

export default function SearchPage() {
  const [query, setQuery] = useState("wrocław -> katowice");
  const [direct, setDirect] = useState(true);
  const [resp, setResp] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);
  const [pairRoutes, setPairRoutes] = useState<any[] | null>(null);
  const [savingFav, setSavingFav] = useState(false);
  const [favMessage, setFavMessage] = useState<string | null>(null);

  const runSearch = async () => {
    setLoading(true);
    setError(null);
    setResp(null);
    setPairRoutes(null);
    try {
      const params = new URLSearchParams();
      params.set("q", query);
      if (direct) params.set("direct", "1");
      const res = await fetch(`/api/routeSearch/parse?${params.toString()}`);
      const json = await res.json();
      setResp(json);
      // preset selects with first candidates if not chosen
      if (!fromId && Array.isArray(json.fromCandidates) && json.fromCandidates.length) {
        setFromId(Number(json.fromCandidates[0].id));
      }
      if (!toId && Array.isArray(json.toCandidates) && json.toCandidates.length) {
        setToId(Number(json.toCandidates[0].id));
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const runDirectForPair = async () => {
    if (!fromId || !toId) {
      setError("Please select both From and To stops");
      return;
    }
    setLoading(true);
    setError(null);
    setPairRoutes(null);
    try {
      // Prefer dedicated direct search API if available
      const res = await fetch(`/api/routeSearch/find?fromId=${fromId}&toId=${toId}`);
      if (res.ok) {
        const json = await res.json();
        // expect { routes: [...] }
        setPairRoutes(Array.isArray(json.routes) ? json.routes : []);
      } else {
        // fallback: re-run parse with direct and filter selected pair
        const params = new URLSearchParams();
        params.set("q", query);
        params.set("direct", "1");
        const res2 = await fetch(`/api/routeSearch/parse?${params.toString()}`);
        const json2 = await res2.json();
        const match = (json2.directPairs ?? []).find((p: any) => Number(p.fromId) === fromId && Number(p.toId) === toId);
        setPairRoutes(match ? (Array.isArray(match.routes) ? match.routes : []) : []);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const addToFavorites = async () => {
    if (!fromId || !toId) {
      setFavMessage("Please select both stops first");
      return;
    }
    setSavingFav(true);
    setFavMessage(null);
    try {
      const res = await fetch("/api/favoriteRoutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          przystanekStartId: fromId,
          przystanekKoniecId: toId,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setFavMessage("Added to favourites");
      } else {
        setFavMessage(json.error || "Failed to add to favourites");
      }
    } catch (e: any) {
      setFavMessage(e.message || "Error saving favourite");
    } finally {
      setSavingFav(false);
      setTimeout(() => setFavMessage(null), 3000);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 20 }}>
      <h1 style={{ fontSize: 32, marginBottom: 16 }}>Route Search</h1>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type e.g. wrocław -> katowice"
          style={{ flex: 1, padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8 }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={direct} onChange={(e) => setDirect(e.target.checked)} />
          Direct only
        </label>
        <button onClick={runSearch} style={{ padding: "10px 16px", borderRadius: 8, background: "#0f172a", color: "#fff", border: "none", cursor: "pointer" }}>
          Search
        </button>
      </div>
      {resp && (
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
            <label><strong>From</strong></label>
            <select
              value={fromId ?? ""}
              onChange={(e) => setFromId(Number(e.target.value))}
              style={{ padding: "8px 10px", border: "1px solid #ddd", borderRadius: 8 }}
            >
              <option value="" disabled>Select stop</option>
              {(resp.fromCandidates ?? []).map((c: any) => (
                <option key={`f-${c.id}`} value={c.id}>{c.nazwa}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
            <label><strong>To</strong></label>
            <select
              value={toId ?? ""}
              onChange={(e) => setToId(Number(e.target.value))}
              style={{ padding: "8px 10px", border: "1px solid #ddd", borderRadius: 8 }}
            >
              <option value="" disabled>Select stop</option>
              {(resp.toCandidates ?? []).map((c: any) => (
                <option key={`t-${c.id}`} value={c.id}>{c.nazwa}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <button onClick={runDirectForPair} style={{ padding: "10px 16px", borderRadius: 8, background: "#0f172a", color: "#fff", border: "none", cursor: "pointer" }}>
              Find Direct Routes
            </button>
            <button 
              onClick={addToFavorites} 
              disabled={savingFav || !fromId || !toId}
              style={{ 
                padding: "10px 16px", 
                borderRadius: 8, 
                background: savingFav ? "#94a3b8" : "#10b981", 
                color: "#fff", 
                border: "none", 
                cursor: savingFav || !fromId || !toId ? "not-allowed" : "pointer",
                opacity: savingFav || !fromId || !toId ? 0.6 : 1
              }}
            >
              {savingFav ? "Saving..." : "Add to Favourites"}
            </button>
          </div>
        </div>
      )}
      {loading && <div>Loading...</div>}
      {error && <div style={{ color: "#b91c1c" }}>Error: {error}</div>}
      {favMessage && <div style={{ color: favMessage.startsWith("Added") ? "#10b981" : "#b91c1c", marginTop: 8, fontWeight: 500 }}>{favMessage}</div>}
      {resp && (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Query:</strong> {resp.query}
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <div style={{ flex: 1 }}>
              <h3>From Candidates</h3>
              <ul>
                {(resp.fromCandidates ?? []).map((c: any) => (
                  <li key={`f-${c.id}`}>{c.nazwa}</li>
                ))}
              </ul>
            </div>
            <div style={{ flex: 1 }}>
              <h3>To Candidates</h3>
              <ul>
                {(resp.toCandidates ?? []).map((c: any) => (
                  <li key={`t-${c.id}`}>{c.nazwa}</li>
                ))}
              </ul>
            </div>
          </div>
          {Array.isArray(resp.directPairs) && (
            <div style={{ marginTop: 16 }}>
              <h3>Direct Pairs</h3>
              <ul>
                {resp.directPairs.map((p: any, idx: number) => (
                  <li key={`pair-${idx}`}>
                    {p.fromName} → {p.toName} ({Array.isArray(p.routes) ? p.routes.length : 0} routes)
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(pairRoutes) && (
            <div style={{ marginTop: 16 }}>
              <h3>Selected Pair Routes</h3>
              {pairRoutes.length === 0 ? (
                <div>No direct routes found for selected pair.</div>
              ) : (
                <ul>
                  {pairRoutes.map((r: any, idx: number) => (
                    <li key={`r-${idx}`}>
                      {r?.polaczenieNazwa ?? "Route"} — stop count: {r?.stopCount ?? (Array.isArray(r?.stops) ? r.stops.length : "-")}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
