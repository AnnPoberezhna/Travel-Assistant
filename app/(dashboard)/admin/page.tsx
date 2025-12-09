"use client";
import { useEffect, useState } from "react";

type User = { id: number; email: string; username: string; role: "USER" | "ADMIN"; createdAt: string };

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) {
        setUsers(Array.isArray(json.users) ? json.users : []);
      } else {
        setError(json?.error ?? "Unauthorized");
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const removeUser = async (id: number) => {
    const user = users.find(u => u.id === id);
    const label = user ? `${user.username} (${user.email})` : `#${id}`;
    if (!confirm(`Na pewno usunąć użytkownika ${label}?`)) return;
    try {
      const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== id));
      } else {
        alert(json?.error ?? "Delete failed");
      }
    } catch (e: any) {
      alert(String(e?.message ?? e));
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 20 }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Admin: Użytkownicy</h1>
      {loading && <div>Ładowanie…</div>}
      {error && <div style={{ color: "#b91c1c" }}>Błąd: {error}</div>}
      {!loading && !error && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>ID</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Email</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Username</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Rola</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Założony</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{u.id}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{u.email}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{u.username}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{u.role}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>{new Date(u.createdAt).toLocaleString()}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #f3f4f6" }}>
                  <button onClick={() => removeUser(u.id)} style={{ padding: "6px 10px", borderRadius: 6, background: "#b91c1c", color: "#fff", border: "none", cursor: "pointer" }}>Usuń</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
