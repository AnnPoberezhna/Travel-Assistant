"use client";
import { useEffect, useState } from "react";

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
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 20 }}>
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>Twoja historia wyszukiwań</h1>
      {loading && <div>Ładowanie…</div>}
      {error && <div style={{ color: "#b91c1c", marginBottom: 8 }}>Błąd: {error}</div>}
      {!loading && !error && items.length === 0 && (
        <div style={{ color: "#6b7280" }}>Brak wpisów historii dla użytkownika.</div>
      )}
      {items.length > 0 && (
        <div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Zapytanie</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Od → Do</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Wyników</th>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Data</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{it.query}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                    {(it.fromText ?? "?")} → {(it.toText ?? "?")}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{it.resultsCount}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                    {new Date(it.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
