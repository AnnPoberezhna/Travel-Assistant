"use client";
import dynamic from "next/dynamic";
import { Map as MapIcon } from "lucide-react";

// Height of the fixed navbar (app/components/Navbar.tsx), so the map starts right below it
const NAVBAR_HEIGHT = 45;

// Leaflet uses `window`, so the map is rendered only in the browser
const TransitMap = dynamic(() => import("@/app/components/map/TransitMap"), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <MapIcon size={48} color="#42a5f5" style={{ animation: "pulse 1s ease-in-out infinite" }} />
      <div style={{ fontSize: 20, color: "#42a5f5", fontWeight: 600 }}>Loading map...</div>
    </div>
  ),
});

export default function MapPage() {
  return (
    <div style={{ height: "100vh", width: "100%", paddingTop: NAVBAR_HEIGHT, background: "#0a1929", display: "flex", flexDirection: "column" }}>
      <style dangerouslySetInnerHTML={{__html: `
        html, body { width: 100%; height: 100%; background: #0a1929; overflow: hidden; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}} />
      <TransitMap />
    </div>
  );
}
