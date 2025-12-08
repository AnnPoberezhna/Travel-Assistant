"use client";
import { useEffect, useState } from "react";

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
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 32, margin: 0 }}>Favourite Routes</h1>
        <button
          onClick={loadFavorites}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: "#0f172a",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {loading && <div>Loading your favorites...</div>}
      {error && <div style={{ color: "#b91c1c" }}>Error: {error}</div>}

      {!loading && !error && favorites.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>No favourite routes yet</p>
          <p>Go to the search page and add some routes to your favorites</p>
        </div>
      )}

      {!loading && favorites.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {favorites.map((fav) => (
            <div
              key={fav.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#fff",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>
                  {fav.przystanekStart.nazwa} → {fav.przystanekKoniec.nazwa}
                </div>
                <div style={{ fontSize: 14, color: "#64748b" }}>
                  {fav.przystanekStart.adres && `${fav.przystanekStart.adres} `}
                  to{" "}
                  {fav.przystanekKoniec.adres && `${fav.przystanekKoniec.adres}`}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                  Added: {new Date(fav.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    window.location.href = `/search?from=${fav.przystanekStartId}&to=${fav.przystanekKoniecId}`;
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "#10b981",
                    color: "#fff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Search
                </button>
                <button
                  onClick={() => deleteFavorite(fav.id)}
                  disabled={deleting === fav.id}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: deleting === fav.id ? "#94a3b8" : "#dc2626",
                    color: "#fff",
                    border: "none",
                    cursor: deleting === fav.id ? "not-allowed" : "pointer",
                  }}
                >
                  {deleting === fav.id ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
