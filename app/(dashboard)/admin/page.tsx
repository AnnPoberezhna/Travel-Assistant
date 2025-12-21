"use client";
import { useEffect, useState } from "react";
import { Shield, Users, Trash2, RefreshCw, AlertTriangle, User, Mail, Calendar, Crown } from "lucide-react";

type User = { id: number; email: string; username: string; role: "USER" | "ADMIN"; createdAt: string };

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

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
    
    setDeleting(id);
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
    } finally {
      setDeleting(null);
    }
  };

  const adminCount = users.filter(u => u.role === "ADMIN").length;

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "linear-gradient(135deg, #1a1a2e 0%, #0f0f1e 100%)", position: "relative", paddingBottom: "80px" }}>
      <style dangerouslySetInnerHTML={{__html: `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; min-height: 100vh; background: #1a1a2e; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes gridMove { 0% { background-position: 0 0; } 100% { background-position: 40px 40px; } }
        table { animation: slideIn 0.5s ease-out; }
        tr { transition: all 0.2s ease; }
        tr:hover { background: rgba(66, 165, 245, 0.05) !important; }
      `}} />

      {/* Animated Grid Background */}
      <div style={{ 
        position: "absolute", 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        backgroundImage: "linear-gradient(rgba(66, 165, 245, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(66, 165, 245, 0.03) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        animation: "gridMove 20s linear infinite",
        pointerEvents: "none"
      }} />

      {/* Floating Shield Icons */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", overflow: "hidden" }}>
        <Shield size={80} color="#42a5f5" style={{ position: "absolute", top: "5%", left: "5%", opacity: 0.08 }} />
        <Shield size={60} color="#5c6bc0" style={{ position: "absolute", top: "15%", right: "8%", opacity: 0.06 }} />
        <Shield size={70} color="#42a5f5" style={{ position: "absolute", bottom: "10%", right: "5%", opacity: 0.07 }} />
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 20px", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            <Shield size={48} color="#42a5f5" fill="rgba(66, 165, 245, 0.2)" style={{ animation: "pulse 2s ease-in-out infinite" }} />
            <h1 style={{ fontSize: 48, fontWeight: 900, margin: 0, background: "linear-gradient(135deg, #42a5f5 0%, #5c6bc0 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Admin Panel
            </h1>
          </div>
          <p style={{ fontSize: 18, color: "#90caf9", fontWeight: 500, marginLeft: 64 }}>User Management System</p>
        </div>

        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20, marginBottom: 32 }}>
          <div style={{ background: "linear-gradient(135deg, rgba(66, 165, 245, 0.15) 0%, rgba(66, 165, 245, 0.05) 100%)", border: "2px solid rgba(66, 165, 245, 0.3)", borderRadius: 16, padding: 24, backdropFilter: "blur(10px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <Users size={32} color="#42a5f5" />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#90caf9", textTransform: "uppercase", letterSpacing: "1px" }}>Total Users</div>
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "#fff" }}>{users.length}</div>
          </div>

          <div style={{ background: "linear-gradient(135deg, rgba(255, 213, 79, 0.15) 0%, rgba(255, 213, 79, 0.05) 100%)", border: "2px solid rgba(255, 213, 79, 0.3)", borderRadius: 16, padding: 24, backdropFilter: "blur(10px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <Crown size={32} color="#ffd54f" />
              <div style={{ fontSize: 14, fontWeight: 600, color: "#ffe082", textTransform: "uppercase", letterSpacing: "1px" }}>Administrators</div>
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "#fff" }}>{adminCount}</div>
          </div>
        </div>

        {/* Main Content Card */}
        <div style={{ background: "rgba(255, 255, 255, 0.98)", borderRadius: 24, padding: 40, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", border: "2px solid rgba(66, 165, 245, 0.2)" }}>
          
          {/* Actions Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, paddingBottom: 24, borderBottom: "2px solid #e3f2fd" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Users size={28} color="#1565c0" />
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "#1565c0", margin: 0 }}>User List</h2>
            </div>
            <button
              onClick={load}
              disabled={loading}
              style={{
                padding: "12px 24px",
                borderRadius: 12,
                background: loading ? "#bdbdbd" : "linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%)",
                color: "#fff",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: 15,
                fontWeight: 700,
                boxShadow: loading ? "none" : "0 4px 16px rgba(66, 165, 245, 0.4)",
                display: "flex",
                alignItems: "center",
                gap: 8
              }}
            >
              <RefreshCw size={18} style={{ animation: loading ? "pulse 1s ease-in-out infinite" : "none" }} />
              {loading ? "REFRESHING..." : "REFRESH"}
            </button>
          </div>

          {/* Loading State */}
          {loading && (
            <div style={{ padding: 60, textAlign: "center" }}>
              <Shield size={56} color="#42a5f5" style={{ animation: "pulse 1s ease-in-out infinite", marginBottom: 20 }} />
              <div style={{ fontSize: 20, color: "#42a5f5", fontWeight: 600 }}>Loading users...</div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div style={{ padding: 32, border: "3px solid #ef5350", borderRadius: 16, background: "#ffebee", display: "flex", alignItems: "center", gap: 16 }}>
              <AlertTriangle size={32} color="#c62828" />
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#c62828", marginBottom: 4 }}>Access Error</div>
                <div style={{ fontSize: 15, color: "#d32f2f" }}>{error}</div>
              </div>
            </div>
          )}

          {/* Users Table */}
          {!loading && !error && users.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr style={{ background: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)" }}>
                    <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 13, fontWeight: 800, color: "#0d47a1", textTransform: "uppercase", letterSpacing: "1px", borderTopLeftRadius: 12 }}>
                      ID
                    </th>
                    <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 13, fontWeight: 800, color: "#0d47a1", textTransform: "uppercase", letterSpacing: "1px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Mail size={14} />
                        Email
                      </div>
                    </th>
                    <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 13, fontWeight: 800, color: "#0d47a1", textTransform: "uppercase", letterSpacing: "1px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <User size={14} />
                        Username
                      </div>
                    </th>
                    <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 13, fontWeight: 800, color: "#0d47a1", textTransform: "uppercase", letterSpacing: "1px" }}>
                      Role
                    </th>
                    <th style={{ textAlign: "left", padding: "16px 20px", fontSize: 13, fontWeight: 800, color: "#0d47a1", textTransform: "uppercase", letterSpacing: "1px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Calendar size={14} />
                        Created
                      </div>
                    </th>
                    <th style={{ textAlign: "center", padding: "16px 20px", fontSize: 13, fontWeight: 800, color: "#0d47a1", textTransform: "uppercase", letterSpacing: "1px", borderTopRightRadius: 12 }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, idx) => (
                    <tr key={u.id} style={{ background: idx % 2 === 0 ? "#fafafa" : "#fff", borderBottom: "1px solid #e3f2fd" }}>
                      <td style={{ padding: "20px", fontSize: 15, fontWeight: 700, color: "#42a5f5" }}>
                        #{u.id}
                      </td>
                      <td style={{ padding: "20px", fontSize: 14, color: "#455a64", fontWeight: 500 }}>
                        {u.email}
                      </td>
                      <td style={{ padding: "20px", fontSize: 14, color: "#455a64", fontWeight: 600 }}>
                        {u.username}
                      </td>
                      <td style={{ padding: "20px" }}>
                        <span style={{
                          padding: "6px 14px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          background: u.role === "ADMIN" ? "linear-gradient(135deg, #ffd54f 0%, #ffb300 100%)" : "linear-gradient(135deg, #90caf9 0%, #64b5f6 100%)",
                          color: u.role === "ADMIN" ? "#f57f17" : "#0d47a1",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6
                        }}>
                          {u.role === "ADMIN" ? <Crown size={12} /> : <User size={12} />}
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: "20px", fontSize: 13, color: "#78909c" }}>
                        {new Date(u.createdAt).toLocaleDateString("en-US", { 
                          year: "numeric", 
                          month: "short", 
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </td>
                      <td style={{ padding: "20px", textAlign: "center" }}>
                        <button
                          onClick={() => removeUser(u.id)}
                          disabled={deleting === u.id}
                          style={{
                            padding: "10px 20px",
                            borderRadius: 10,
                            background: deleting === u.id ? "#bdbdbd" : "linear-gradient(135deg, #ef5350 0%, #d32f2f 100%)",
                            color: "#fff",
                            border: "none",
                            cursor: deleting === u.id ? "not-allowed" : "pointer",
                            fontSize: 13,
                            fontWeight: 700,
                            boxShadow: deleting === u.id ? "none" : "0 4px 12px rgba(239, 83, 80, 0.3)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px"
                          }}
                        >
                          <Trash2 size={14} />
                          {deleting === u.id ? "Deleting..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && users.length === 0 && (
            <div style={{ padding: 60, textAlign: "center" }}>
              <Users size={64} color="#bdbdbd" style={{ marginBottom: 20 }} />
              <div style={{ fontSize: 20, fontWeight: 600, color: "#9e9e9e", marginBottom: 8 }}>No users found</div>
              <div style={{ fontSize: 14, color: "#bdbdbd" }}>The database is empty</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
