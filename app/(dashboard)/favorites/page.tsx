"use client";
import { useEffect, useState } from "react";
import { Star, Trash2, Search, MapPin, ArrowRight, Train } from "lucide-react";

interface FavoriteRoute {
  id: number;
  uzytkownikId: number;
  przystanekStartId: number;
  przystanekKoniecId: number;
  createdAt: string;
  przystanekStart: {
    id: number;
    nazwa: string;
    adres?: string;
  };
  przystanekKoniec: {
    id: number;
    nazwa: string;
    adres?: string;
  };
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const loadFavorites = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/favoriteRoutes");
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to load favorites");
      }
      const data = await res.json();
      setFavorites(data);
    } catch (e: any) {
      setError(e.message || "Error loading favorites");
    } finally {
      setLoading(false);
    }
  };

  const deleteFavorite = async (id: number) => {
    if (!confirm("Remove this route from favorites?")) return;
    
    setDeleting(id);
    try {
      const res = await fetch(`/api/favoriteRoutes?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to delete");
      }
      await loadFavorites();
    } catch (e: any) {
      alert(e.message || "Error deleting favorite");
    } finally {
      setDeleting(null);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#0a1929", position: "relative", paddingBottom: "80px" }}>
      <style dangerouslySetInnerHTML={{__html: `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; min-height: 100vh; background: #0a1929; }
        @keyframes floatStar { 0%, 100% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-20px) rotate(180deg); } }
        @keyframes floatStar2 { 0%, 100% { transform: translateY(-10px) rotate(0deg); } 50% { transform: translateY(-35px) rotate(-180deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.1); } }
        @keyframes shimmer { 0% { background-position: -100% 0; } 100% { background-position: 200% 0; } }
      `}} />

      {/* Floating Stars Background */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", overflow: "hidden" }}>
        <Star size={60} fill="#ffd54f" color="#ffd54f" style={{ position: "absolute", top: "8%", left: "10%", opacity: 0.15, animation: "floatStar 15s ease-in-out infinite" }} />
        <Star size={45} fill="#ffb300" color="#ffb300" style={{ position: "absolute", top: "20%", right: "15%", opacity: 0.12, animation: "floatStar2 18s ease-in-out infinite", animationDelay: "2s" }} />
        <Star size={55} fill="#ffd54f" color="#ffd54f" style={{ position: "absolute", bottom: "25%", left: "8%", opacity: 0.18, animation: "floatStar 20s ease-in-out infinite", animationDelay: "4s" }} />
        <Star size={50} fill="#ffb300" color="#ffb300" style={{ position: "absolute", bottom: "15%", right: "12%", opacity: 0.14, animation: "floatStar2 17s ease-in-out infinite", animationDelay: "6s" }} />
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <Star size={52} fill="#ffd54f" color="#ffd54f" style={{ animation: "pulse 2s ease-in-out infinite" }} />
            <h1 style={{ fontSize: 52, fontWeight: 900, margin: 0, background: "linear-gradient(135deg, #ffd54f 0%, #ffb300 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Favourite Routes
            </h1>
            <Star size={52} fill="#ffd54f" color="#ffd54f" style={{ animation: "pulse 2s ease-in-out infinite 1s" }} />
          </div>
          <p style={{ fontSize: 18, color: "#ffe082", fontWeight: 500 }}>Your Saved Journeys</p>
        </div>

        {/* Main Content Card */}
        <div style={{ background: "rgba(255, 255, 255, 0.95)", borderRadius: 24, padding: 40, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", border: "2px solid rgba(255, 213, 79, 0.4)" }}>
          
          {/* Refresh Button */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
            <button
              onClick={loadFavorites}
              disabled={loading}
              style={{
                padding: "14px 28px",
                borderRadius: 14,
                background: loading ? "#bdbdbd" : "linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%)",
                color: "#fff",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: 15,
                fontWeight: 700,
                boxShadow: loading ? "none" : "0 6px 20px rgba(66, 165, 245, 0.4)",
                display: "flex",
                alignItems: "center",
                gap: 10
              }}
            >
              <Train size={18} style={{ animation: loading ? "pulse 1s ease-in-out infinite" : "none" }} />
              {loading ? "REFRESHING..." : "REFRESH"}
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div style={{ padding: 60, textAlign: "center" }}>
              <Train size={56} color="#42a5f5" style={{ animation: "pulse 1s ease-in-out infinite", marginBottom: 20 }} />
              <div style={{ fontSize: 20, color: "#42a5f5", fontWeight: 600 }}>Loading your favorites...</div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div style={{ padding: 32, border: "3px solid #ef5350", borderRadius: 16, background: "#ffebee", color: "#c62828", fontSize: 16, fontWeight: 600, textAlign: "center" }}>
              <strong>⚠️ Error:</strong> {error}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && favorites.length === 0 && (
            <div style={{ padding: 80, textAlign: "center" }}>
              <div style={{ marginBottom: 24 }}>
                <Star size={80} color="#e0e0e0" fill="#f5f5f5" />
              </div>
              <p style={{ fontSize: 24, fontWeight: 700, color: "#90a4ae", marginBottom: 12 }}>No favourite routes yet</p>
              <p style={{ fontSize: 16, color: "#b0bec5", marginBottom: 32 }}>Start adding routes to build your collection</p>
              <button
                onClick={() => window.location.href = "/"}
                style={{
                  padding: "16px 32px",
                  borderRadius: 14,
                  background: "linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 16,
                  fontWeight: 700,
                  boxShadow: "0 6px 20px rgba(66, 165, 245, 0.4)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10
                }}
              >
                <Search size={20} />
                GO TO SEARCH
              </button>
            </div>
          )}

          {/* Favorites List */}
          {!loading && favorites.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {favorites.map((fav) => (
                <div
                  key={fav.id}
                  style={{
                    border: "3px solid #ffd54f",
                    borderRadius: 20,
                    padding: 28,
                    background: "linear-gradient(135deg, #fffbf0 0%, #fff9e6 100%)",
                    boxShadow: "0 8px 24px rgba(255, 213, 79, 0.2)",
                    position: "relative",
                    overflow: "hidden"
                  }}
                >
                  {/* Decorative corner star */}
                  <Star 
                    size={80} 
                    fill="#ffd54f" 
                    color="#ffd54f" 
                    style={{ 
                      position: "absolute", 
                      top: -20, 
                      right: -20, 
                      opacity: 0.15,
                      transform: "rotate(15deg)"
                    }} 
                  />
                  
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                          <MapPin size={24} color="#f57f17" fill="#ffd54f" />
                          <div style={{ fontSize: 22, fontWeight: 800, color: "#f57f17" }}>
                            {fav.przystanekStart.nazwa}
                          </div>
                        </div>
                        
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: 36, marginBottom: 12 }}>
                          <ArrowRight size={28} color="#ffb300" strokeWidth={3} />
                        </div>
                        
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                          <MapPin size={24} color="#f57f17" fill="#ffd54f" />
                          <div style={{ fontSize: 22, fontWeight: 800, color: "#f57f17" }}>
                            {fav.przystanekKoniec.nazwa}
                          </div>
                        </div>

                        {(fav.przystanekStart.adres || fav.przystanekKoniec.adres) && (
                          <div style={{ fontSize: 14, color: "#f57f17", opacity: 0.8, marginLeft: 36, lineHeight: 1.6 }}>
                            {fav.przystanekStart.adres && <div>📍 From: {fav.przystanekStart.adres}</div>}
                            {fav.przystanekKoniec.adres && <div>📍 To: {fav.przystanekKoniec.adres}</div>}
                          </div>
                        )}
                        
                        <div style={{ fontSize: 13, color: "#ff6f00", fontWeight: 600, marginTop: 12, marginLeft: 36, display: "flex", alignItems: "center", gap: 6 }}>
                          <Star size={14} fill="#ff6f00" />
                          Added: {new Date(fav.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                      <button
                        onClick={() => {
                          window.location.href = `/search?from=${fav.przystanekStartId}&to=${fav.przystanekKoniecId}`;
                        }}
                        style={{
                          padding: "14px 28px",
                          borderRadius: 12,
                          background: "linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%)",
                          color: "#fff",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 15,
                          fontWeight: 700,
                          boxShadow: "0 4px 16px rgba(66, 165, 245, 0.4)",
                          display: "flex",
                          alignItems: "center",
                          gap: 8
                        }}
                      >
                        <Search size={18} />
                        SEARCH ROUTE
                      </button>
                      <button
                        onClick={() => deleteFavorite(fav.id)}
                        disabled={deleting === fav.id}
                        style={{
                          padding: "14px 28px",
                          borderRadius: 12,
                          background: deleting === fav.id ? "#bdbdbd" : "linear-gradient(135deg, #ef5350 0%, #d32f2f 100%)",
                          color: "#fff",
                          border: "none",
                          cursor: deleting === fav.id ? "not-allowed" : "pointer",
                          fontSize: 15,
                          fontWeight: 700,
                          boxShadow: deleting === fav.id ? "none" : "0 4px 16px rgba(239, 83, 80, 0.4)",
                          display: "flex",
                          alignItems: "center",
                          gap: 8
                        }}
                      >
                        <Trash2 size={18} />
                        {deleting === fav.id ? "REMOVING..." : "REMOVE"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
