"use client";

// "Next departures" card for a pair of stops: real departure times from the Warsaw API timetable
// for the lines that go directly from one stop to the other (see app/lib/liveRoutes.ts).
// Renders nothing for stops outside Warsaw or when no line connects them directly.

import { useEffect, useState } from "react";
import { Bus, Clock, TrainFront, TramFront } from "lucide-react";
import type { LiveDeparture } from "@/app/lib/liveRoutes";

type LiveResponse =
  | { available: false }
  | { available: true; lines: string[]; departures: LiveDeparture[]; fetchedAt: string };

const REFRESH_MS = 60_000;

const TYPE_STYLE: Record<LiveDeparture["type"], { color: string; icon: typeof Bus; label: string }> = {
  BUS: { color: "#1e88e5", icon: Bus, label: "Bus" },
  TRAM: { color: "#e53935", icon: TramFront, label: "Tram" },
  RAIL: { color: "#6d4c41", icon: TrainFront, label: "Train" },
  OTHER: { color: "#546e7a", icon: Bus, label: "Line" },
};

const formatWait = (minutes: number) => (minutes <= 0 ? "now" : minutes < 60 ? `in ${minutes} min` : `in ${Math.floor(minutes / 60)} h ${minutes % 60} min`);

export default function LiveDepartures({ fromId, toId }: { fromId: number | null; toId: number | null }) {
  const [data, setData] = useState<{ key: string; response: LiveResponse } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const key = fromId && toId ? `${fromId}-${toId}` : null;

  useEffect(() => {
    if (!fromId || !toId) return;
    const requestKey = `${fromId}-${toId}`;
    const controller = new AbortController();

    const load = async () => {
      try {
        const res = await fetch(`/api/routeSearch/live?startId=${fromId}&endId=${toId}`, { signal: controller.signal, cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
        setData({ key: requestKey, response: json });
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError({ key: requestKey, message: (e as Error).message });
      }
    };

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [fromId, toId]);

  if (!key) return null;
  const response = data?.key === key ? data.response : null;
  const errorMessage = error?.key === key ? error.message : null;

  // Not a Warsaw stop, or no direct line between the stops: nothing to show
  if (!errorMessage && response && (!response.available || response.lines.length === 0)) return null;

  return (
    <div style={{ marginBottom: 32, padding: 24, borderRadius: 16, border: "3px solid #66bb6a", background: "linear-gradient(135deg, #f1f8e9 0%, #e8f5e9 100%)" }}>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes liveDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }` }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: "#2e7d32", color: "#fff", fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#b9f6ca", animation: "liveDot 1.6s ease-in-out infinite" }} />
          LIVE
        </span>
        <h3 style={{ fontSize: 22, fontWeight: 800, color: "#1b5e20", margin: 0 }}>NEXT DEPARTURES</h3>
      </div>
      <p style={{ fontSize: 13, color: "#558b2f", marginBottom: 16 }}>
        Today&apos;s timetable from the City of Warsaw
        {response?.available && ` · updated ${new Date(response.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
      </p>

      {!response && !errorMessage && <div style={{ color: "#558b2f", fontWeight: 600 }}>Checking live departures…</div>}

      {errorMessage && <div style={{ color: "#c62828", fontWeight: 600 }}>⚠️ Couldn&apos;t load live departures: {errorMessage}</div>}

      {response?.available && response.departures.length === 0 && (
        <div style={{ color: "#33691e", fontWeight: 600 }}>
          No more direct departures on {response.lines.join(", ")} in the next hours.
        </div>
      )}

      {response?.available && response.departures.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {response.departures.map((d) => {
            const type = TYPE_STYLE[d.type] ?? TYPE_STYLE.OTHER;
            const Icon = type.icon;
            return (
              <div
                key={`${d.line}-${d.brigade}-${d.departureTime}`}
                style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "14px 16px", borderRadius: 12, background: "#fff", border: "2px solid #c8e6c9" }}
              >
                <span
                  title={type.label}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 74, justifyContent: "center", padding: "6px 10px", borderRadius: 10, background: type.color, color: "#fff", fontWeight: 800, fontSize: 16 }}
                >
                  <Icon size={16} />
                  {d.line}
                </span>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontWeight: 700, color: "#263238", fontSize: 15 }}>→ {d.direction}</div>
                  <div style={{ fontSize: 13, color: "#607d8b" }}>
                    arrives ~{d.arrivalTime} · {d.rideMinutes} min ride
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#1b5e20", display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                    <Clock size={16} />
                    {d.departureTime}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: d.minutesFromNow <= 5 ? "#e65100" : "#558b2f" }}>{formatWait(d.minutesFromNow)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 12, color: "#689f38", marginTop: 14, lineHeight: 1.5 }}>
        Arrival times are estimated from the usual ride time. The list below shows example trips from the imported timetable.
      </p>
    </div>
  );
}
