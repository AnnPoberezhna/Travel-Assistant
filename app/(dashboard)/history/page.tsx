"use client";
import { useEffect, useState } from "react";
import { Clock, Search, MapPin, ArrowRight, Calendar, TrendingUp, History } from "lucide-react";

type HistoryItem = {
  id: number;
  userId: number | null;
  query: string;
  fromText: string | null;
  toText: string | null;
  resultsCount: number;
  createdAt: string;
};

export default function UserHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // fetch current session
        const sRes = await fetch("/api/auth/session", { cache: "no-store" });
        const session = sRes.ok ? await sRes.json() : null;
        const sidRaw = session?.user?.id;
        const sid = sidRaw !== undefined ? Number(sidRaw) : NaN;
        const email: string | undefined = session?.user?.email;
        const uname: string | undefined = (session?.user as any)?.name ?? (session?.user as any)?.username;

        if (!Number.isNaN(sid)) setUserId(sid);

        let hRes: Response | null = null;
        if (email) {
          hRes = await fetch(`/api/searchHistory?userEmail=${encodeURIComponent(email)}&limit=50`, { cache: "no-store" });
        } else if (!Number.isNaN(sid)) {
          hRes = await fetch(`/api/searchHistory?userId=${sid}&limit=50`, { cache: "no-store" });
        } else if (uname) {
          hRes = await fetch(`/api/searchHistory?username=${encodeURIComponent(uname)}&limit=50`, { cache: "no-store" });
        }

        if (hRes && hRes.ok) {
          const json = await hRes.json();
          setItems(Array.isArray(json.items) ? json.items : []);
        } else {
          setError("Nie udało się pobrać historii użytkownika (brak email/id/nazwy w sesji).");
        }
      } catch (e: any) {
        setError(String(e?.message ?? e));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#0a1929", position: "relative", paddingBottom: "80px" }}>
      <style dangerouslySetInnerHTML={{__html: `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; min-height: 100vh; background: #0a1929; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-15px); } }
        tr { transition: all 0.2s ease; animation: slideIn 0.3s ease-out; }
        tr:hover { background: rgba(102, 187, 106, 0.08) !important; transform: translateX(4px); }
      `}} />

      {/* Floating Clock Icons */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", overflow: "hidden" }}>
        <Clock size={70} color="#66bb6a" style={{ position: "absolute", top: "8%", left: "6%", opacity: 0.1, animation: "rotate 20s linear infinite" }} />
        <Clock size={55} color="#42a5f5" style={{ position: "absolute", top: "25%", right: "10%", opacity: 0.08, animation: "rotate 15s linear infinite reverse" }} />
        <History size={60} color="#66bb6a" style={{ position: "absolute", bottom: "20%", left: "8%", opacity: 0.12, animation: "float 8s ease-in-out infinite" }} />
        <Clock size={50} color="#42a5f5" style={{ position: "absolute", bottom: "15%", right: "12%", opacity: 0.09, animation: "rotate 18s linear infinite" }} />
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <Clock size={52} color="#66bb6a" style={{ animation: "pulse 2s ease-in-out infinite" }} />
            <h1 style={{ fontSize: 52, fontWeight: 900, margin: 0, background: "linear-gradient(135deg, #66bb6a 0%, #42a5f5 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Search History
            </h1>
            <History size={52} color="#42a5f5" style={{ animation: "pulse 2s ease-in-out infinite 1s" }} />
          </div>
          <p style={{ fontSize: 18, color: "#a5d6a7", fontWeight: 500 }}>Your Recent Journey Searches</p>
        </div>

        {/* Stats Card */}
        {!loading && !error && items.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 32 }}>
            <div style={{ background: "linear-gradient(135deg, rgba(102, 187, 106, 0.15) 0%, rgba(102, 187, 106, 0.05) 100%)", border: "2px solid rgba(102, 187, 106, 0.3)", borderRadius: 16, padding: 24, backdropFilter: "blur(10px)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <TrendingUp size={32} color="#66bb6a" />
                <div style={{ fontSize: 14, fontWeight: 600, color: "#a5d6a7", textTransform: "uppercase", letterSpacing: "1px" }}>Total Searches</div>
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#fff" }}>{items.length}</div>
            </div>

            <div style={{ background: "linear-gradient(135deg, rgba(66, 165, 245, 0.15) 0%, rgba(66, 165, 245, 0.05) 100%)", border: "2px solid rgba(66, 165, 245, 0.3)", borderRadius: 16, padding: 24, backdropFilter: "blur(10px)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <Search size={32} color="#42a5f5" />
                <div style={{ fontSize: 14, fontWeight: 600, color: "#90caf9", textTransform: "uppercase", letterSpacing: "1px" }}>Total Results</div>
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, color: "#fff" }}>
                {items.reduce((sum, it) => sum + it.resultsCount, 0)}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Card */}
        <div style={{ background: "rgba(255, 255, 255, 0.98)", borderRadius: 24, padding: 40, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", border: "2px solid rgba(102, 187, 106, 0.3)" }}>
          
          {/* Loading State */}
          {loading && (
            <div style={{ padding: 60, textAlign: "center" }}>
              <Clock size={56} color="#66bb6a" style={{ animation: "rotate 2s linear infinite", marginBottom: 20 }} />
              <div style={{ fontSize: 20, color: "#66bb6a", fontWeight: 600 }}>Loading your search history...</div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div style={{ padding: 32, border: "3px solid #ef5350", borderRadius: 16, background: "#ffebee", display: "flex", alignItems: "center", gap: 16 }}>
              <Search size={32} color="#c62828" />
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#c62828", marginBottom: 4 }}>Error Loading History</div>
                <div style={{ fontSize: 15, color: "#d32f2f" }}>{error}</div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && items.length === 0 && (
            <div style={{ padding: 80, textAlign: "center" }}>
              <div style={{ marginBottom: 24 }}>
                <History size={80} color="#e0e0e0" />
              </div>
              <p style={{ fontSize: 24, fontWeight: 700, color: "#90a4ae", marginBottom: 12 }}>No search history yet</p>
              <p style={{ fontSize: 16, color: "#b0bec5", marginBottom: 32 }}>Start searching for routes to build your history</p>
              <button
                onClick={() => window.location.href = "/"}
                style={{
                  padding: "16px 32px",
                  borderRadius: 14,
                  background: "linear-gradient(135deg, #66bb6a 0%, #43a047 100%)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 16,
                  fontWeight: 700,
                  boxShadow: "0 6px 20px rgba(102, 187, 106, 0.4)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10
                }}
              >
                <Search size={20} />
                START SEARCHING
              </button>
            </div>
          )}

          {/* History Table */}
          {!loading && !error && items.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28, paddingBottom: 20, borderBottom: "2px solid #e8f5e9" }}>
                <History size={28} color="#2e7d32" />
                <h2 style={{ fontSize: 24, fontWeight: 800, color: "#2e7d32", margin: 0 }}>Recent Searches</h2>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                  <thead>
                    <tr style={{ background: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)" }}>
                      <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 13, fontWeight: 800, color: "#1b5e20", textTransform: "uppercase", letterSpacing: "1px", borderTopLeftRadius: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Search size={14} />
                          Query
                        </div>
                      </th>
                      <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 13, fontWeight: 800, color: "#1b5e20", textTransform: "uppercase", letterSpacing: "1px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <MapPin size={14} />
                          Route
                        </div>
                      </th>
                      <th style={{ textAlign: "center", padding: "16px 20px", fontSize: 13, fontWeight: 800, color: "#1b5e20", textTransform: "uppercase", letterSpacing: "1px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <TrendingUp size={14} />
                          Results
                        </div>
                      </th>
                      <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 13, fontWeight: 800, color: "#1b5e20", textTransform: "uppercase", letterSpacing: "1px", borderTopRightRadius: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Calendar size={14} />
                          Date
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={it.id} style={{ background: idx % 2 === 0 ? "#fafafa" : "#fff", borderBottom: "1px solid #e8f5e9" }}>
                        <td style={{ padding: "20px", fontSize: 15, color: "#2e7d32", fontWeight: 600 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Search size={16} color="#66bb6a" />
                            {it.query}
                          </div>
                        </td>
                        <td style={{ padding: "20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#455a64" }}>
                            <span style={{ fontWeight: 600, color: "#42a5f5" }}>{it.fromText ?? "?"}</span>
                            <ArrowRight size={16} color="#66bb6a" strokeWidth={3} />
                            <span style={{ fontWeight: 600, color: "#66bb6a" }}>{it.toText ?? "?"}</span>
                          </div>
                        </td>
                        <td style={{ padding: "20px", textAlign: "center" }}>
                          <span style={{
                            padding: "6px 16px",
                            borderRadius: 20,
                            fontSize: 13,
                            fontWeight: 800,
                            background: it.resultsCount > 0 ? "linear-gradient(135deg, #c8e6c9 0%, #a5d6a7 100%)" : "linear-gradient(135deg, #ffcdd2 0%, #ef9a9a 100%)",
                            color: it.resultsCount > 0 ? "#1b5e20" : "#b71c1c",
                            display: "inline-block"
                          }}>
                            {it.resultsCount}
                          </span>
                        </td>
                        <td style={{ padding: "20px", fontSize: 13, color: "#78909c", fontWeight: 500 }}>
                          {new Date(it.createdAt).toLocaleDateString("en-US", { 
                            year: "numeric", 
                            month: "short", 
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
