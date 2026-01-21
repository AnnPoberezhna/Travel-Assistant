"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Search, MapPin, ArrowRight, Star, Clock, Repeat, Train, Bus } from "lucide-react";
import VoiceInput from "@/app/components/VoiceInput";

export default function SearchPage() {
  const searchParams = useSearchParams();
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
  const [withTransfer, setWithTransfer] = useState(false);
  const [ignoreTime, setIgnoreTime] = useState(false);

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
      // Prefer dedicated search API (supports transfers & time options)
      const params = new URLSearchParams();
      params.set("startId", String(fromId));
      params.set("endId", String(toId));
      if (withTransfer) params.set("transfers", "1");
      if (ignoreTime) params.set("ignoreTime", "1");
      const res = await fetch(`/api/routeSearch/find?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        // expect { results: [...] }
        setPairRoutes(Array.isArray(json.results) ? json.results : []);
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

  // Handle URL parameters from favorites page
  useEffect(() => {
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    
    if (fromParam && toParam) {
      const fromIdNum = Number(fromParam);
      const toIdNum = Number(toParam);
      
      if (!isNaN(fromIdNum) && !isNaN(toIdNum)) {
        setFromId(fromIdNum);
        setToId(toIdNum);
        
        // Automatically trigger the route search
        setLoading(true);
        setError(null);
        setPairRoutes(null);
        setResp(null);
        
        const params = new URLSearchParams();
        params.set("startId", String(fromIdNum));
        params.set("endId", String(toIdNum));
        if (withTransfer) params.set("transfers", "1");
        if (ignoreTime) params.set("ignoreTime", "1");
        
        fetch(`/api/routeSearch/find?${params.toString()}`)
          .then((res) => {
            if (!res.ok) throw new Error("Failed to fetch routes");
            return res.json();
          })
          .then((json) => {
            setPairRoutes(Array.isArray(json.results) ? json.results : []);
            
            // Fetch the stop names from the route results if available
            if (json.results && json.results.length > 0) {
              // Extract stop names from the first result
              const firstRoute = json.results[0];
              const fromName = firstRoute.startStopName || `Stop ${fromIdNum}`;
              const toName = firstRoute.endStopName || `Stop ${toIdNum}`;
              
              setResp({
                query: `${fromName} → ${toName}`,
                fromCandidates: [{ id: fromIdNum, nazwa: fromName }],
                toCandidates: [{ id: toIdNum, nazwa: toName }],
              });
            } else {
              // No routes found, still create a basic resp object
              setResp({
                query: "From favorites (no routes found)",
                fromCandidates: [{ id: fromIdNum, nazwa: `Stop #${fromIdNum}` }],
                toCandidates: [{ id: toIdNum, nazwa: `Stop #${toIdNum}` }],
              });
            }
          })
          .catch((e: any) => {
            setError(String(e?.message ?? e));
            // Still set a basic resp to show the selection
            setResp({
              query: "Error loading from favorites",
              fromCandidates: [{ id: fromIdNum, nazwa: `Stop #${fromIdNum}` }],
              toCandidates: [{ id: toIdNum, nazwa: `Stop #${toIdNum}` }],
            });
          })
          .finally(() => setLoading(false));
      }
    }
  }, [searchParams]);

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#0a1929", position: "relative", paddingBottom: "80px" }}>
      <style dangerouslySetInnerHTML={{__html: `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; min-height: 100vh; background: #0a1929; }
        @keyframes floatTicket { 0%, 100% { transform: translateY(0px) rotate(-5deg); } 50% { transform: translateY(-30px) rotate(-8deg); } }
        @keyframes floatTicket2 { 0%, 100% { transform: translateY(0px) rotate(5deg); } 50% { transform: translateY(-40px) rotate(8deg); } }
        @keyframes floatTicket3 { 0%, 100% { transform: translateY(-20px) rotate(-3deg); } 50% { transform: translateY(-50px) rotate(-6deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes fadeInOut { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.4; } }
      `}} />

      {/* Ticket Background */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none" }}>
        {/* Ticket 1 */}
        <div style={{ position: "absolute", top: "10%", left: "5%", width: "280px", height: "120px", background: "linear-gradient(135deg, #fff9c4 0%, #fff59d 100%)", borderRadius: "8px", border: "3px dashed #fbc02d", padding: "16px", animation: "floatTicket 20s ease-in-out infinite", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", transform: "rotate(-5deg)", opacity: 0.3 }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#f57f17", marginBottom: "8px" }}>🚂 TRAIN TICKET</div>
          <div style={{ fontSize: "16px", fontWeight: "900", color: "#f57f17", marginBottom: "4px" }}>WARSZAWA → KRAKÓW</div>
          <div style={{ fontSize: "10px", color: "#f57f17", opacity: 0.8 }}>PKP INTERCITY • 14:30</div>
        </div>
        
        {/* Ticket 2 */}
        <div style={{ position: "absolute", top: "60%", right: "8%", width: "260px", height: "110px", background: "linear-gradient(135deg, #e1f5fe 0%, #b3e5fc 100%)", borderRadius: "8px", border: "3px dashed #0288d1", padding: "16px", animation: "floatTicket2 18s ease-in-out infinite", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", transform: "rotate(5deg)", opacity: 0.25, animationDelay: "3s" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#01579b", marginBottom: "8px" }}>🚌 BUS TICKET</div>
          <div style={{ fontSize: "16px", fontWeight: "900", color: "#01579b", marginBottom: "4px" }}>GDAŃSK → SOPOT</div>
          <div style={{ fontSize: "10px", color: "#01579b", opacity: 0.8 }}>PKS • 09:15</div>
        </div>
        
        {/* Ticket 3 */}
        <div style={{ position: "absolute", top: "35%", right: "3%", width: "270px", height: "115px", background: "linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)", borderRadius: "8px", border: "3px dashed #8e24aa", padding: "16px", animation: "floatTicket3 22s ease-in-out infinite", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", transform: "rotate(-3deg)", opacity: 0.28, animationDelay: "7s" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#4a148c", marginBottom: "8px" }}>🚂 EXPRESS</div>
          <div style={{ fontSize: "16px", fontWeight: "900", color: "#4a148c", marginBottom: "4px" }}>WROCŁAW → POZNAŃ</div>
          <div style={{ fontSize: "10px", color: "#4a148c", opacity: 0.8 }}>POLREGIO • 16:45</div>
        </div>
        
        {/* Ticket 4 */}
        <div style={{ position: "absolute", bottom: "15%", left: "3%", width: "275px", height: "118px", background: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)", borderRadius: "8px", border: "3px dashed #43a047", padding: "16px", animation: "floatTicket 19s ease-in-out infinite", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", transform: "rotate(4deg)", opacity: 0.26, animationDelay: "10s" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#1b5e20", marginBottom: "8px" }}>🚌 INTERCITY BUS</div>
          <div style={{ fontSize: "16px", fontWeight: "900", color: "#1b5e20", marginBottom: "4px" }}>KATOWICE → ŁÓDŹ</div>
          <div style={{ fontSize: "10px", color: "#1b5e20", opacity: 0.8 }}>FLIXBUS • 11:20</div>
        </div>
        
        {/* Ticket 5 */}
        <div style={{ position: "absolute", top: "75%", right: "25%", width: "265px", height: "112px", background: "linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)", borderRadius: "8px", border: "3px dashed #e53935", padding: "16px", animation: "floatTicket2 21s ease-in-out infinite", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", transform: "rotate(-4deg)", opacity: 0.24, animationDelay: "5s" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#b71c1c", marginBottom: "8px" }}>🚂 REGIONAL</div>
          <div style={{ fontSize: "16px", fontWeight: "900", color: "#b71c1c", marginBottom: "4px" }}>LUBLIN → ZAMOŚĆ</div>
          <div style={{ fontSize: "10px", color: "#b71c1c", opacity: 0.8 }}>POLREGIO • 13:55</div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <Train size={56} color="#42a5f5" style={{ animation: "pulse 2s ease-in-out infinite" }} />
            <h1 style={{ fontSize: 56, fontWeight: 900, margin: 0, background: "linear-gradient(135deg, #42a5f5 0%, #66bb6a 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Travel Assistant</h1>
            <Bus size={56} color="#66bb6a" style={{ animation: "pulse 2s ease-in-out infinite 1s" }} />
          </div>
          <p style={{ fontSize: 20, color: "#90caf9", fontWeight: 500 }}>Your Transport Connection Hub</p>
        </div>

        <div style={{ background: "rgba(255, 255, 255, 0.95)", borderRadius: 24, padding: 40, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", border: "2px solid rgba(66, 165, 245, 0.3)" }}>
          <div style={{ marginBottom: 28, padding: 24, background: "linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%)", borderRadius: 16, boxShadow: "0 8px 24px rgba(66, 165, 245, 0.4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <MapPin size={24} color="#fff" />
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Voice Search</div>
            </div>
            <div style={{ background: "rgba(255, 255, 255, 0.95)", borderRadius: 12, padding: 16 }}>
              <VoiceInput 
                onTranscript={(text) => console.log("Voice transcript:", text)} 
                onQuery={(pq) => {
                  setQuery(pq);
                  console.log("Voice query set:", pq);
                }} 
                placeholder="Click microphone and say: Warszawa to Gdynia" 
              />
            </div>
          </div>

          <div style={{ position: "relative", marginBottom: 24 }}>
            <Search size={24} style={{ position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)", color: "#42a5f5" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. wrocław -> katowice" style={{ width: "100%", padding: "18px 20px 18px 56px", border: "3px solid #e3f2fd", borderRadius: 16, fontSize: 18, fontWeight: 500, outline: "none", background: "#fafafa" }} />
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            {[{ label: "Direct only", checked: direct, onChange: setDirect }, { label: "With transfer", checked: withTransfer, onChange: setWithTransfer }, { label: "Ignore time", checked: ignoreTime, onChange: setIgnoreTime }].map((opt, i) => (
              <label key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", background: opt.checked ? "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)" : "#f5f5f5", border: `3px solid ${opt.checked ? "#42a5f5" : "#e0e0e0"}`, borderRadius: 12, cursor: "pointer", fontSize: 15, fontWeight: 600, flex: 1, minWidth: 150 }}>
                <input type="checkbox" checked={opt.checked} onChange={(e) => opt.onChange(e.target.checked)} style={{ width: 20, height: 20, cursor: "pointer" }} />
                {opt.label}
              </label>
            ))}
          </div>

          <button onClick={runSearch} style={{ width: "100%", padding: "20px", background: "linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%)", color: "#fff", border: "none", borderRadius: 16, fontSize: 18, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 24px rgba(66, 165, 245, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <Search size={22} />
            FIND MY ROUTE
          </button>
        </div>

        {loading && (
          <div style={{ background: "rgba(255, 255, 255, 0.95)", borderRadius: 20, padding: 40, textAlign: "center", boxShadow: "0 12px 48px rgba(0,0,0,0.4)", marginTop: 24 }}>
            <Train size={48} color="#42a5f5" style={{ animation: "pulse 1s ease-in-out infinite", marginBottom: 16 }} />
            <div style={{ fontSize: 20, color: "#42a5f5", fontWeight: 600 }}>Finding your journey...</div>
          </div>
        )}

        {error && (
          <div style={{ background: "rgba(255, 255, 255, 0.95)", borderRadius: 20, padding: 28, border: "3px solid #ef5350", color: "#c62828", boxShadow: "0 12px 48px rgba(0,0,0,0.4)", marginTop: 24, fontSize: 16 }}>
            <strong>⚠️ Error:</strong> {error}
          </div>
        )}

        {favMessage && (
          <div style={{ background: favMessage.startsWith("Added") ? "rgba(102, 187, 106, 0.95)" : "rgba(239, 83, 80, 0.95)", color: "#fff", padding: 20, borderRadius: 16, marginTop: 24, fontWeight: 600, textAlign: "center", boxShadow: "0 8px 24px rgba(0,0,0,0.3)", fontSize: 16 }}>
            {favMessage.startsWith("Added") ? "⭐ " : "❌ "}{favMessage}
          </div>
        )}

        {resp && (
          <div style={{ background: "rgba(255, 255, 255, 0.95)", borderRadius: 24, padding: 40, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", marginTop: 24, border: "2px solid rgba(66, 165, 245, 0.3)" }}>
            <div style={{ marginBottom: 24, padding: 20, background: "#f8fafc", borderRadius: 12, border: "2px solid #e2e8f0" }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#334155", marginBottom: 8 }}>
                Query: <span style={{ color: "#42a5f5" }}>{resp.query}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
              <div style={{ flex: 1, padding: 20, background: "#f0f9ff", borderRadius: 12, border: "2px solid #bae6fd" }}>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: "#0369a1", marginBottom: 12 }}>From Candidates</h4>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {(resp.fromCandidates ?? []).map((c: any) => (
                    <li key={`f-${c.id}`} style={{ padding: "6px 0", fontSize: 14, color: "#0c4a6e" }}>
                      • {c.nazwa}
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ flex: 1, padding: 20, background: "#f0fdf4", borderRadius: 12, border: "2px solid #bbf7d0" }}>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: "#15803d", marginBottom: 12 }}>To Candidates</h4>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {(resp.toCandidates ?? []).map((c: any) => (
                    <li key={`t-${c.id}`} style={{ padding: "6px 0", fontSize: 14, color: "#14532d" }}>
                      • {c.nazwa}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {Array.isArray(resp.directPairs) && resp.directPairs.length > 0 && (
              <div style={{ marginBottom: 24, padding: 20, background: "#fef3c7", borderRadius: 12, border: "2px solid #fde68a" }}>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: "#92400e", marginBottom: 12 }}>Direct Pairs Found</h4>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {resp.directPairs.map((p: any, idx: number) => (
                    <li key={`pair-${idx}`} style={{ padding: "6px 0", fontSize: 14, color: "#78350f" }}>
                      • {p.fromName} → {p.toName} ({Array.isArray(p.routes) ? p.routes.length : 0} routes)
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 20, marginBottom: 32, alignItems: "end" }}>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: "#1565c0", marginBottom: 12 }}>
                  <MapPin size={20} color="#1565c0" />
                  FROM
                </label>
                <select value={fromId ?? ""} onChange={(e) => setFromId(Number(e.target.value))} style={{ width: "100%", padding: "16px 20px", border: "3px solid #e3f2fd", borderRadius: 12, fontSize: 16, fontWeight: 500, cursor: "pointer", background: "#fafafa" }}>
                  <option value="" disabled>Select departure</option>
                  {(resp.fromCandidates ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nazwa}</option>)}
                </select>
              </div>
              
              <div style={{ paddingBottom: 16 }}>
                <ArrowRight size={32} color="#42a5f5" strokeWidth={3} />
              </div>

              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: "#1565c0", marginBottom: 12 }}>
                  <MapPin size={20} color="#1565c0" />
                  TO
                </label>
                <select value={toId ?? ""} onChange={(e) => setToId(Number(e.target.value))} style={{ width: "100%", padding: "16px 20px", border: "3px solid #e3f2fd", borderRadius: 12, fontSize: 16, fontWeight: 500, cursor: "pointer", background: "#fafafa" }}>
                  <option value="" disabled>Select destination</option>
                  {(resp.toCandidates ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nazwa}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 40 }}>
              <button onClick={runDirectForPair} style={{ flex: 1, padding: "18px 24px", background: "linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%)", color: "#fff", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 20px rgba(66, 165, 245, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <Train size={20} />
                {withTransfer ? "FIND WITH TRANSFER" : "FIND DIRECT"}
              </button>
              <button onClick={addToFavorites} disabled={savingFav || !fromId || !toId} style={{ padding: "18px 32px", background: savingFav || !fromId || !toId ? "#bdbdbd" : "linear-gradient(135deg, #ffd54f 0%, #ffb300 100%)", color: savingFav || !fromId || !toId ? "#757575" : "#f57f17", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 700, cursor: savingFav || !fromId || !toId ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                <Star size={20} fill={savingFav || !fromId || !toId ? "none" : "#f57f17"} />
                {savingFav ? "SAVING..." : "FAVOURITE"}
              </button>
            </div>

            {Array.isArray(pairRoutes) && pairRoutes.length > 0 && (
              <div>
                <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 20, color: "#0d47a1", display: "flex", alignItems: "center", gap: 12 }}>
                  <Train size={28} color="#42a5f5" />
                  {withTransfer ? "ROUTES WITH TRANSFER" : "DIRECT ROUTES"}
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {pairRoutes.map((r: any, idx: number) => (
                    <div key={idx} style={{ padding: 24, background: "linear-gradient(135deg, #fff9c4 0%, #fff59d 100%)", borderRadius: 16, border: "3px solid #fbc02d", boxShadow: "0 4px 12px rgba(251, 192, 45, 0.3)" }}>
                      {withTransfer ? (
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                            <Train size={22} color="#f57f17" />
                            <span style={{ fontWeight: 700, color: "#f57f17", fontSize: 18 }}>Route #{idx + 1}</span>
                          </div>
                          <div style={{ marginLeft: 32, fontSize: 15, color: "#f57f17", lineHeight: 1.8 }}>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>
                              🚆 First Leg: {r.firstPrzewoznikName} [{r.firstPolaczenieNazwa}]
                            </div>
                            <div style={{ marginLeft: 16, marginBottom: 12 }}>
                              From {r.startStopName} → Transfer at {r.transferStopName}
                              <br />
                              Transfer Time: {new Date(r.transferTime).toLocaleTimeString()}
                            </div>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>
                              🚆 Second Leg: {r.secondPrzewoznikName} [{r.secondPolaczenieNazwa}]
                            </div>
                            <div style={{ marginLeft: 16 }}>
                              From {r.transferStopName} → To {r.endStopName}
                              <br />
                              Arrival Time: {new Date(r.endTime).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                            <Train size={22} color="#f57f17" />
                            <span style={{ fontWeight: 700, color: "#f57f17", fontSize: 18 }}>{r.przewoznikName}</span>
                          </div>
                          <div style={{ marginLeft: 32, fontSize: 15, color: "#f57f17", lineHeight: 1.8 }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                              {r.polaczenieNazwa}
                            </div>
                            <div>
                              🚏 Departure: {r.startStopName} at {new Date(r.startTime).toLocaleTimeString()}
                            </div>
                            <div>
                              🚏 Arrival: {r.endStopName} at {new Date(r.endTime).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(pairRoutes) && pairRoutes.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: "#757575", background: "#f5f5f5", borderRadius: 16, border: "3px dashed #bdbdbd" }}>
                <Train size={48} color="#bdbdbd" style={{ marginBottom: 16 }} />
                <div style={{ fontSize: 18, fontWeight: 600 }}>No routes found</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
