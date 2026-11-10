"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, MapPin, ArrowLeftRight, Star, Train, Bus, Map as MapIcon } from "lucide-react";
import VoiceInput from "./components/VoiceInput";
import LiveDepartures from "./components/LiveDepartures";
import StopPicker, { type StopOption } from "./components/StopPicker";

/** Stops and options of the last search – the results belong to them, even if the fields change later */
type Searched = { from: StopOption; to: StopOption; transfer: boolean };

export default function Home() {
  // Departure and destination stops, chosen from the suggestions in the From / To fields
  const [from, setFrom] = useState<StopOption | null>(null);
  const [to, setTo] = useState<StopOption | null>(null);
  const [withTransfer, setWithTransfer] = useState(false);
  const [ignoreTime, setIgnoreTime] = useState(false);
  const [searched, setSearched] = useState<Searched | null>(null);
  const [pairRoutes, setPairRoutes] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [savingFav, setSavingFav] = useState(false);
  const [favMessage, setFavMessage] = useState<string | null>(null);

  const findRoutes = async () => {
    if (!from || !to) {
      setError("Please choose both the departure and the destination stop");
      return;
    }
    if (from.id === to.id) {
      setError("The departure and the destination are the same stop");
      return;
    }
    setLoading(true);
    setError(null);
    setPairRoutes(null);
    setSearched({ from, to, transfer: withTransfer });
    try {
      const params = new URLSearchParams({ startId: String(from.id), endId: String(to.id), history: "1" });
      if (withTransfer) params.set("transfers", "1");
      if (ignoreTime) params.set("ignoreTime", "1");
      const res = await fetch(`/api/routeSearch/find?${params.toString()}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setPairRoutes(Array.isArray(json?.results) ? json.results : []);
    } catch (e) {
      setError((e as Error).message ?? String(e));
      setSearched(null);
    } finally {
      setLoading(false);
    }
  };

  // Voice search gives "from -> to": fill both fields with the best matching stop
  const applyVoiceQuery = async (spoken: string) => {
    const [fromText, toText] = spoken.split("->").map((s) => s.trim());
    if (!fromText || !toText) return;
    setVoiceNote(null);
    const bestStop = async (text: string): Promise<StopOption | null> => {
      const res = await fetch(`/api/stops/search?q=${encodeURIComponent(text)}&limit=1`);
      const json = await res.json().catch(() => null);
      return res.ok ? (json?.stops?.[0] ?? null) : null;
    };
    try {
      const [fromStop, toStop] = await Promise.all([bestStop(fromText), bestStop(toText)]);
      if (fromStop) setFrom(fromStop);
      if (toStop) setTo(toStop);
      const missing = [fromStop ? null : fromText, toStop ? null : toText].filter(Boolean);
      if (missing.length) setVoiceNote(`No stop found for: ${missing.join(", ")}`);
    } catch {
      setVoiceNote("Couldn't look up the spoken stops");
    }
  };

  const swapStops = () => {
    setFrom(to);
    setTo(from);
  };

  const addToFavorites = async () => {
    if (!searched) return;
    setSavingFav(true);
    setFavMessage(null);
    try {
      const res = await fetch("/api/favoriteRoutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          przystanekStartId: searched.from.id,
          przystanekKoniecId: searched.to.id,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setFavMessage("Added to favourites");
      } else {
        setFavMessage(json.error || "Failed to add to favourites");
      }
    } catch (e) {
      setFavMessage((e as Error).message || "Error saving favourite");
    } finally {
      setSavingFav(false);
      setTimeout(() => setFavMessage(null), 3000);
    }
  };

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#0a1929", position: "relative", paddingBottom: "80px" }}>
      <style dangerouslySetInnerHTML={{__html: `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; min-height: 100vh; background: #0a1929; }
        @keyframes floatTicket { 0%, 100% { transform: translateY(0px) rotate(-5deg); } 50% { transform: translateY(-30px) rotate(-8deg); } }
        @keyframes floatTicket2 { 0%, 100% { transform: translateY(0px) rotate(5deg); } 50% { transform: translateY(-40px) rotate(8deg); } }
        @keyframes floatTicket3 { 0%, 100% { transform: translateY(-20px) rotate(-3deg); } 50% { transform: translateY(-50px) rotate(-6deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) { .stop-fields { grid-template-columns: 1fr !important; } .stop-fields .swap-stops { justify-self: center; margin-bottom: 0 !important; transform: rotate(90deg); } }
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
          <Link href="/map" style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 24, padding: "14px 28px", background: "linear-gradient(135deg, #66bb6a 0%, #43a047 100%)", color: "#fff", borderRadius: 14, fontSize: 16, fontWeight: 700, textDecoration: "none", boxShadow: "0 6px 20px rgba(102, 187, 106, 0.4)" }}>
            <MapIcon size={20} />
            OPEN MAP
          </Link>
        </div>

        <div style={{ background: "rgba(255, 255, 255, 0.95)", borderRadius: 24, padding: 40, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", border: "2px solid rgba(66, 165, 245, 0.3)" }}>
          <div style={{ marginBottom: 28, padding: 24, background: "linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%)", borderRadius: 16, boxShadow: "0 8px 24px rgba(66, 165, 245, 0.4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <MapPin size={24} color="#fff" />
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Voice Search</div>
            </div>
            <div style={{ background: "rgba(255, 255, 255, 0.95)", borderRadius: 12, padding: 16 }}>
              <VoiceInput onTranscript={() => {}} onQuery={applyVoiceQuery} placeholder="Click the microphone and say e.g.: Centrum Wilanów" />
            </div>
            {voiceNote && <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: "#fff" }}>⚠️ {voiceNote}</div>}
          </div>

          <div className="stop-fields" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, marginBottom: 24, alignItems: "end" }}>
            <StopPicker label="FROM" placeholder="Departure stop, e.g. Centrum" value={from} onChange={setFrom} color="#1e88e5" onSubmit={findRoutes} />
            <button
              type="button"
              className="swap-stops"
              onClick={swapStops}
              disabled={!from || !to}
              aria-label="Swap departure and destination"
              title="Swap departure and destination"
              style={{ marginBottom: 6, width: 48, height: 48, borderRadius: 999, border: "3px solid #e3f2fd", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: !from || !to ? "default" : "pointer", opacity: !from || !to ? 0.4 : 1 }}
            >
              <ArrowLeftRight size={22} color="#42a5f5" strokeWidth={3} />
            </button>
            <StopPicker label="TO" placeholder="Destination stop, e.g. Wilanów" value={to} onChange={setTo} color="#43a047" onSubmit={findRoutes} />
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            {[{ label: "With transfer", checked: withTransfer, onChange: setWithTransfer }, { label: "Ignore time", checked: ignoreTime, onChange: setIgnoreTime }].map((opt, i) => (
              <label key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", background: opt.checked ? "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)" : "#f5f5f5", border: `3px solid ${opt.checked ? "#42a5f5" : "#e0e0e0"}`, borderRadius: 12, cursor: "pointer", fontSize: 15, fontWeight: 600, flex: 1, minWidth: 150 }}>
                <input type="checkbox" checked={opt.checked} onChange={(e) => opt.onChange(e.target.checked)} style={{ width: 20, height: 20, cursor: "pointer" }} />
                {opt.label}
              </label>
            ))}
          </div>

          <button onClick={findRoutes} disabled={loading} style={{ width: "100%", padding: "20px", background: "linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%)", color: "#fff", border: "none", borderRadius: 16, fontSize: 18, fontWeight: 700, cursor: loading ? "wait" : "pointer", boxShadow: "0 8px 24px rgba(66, 165, 245, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
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

        {searched && Array.isArray(pairRoutes) && (
          <div style={{ background: "rgba(255, 255, 255, 0.95)", borderRadius: 24, padding: 40, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", marginTop: 24, border: "2px solid rgba(66, 165, 245, 0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 240, fontSize: 20, fontWeight: 800, color: "#0d47a1", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <MapPin size={22} color="#1e88e5" />
                {searched.from.name}
                <span style={{ color: "#42a5f5" }}>→</span>
                <MapPin size={22} color="#43a047" />
                {searched.to.name}
              </div>
              <Link href={`/map?from=${searched.from.id}&to=${searched.to.id}`} style={{ padding: "14px 22px", background: "linear-gradient(135deg, #66bb6a 0%, #43a047 100%)", color: "#fff", borderRadius: 14, fontSize: 15, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
                <MapIcon size={18} />
                SHOW ON MAP
              </Link>
              <button onClick={addToFavorites} disabled={savingFav} style={{ padding: "14px 22px", background: savingFav ? "#bdbdbd" : "linear-gradient(135deg, #ffd54f 0%, #ffb300 100%)", color: savingFav ? "#757575" : "#f57f17", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: savingFav ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <Star size={18} fill={savingFav ? "none" : "#f57f17"} />
                {savingFav ? "SAVING..." : "FAVOURITE"}
              </button>
            </div>

            <LiveDepartures fromId={searched.from.id} toId={searched.to.id} />

            {Array.isArray(pairRoutes) && pairRoutes.length > 0 && (
              <div>
                <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 20, color: "#0d47a1", display: "flex", alignItems: "center", gap: 12 }}>
                  <Train size={28} color="#42a5f5" />
                  {searched.transfer ? "ROUTES WITH TRANSFER" : "DIRECT ROUTES"}
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {pairRoutes.map((r: any, idx: number) => (
                    <div key={idx} style={{ padding: 24, background: "linear-gradient(135deg, #fff9c4 0%, #fff59d 100%)", borderRadius: 16, border: "3px solid #fbc02d", boxShadow: "0 4px 12px rgba(251, 192, 45, 0.3)" }}>
                      {searched.transfer ? (
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
