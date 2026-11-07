"use client";

// Interactive Leaflet map: stops from our database, live Warsaw buses and trams,
// and picking a start/destination stop to plan a route on the search page.
// Leaflet needs `window`, so this component is loaded with ssr: false (see app/(dashboard)/map/page.tsx).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import L from "leaflet";
import { Circle, CircleMarker, MapContainer, Marker, Pane, Popup, TileLayer, ZoomControl } from "react-leaflet";
import { Bus, ChevronDown, ChevronUp, LocateFixed, MapPin, RefreshCw, Route, TramFront, X } from "lucide-react";
import type { Vehicle, VehicleType } from "@/app/lib/warsawApi";
import "leaflet/dist/leaflet.css";
import "./map.css";

type Stop = { id: number; name: string; address: string | null; lat: number; lon: number };
type MapView = { zoom: number; bounds: L.LatLngBounds };
type MyLocation = { lat: number; lon: number; accuracy: number };
type RouteCheck =
  | { status: "checking" }
  | { status: "found"; transfers: boolean; count: number }
  | { status: "none" }
  | { status: "error"; message: string };

const WARSAW_CENTER: L.LatLngTuple = [52.2297, 21.0122];
const DEFAULT_ZOOM = 12;
const VEHICLE_REFRESH_MS = 15_000;
// Vehicles are drawn as badges with the line number from this zoom level on,
// or at any zoom when only a few of them are shown (e.g. after filtering by line).
// Otherwise they are small dots drawn on a canvas, which stays fast with ~2000 vehicles.
const BADGE_ZOOM = 15;
const MAX_BADGES = 150;
// Max stops drawn for the visible area. When more stops are there (e.g. all of Warsaw at zoom 12)
// none are drawn and the panel asks to zoom in – a random subset would be misleading.
const STOPS_LIMIT = 2500;

const STOP_COLOR = "#0a1929";
const VEHICLE_COLOR: Record<VehicleType, string> = { bus: "#1e88e5", tram: "#e53935" };
const VEHICLE_LABEL: Record<VehicleType, string> = { bus: "Bus", tram: "Tram" };

// Shared style objects, so react-leaflet doesn't restyle every marker on each render.
const VEHICLE_DOT_STYLE: Record<VehicleType, L.PathOptions> = {
  bus: { color: "#fff", weight: 1, fillColor: VEHICLE_COLOR.bus, fillOpacity: 1 },
  tram: { color: "#fff", weight: 1, fillColor: VEHICLE_COLOR.tram, fillOpacity: 1 },
};
const STOP_STYLE: L.PathOptions = { color: STOP_COLOR, weight: 2, fillColor: "#fff", fillOpacity: 1 };
// After a start stop is chosen: stops with a direct connection from it, and all the others
const STOP_REACHABLE_STYLE: L.PathOptions = { color: "#2e7d32", weight: 3, fillColor: "#a5d6a7", fillOpacity: 1 };
const STOP_DIMMED_STYLE: L.PathOptions = { color: STOP_COLOR, weight: 2, opacity: 0.35, fillColor: "#fff", fillOpacity: 0.5 };
const ACCURACY_STYLE: L.PathOptions = { color: "#42a5f5", weight: 1, fillColor: "#42a5f5", fillOpacity: 0.12 };

const STOP_PIN: Record<"from" | "to", L.DivIcon> = {
  from: L.divIcon({ className: "stop-pin stop-pin--from", html: "A", iconSize: [26, 26], iconAnchor: [13, 13] }),
  to: L.divIcon({ className: "stop-pin stop-pin--to", html: "B", iconSize: [26, 26], iconAnchor: [13, 13] }),
};
const MY_LOCATION_ICON = L.divIcon({ className: "my-location-dot", iconSize: [18, 18], iconAnchor: [9, 9] });

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const vehicleKey = (v: Vehicle) => `${v.type}-${v.vehicleNumber}`;

// "523, 17 n01" -> ["523", "17", "N01"]
const parseLines = (text: string) =>
  text.split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);

const badgeIcons = new Map<string, L.DivIcon>();
function vehicleBadgeIcon(type: VehicleType, line: string): L.DivIcon {
  const key = `${type}:${line}`;
  let icon = badgeIcons.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: `vehicle-badge vehicle-badge--${type}`,
      html: escapeHtml(line),
      iconSize: [36, 20],
      iconAnchor: [18, 10],
    });
    badgeIcons.set(key, icon);
  }
  return icon;
}

function vehiclePopupHtml(v: Vehicle): string {
  return `<div class="map-popup">
    <div class="map-popup__title"><span class="map-popup__chip map-popup__chip--${v.type}">${VEHICLE_LABEL[v.type]} ${escapeHtml(v.line)}</span></div>
    <div class="map-popup__meta">Brigade ${escapeHtml(v.brigade)} · Vehicle ${escapeHtml(v.vehicleNumber)}</div>
    <div class="map-popup__meta">Last GPS update: ${formatTime(v.time)}</div>
  </div>`;
}

export default function TransitMap() {
  const router = useRouter();
  const [map, setMap] = useState<L.Map | null>(null);
  const [view, setView] = useState<MapView | null>(null);
  const [panelOpen, setPanelOpen] = useState(() => !window.matchMedia("(max-width: 640px)").matches);

  // Layers and filters
  const [showStops, setShowStops] = useState(true);
  const [showBuses, setShowBuses] = useState(true);
  const [showTrams, setShowTrams] = useState(true);
  const [lineInput, setLineInput] = useState("");
  const [lineFilter, setLineFilter] = useState("");

  // Stops from our database
  const [stops, setStops] = useState<Stop[]>([]);
  const [stopsTruncated, setStopsTruncated] = useState(false);
  const [stopsError, setStopsError] = useState<string | null>(null);
  const loadedStopsArea = useRef<{ bounds: L.LatLngBounds; truncated: boolean } | null>(null);

  // Live vehicles from the Warsaw API
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesFetchedAt, setVehiclesFetchedAt] = useState<string | null>(null);
  const [vehiclesError, setVehiclesError] = useState<string | null>(null);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const vehiclePopup = useRef<L.Popup | null>(null);
  const selectedVehicle = useRef<string | null>(null);

  // Route planning and location
  const [from, setFrom] = useState<Stop | null>(null);
  const [to, setTo] = useState<Stop | null>(null);
  const [reachable, setReachable] = useState<{ from: number; stops: Stop[]; ids: Set<number> } | null>(null);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [routeCheck, setRouteCheck] = useState<{ key: string; result: RouteCheck } | null>(null);
  const [myLocation, setMyLocation] = useState<MyLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Keep track of the visible area and zoom level
  useEffect(() => {
    if (!map) return;
    const update = () => setView({ zoom: map.getZoom(), bounds: map.getBounds() });
    update();
    map.on("moveend", update);
    return () => {
      map.off("moveend", update);
    };
  }, [map]);

  // Apply the line filter shortly after the user stops typing
  useEffect(() => {
    const timer = setTimeout(() => setLineFilter(lineInput), 400);
    return () => clearTimeout(timer);
  }, [lineInput]);

  // Load stops for the visible area (with a margin), unless that area is already loaded
  useEffect(() => {
    if (!showStops || !view) return;
    const loaded = loadedStopsArea.current;
    if (loaded && !loaded.truncated && loaded.bounds.contains(view.bounds)) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const area = view.bounds.pad(0.25);
      const bbox = [area.getWest(), area.getSouth(), area.getEast(), area.getNorth()].map((n) => n.toFixed(5)).join(",");
      try {
        const res = await fetch(`/api/stops?bbox=${bbox}&limit=${STOPS_LIMIT}`, { signal: controller.signal });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
        const truncated = Boolean(json.truncated);
        loadedStopsArea.current = { bounds: area, truncated };
        setStops(truncated ? [] : (json.stops ?? []));
        setStopsTruncated(truncated);
        setStopsError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStopsError((e as Error).message);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [showStops, view]);

  // Poll live vehicle positions while buses or trams are shown and the tab is visible
  const vehiclesEnabled = showBuses || showTrams;
  useEffect(() => {
    if (!vehiclesEnabled) return;
    let cancelled = false;
    let requestId = 0;
    const controller = new AbortController();

    const load = async () => {
      if (document.hidden) return;
      const id = ++requestId;
      setVehiclesLoading(true);
      try {
        const res = await fetch("/api/vehicles", { signal: controller.signal, cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
        if (cancelled || id !== requestId) return;
        setVehicles(json.vehicles ?? []);
        setVehiclesFetchedAt(json.fetchedAt ?? new Date().toISOString());
        setVehiclesError(null);
      } catch (e) {
        if (cancelled || id !== requestId || (e as Error).name === "AbortError") return;
        setVehiclesError((e as Error).message);
      } finally {
        if (!cancelled && id === requestId) setVehiclesLoading(false);
      }
    };

    load();
    const timer = setInterval(load, VEHICLE_REFRESH_MS);
    const onVisibilityChange = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [vehiclesEnabled, refreshTick]);

  // After choosing a start stop, find out which stops have a direct connection from it
  useEffect(() => {
    if (!from) return;
    const controller = new AbortController();
    fetch(`/api/stops/reachable?from=${from.id}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
        const reachableStops: Stop[] = json.stops ?? [];
        setReachable({ from: from.id, stops: reachableStops, ids: new Set(reachableStops.map((s) => s.id)) });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") console.error("Failed to load reachable stops:", e);
      });
    return () => controller.abort();
  }, [from]);

  // When both stops are chosen, check if the search will find anything (direct first, then with one transfer).
  // Uses the same request as the search page, which ignores the time for searches opened from a link.
  useEffect(() => {
    if (!from || !to) return;
    const key = `${from.id}-${to.id}`;
    const controller = new AbortController();

    const countRoutes = async (transfers: boolean) => {
      const params = new URLSearchParams({ startId: String(from.id), endId: String(to.id), ignoreTime: "1" });
      if (transfers) params.set("transfers", "1");
      const res = await fetch(`/api/routeSearch/find?${params}`, { signal: controller.signal });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      return Array.isArray(json?.results) ? json.results.length : 0;
    };

    (async () => {
      try {
        const direct = await countRoutes(false);
        if (direct > 0) {
          setRouteCheck({ key, result: { status: "found", transfers: false, count: direct } });
          return;
        }
        const withTransfer = await countRoutes(true);
        setRouteCheck({
          key,
          result: withTransfer > 0 ? { status: "found", transfers: true, count: withTransfer } : { status: "none" },
        });
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setRouteCheck({ key, result: { status: "error", message: (e as Error).message } });
        }
      }
    })();

    return () => controller.abort();
  }, [from, to]);

  const currentReachable = from && reachable?.from === from.id ? reachable : null;
  const reachableIds = currentReachable?.ids ?? null;
  const routeKey = from && to ? `${from.id}-${to.id}` : null;
  const routeResult: RouteCheck | null = routeKey
    ? routeCheck?.key === routeKey
      ? routeCheck.result
      : { status: "checking" }
    : null;
  const canFindRoute = routeResult?.status === "found" || routeResult?.status === "error";

  // Geolocation results
  useEffect(() => {
    if (!map) return;
    const onFound = (e: L.LocationEvent) => {
      setMyLocation({ lat: e.latlng.lat, lon: e.latlng.lng, accuracy: e.accuracy });
      setLocating(false);
    };
    const onError = (e: L.ErrorEvent) => {
      setLocationError(e.message || "Could not get your location");
      setLocating(false);
    };
    map.on("locationfound", onFound);
    map.on("locationerror", onError);
    return () => {
      map.off("locationfound", onFound);
      map.off("locationerror", onError);
    };
  }, [map]);

  useEffect(() => {
    if (!locationError) return;
    const timer = setTimeout(() => setLocationError(null), 6000);
    return () => clearTimeout(timer);
  }, [locationError]);

  const lines = useMemo(() => new Set(parseLines(lineFilter)), [lineFilter]);
  const lineKey = [...lines].sort().join(",");

  const shownVehicles = useMemo(() => {
    const byKey = new Map<string, Vehicle>();
    for (const v of vehicles) {
      if (v.type === "bus" ? !showBuses : !showTrams) continue;
      if (lines.size > 0 && !lines.has(v.line.toUpperCase())) continue;
      // The API occasionally lists a vehicle twice – keep the most recent position
      const key = vehicleKey(v);
      const previous = byKey.get(key);
      if (!previous || previous.ageSeconds > v.ageSeconds) byKey.set(key, v);
    }
    return [...byKey.values()];
  }, [vehicles, showBuses, showTrams, lines]);

  // When filtering by line, zoom to the matching vehicles once
  const fittedLineKey = useRef("");
  useEffect(() => {
    if (!map) return;
    if (!lineKey) {
      fittedLineKey.current = "";
      return;
    }
    if (fittedLineKey.current === lineKey || shownVehicles.length === 0) return;
    fittedLineKey.current = lineKey;
    map.fitBounds(L.latLngBounds(shownVehicles.map((v) => [v.lat, v.lon] as L.LatLngTuple)), {
      paddingTopLeft: [panelOpen ? 360 : 40, 40],
      paddingBottomRight: [70, 40],
      maxZoom: 15,
    });
  }, [map, lineKey, shownVehicles, panelOpen]);

  // A single shared popup for vehicles; it follows the vehicle when new positions arrive
  const openVehiclePopup = useCallback(
    (v: Vehicle) => {
      if (!map) return;
      selectedVehicle.current = vehicleKey(v);
      vehiclePopup.current ??= L.popup({ offset: [0, -8] });
      vehiclePopup.current.setLatLng([v.lat, v.lon]).setContent(vehiclePopupHtml(v)).openOn(map);
    },
    [map]
  );

  useEffect(() => {
    const popup = vehiclePopup.current;
    if (!map || !popup || !map.hasLayer(popup) || !selectedVehicle.current) return;
    const v = vehicles.find((x) => vehicleKey(x) === selectedVehicle.current);
    if (v) popup.setLatLng([v.lat, v.lon]).setContent(vehiclePopupHtml(v));
  }, [map, vehicles]);

  const drawBadges = (view?.zoom ?? DEFAULT_ZOOM) >= BADGE_ZOOM || shownVehicles.length <= MAX_BADGES;
  // Many badges are only drawn for the visible area; dots are cheap enough to draw everywhere
  const badgeArea = drawBadges && shownVehicles.length > MAX_BADGES && view ? view.bounds.pad(0.2) : null;

  const vehicleMarkers = useMemo(() => {
    const list = badgeArea ? shownVehicles.filter((v) => badgeArea.contains([v.lat, v.lon])) : shownVehicles;
    return list.map((v) => {
      const handlers = { click: () => openVehiclePopup(v) };
      return drawBadges ? (
        <Marker key={vehicleKey(v)} position={[v.lat, v.lon]} icon={vehicleBadgeIcon(v.type, v.line)} eventHandlers={handlers} />
      ) : (
        <CircleMarker key={vehicleKey(v)} center={[v.lat, v.lon]} radius={4} pathOptions={VEHICLE_DOT_STYLE[v.type]} eventHandlers={handlers} />
      );
    });
  }, [shownVehicles, drawBadges, badgeArea, openVehiclePopup]);

  const chooseStop = useCallback(
    (kind: "from" | "to", stop: Stop) => {
      if (kind === "from") {
        setFrom(stop);
        setTo((current) => (current?.id === stop.id ? null : current));
      } else {
        setTo(stop);
        setFrom((current) => (current?.id === stop.id ? null : current));
      }
      setSelectedStop(null);
    },
    []
  );

  // Stops in the visible area, plus (after choosing a start) the green reachable stops at any zoom.
  // All stops share one popup (rendered below), which keeps thousands of stops fast.
  const stopMarkers = useMemo(() => {
    const marker = (s: Stop, style: L.PathOptions, radius: number) => (
      <CircleMarker
        key={s.id}
        center={[s.lat, s.lon]}
        radius={radius}
        pathOptions={style}
        eventHandlers={{ click: () => setSelectedStop(s) }}
      />
    );
    const others = stops
      .filter((s) => !currentReachable?.ids.has(s.id))
      .map((s) => marker(s, currentReachable ? STOP_DIMMED_STYLE : STOP_STYLE, 6));
    const green = (currentReachable?.stops ?? []).map((s) => marker(s, STOP_REACHABLE_STYLE, 7));
    return [...others, ...green];
  }, [stops, currentReachable]);

  const selectedStopPosition = useMemo<L.LatLngTuple | null>(
    () => (selectedStop ? [selectedStop.lat, selectedStop.lon] : null),
    [selectedStop]
  );

  const locate = () => {
    if (!map) return;
    setLocating(true);
    setLocationError(null);
    map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true });
  };

  const flyToStop = (stop: Stop) => map?.flyTo([stop.lat, stop.lon], Math.max(map.getZoom(), 14));

  const findRoute = () => {
    if (!from || !to || !canFindRoute) return;
    const params = new URLSearchParams({ from: String(from.id), to: String(to.id) });
    if (routeResult?.status === "found" && routeResult.transfers) params.set("transfers", "1");
    router.push(`/search?${params}`);
  };

  let vehicleStatus: ReactNode;
  if (!vehiclesEnabled) {
    vehicleStatus = "Live vehicles are hidden.";
  } else if (vehiclesError) {
    vehicleStatus = <span style={{ color: "#c62828" }}>⚠️ {vehiclesError}</span>;
  } else if (!vehiclesFetchedAt) {
    vehicleStatus = "Loading live vehicles…";
  } else if (lines.size > 0 && shownVehicles.length === 0) {
    vehicleStatus = `No vehicles on line ${[...lines].join(", ")} right now.`;
  } else {
    vehicleStatus = `${shownVehicles.length.toLocaleString()} vehicles · updated ${formatTime(vehiclesFetchedAt)}`;
  }

  return (
    <div className="transit-map" style={{ position: "relative", flex: 1, width: "100%", height: "100%", isolation: "isolate" }}>
      <MapContainer
        ref={setMap}
        center={WARSAW_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        preferCanvas
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        <ZoomControl position="topright" />

        {myLocation && (
          <>
            <Circle center={[myLocation.lat, myLocation.lon]} radius={myLocation.accuracy} pathOptions={ACCURACY_STYLE} interactive={false} />
            <Marker position={[myLocation.lat, myLocation.lon]} icon={MY_LOCATION_ICON} interactive={false} />
          </>
        )}

        {/* Stops sit above vehicle dots but below badges and pins */}
        <Pane name="stops" style={{ zIndex: 450 }}>
          {showStops && stopMarkers}
        </Pane>

        {selectedStop && selectedStopPosition && (
          <Popup
            key={selectedStop.id}
            position={selectedStopPosition}
            eventHandlers={{
              // Only clear if this popup's stop is still the selected one (another stop may have been clicked)
              remove: () => setSelectedStop((current) => (current?.id === selectedStop.id ? null : current)),
            }}
          >
            <div className="map-popup">
              <div className="map-popup__title">{selectedStop.name}</div>
              {selectedStop.address && selectedStop.address !== selectedStop.name && (
                <div className="map-popup__meta">{selectedStop.address}</div>
              )}
              {from && reachableIds?.has(selectedStop.id) && (
                <div className="map-popup__meta" style={{ color: "#2e7d32", fontWeight: 700 }}>
                  ✓ Direct connection from {from.name}
                </div>
              )}
              <div className="map-popup__actions">
                <button type="button" className="map-popup__btn map-popup__btn--from" onClick={() => chooseStop("from", selectedStop)}>
                  Start here
                </button>
                <button type="button" className="map-popup__btn map-popup__btn--to" onClick={() => chooseStop("to", selectedStop)}>
                  End here
                </button>
              </div>
            </div>
          </Popup>
        )}

        {vehicleMarkers}

        {from && <Marker position={[from.lat, from.lon]} icon={STOP_PIN.from} title={`Start: ${from.name}`} zIndexOffset={1000} />}
        {to && <Marker position={[to.lat, to.lon]} icon={STOP_PIN.to} title={`Destination: ${to.name}`} zIndexOffset={1000} />}
      </MapContainer>

      {/* My location button, under the zoom control */}
      <button
        type="button"
        onClick={locate}
        title="Show my location"
        aria-label="Show my location"
        style={{
          position: "absolute",
          top: 86,
          right: 10,
          zIndex: 1000,
          width: 34,
          height: 34,
          borderRadius: 4,
          border: "2px solid rgba(0,0,0,0.2)",
          background: "#fff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: myLocation ? "#1e88e5" : "#333",
        }}
      >
        <LocateFixed size={18} className={locating ? "map-spin" : undefined} />
      </button>

      {locationError && (
        <div
          role="alert"
          style={{
            position: "absolute",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            maxWidth: "calc(100% - 32px)",
            padding: "12px 18px",
            borderRadius: 12,
            background: "rgba(239, 83, 80, 0.95)",
            color: "#fff",
            fontWeight: 600,
            fontSize: 14,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}
        >
          📍 {locationError}
        </div>
      )}

      {/* Control panel */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 1000,
          width: 320,
          maxWidth: "calc(100% - 76px)",
          maxHeight: "calc(100% - 24px)",
          overflowY: "auto",
          background: "rgba(255, 255, 255, 0.97)",
          borderRadius: 18,
          border: "2px solid rgba(66, 165, 245, 0.3)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        }}
      >
        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          aria-expanded={panelOpen}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "14px 18px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span>
            <span
              style={{
                display: "block",
                fontSize: 22,
                fontWeight: 900,
                background: "linear-gradient(135deg, #42a5f5 0%, #66bb6a 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Live Map
            </span>
            <span style={{ display: "block", fontSize: 13, color: "#607d8b", fontWeight: 500 }}>Stops and Warsaw vehicles</span>
          </span>
          {panelOpen ? <ChevronUp size={20} color="#607d8b" /> : <ChevronDown size={20} color="#607d8b" />}
        </button>

        {panelOpen && (
          <div style={{ padding: "0 18px 18px" }}>
            <SectionTitle>Show on map</SectionTitle>
            <div style={{ display: "flex", gap: 8 }}>
              <LayerToggle active={showStops} color={STOP_COLOR} onClick={() => setShowStops((v) => !v)} icon={<MapPin size={15} />} label="Stops" />
              <LayerToggle active={showBuses} color={VEHICLE_COLOR.bus} onClick={() => setShowBuses((v) => !v)} icon={<Bus size={15} />} label="Buses" />
              <LayerToggle active={showTrams} color={VEHICLE_COLOR.tram} onClick={() => setShowTrams((v) => !v)} icon={<TramFront size={15} />} label="Trams" />
            </div>

            <input
              value={lineInput}
              onChange={(e) => setLineInput(e.target.value)}
              placeholder="Filter by line, e.g. 523, 17"
              aria-label="Filter vehicles by line"
              disabled={!vehiclesEnabled}
              style={{
                width: "100%",
                marginTop: 10,
                padding: "11px 14px",
                border: "2px solid #e3f2fd",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 500,
                outline: "none",
                background: vehiclesEnabled ? "#fafafa" : "#f0f0f0",
              }}
            />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10, fontSize: 13, color: "#546e7a" }}>
              <span>{vehicleStatus}</span>
              {vehiclesEnabled && (
                <button
                  type="button"
                  onClick={() => setRefreshTick((n) => n + 1)}
                  title="Refresh vehicles now"
                  aria-label="Refresh vehicles now"
                  style={{ flexShrink: 0, background: "transparent", border: "none", cursor: "pointer", color: "#1e88e5", padding: 4, display: "flex" }}
                >
                  <RefreshCw size={16} className={vehiclesLoading ? "map-spin" : undefined} />
                </button>
              )}
            </div>
            {showStops && (stopsError || stopsTruncated) && (
              <div style={{ marginTop: 6, fontSize: 13, color: stopsError ? "#c62828" : "#546e7a" }}>
                {stopsError
                  ? `⚠️ Stops: ${stopsError}`
                  : currentReachable
                    ? "Zoom in to see the other stops."
                    : "Zoom in to see the stops."}
              </div>
            )}

            <SectionTitle>Plan a route</SectionTitle>
            <RouteStopRow badge="A" color="#2e7d32" label="From" stop={from} onShow={flyToStop} onClear={() => setFrom(null)} />
            {from && !to && (
              <PanelNote>
                {!reachableIds ? (
                  "Looking for stops you can reach…"
                ) : reachableIds.size > 0 ? (
                  <>
                    Stops with a direct connection from here are <strong style={{ color: "#2e7d32" }}>green</strong> ({reachableIds.size}).
                  </>
                ) : (
                  "No direct connections leave from this stop – try another start."
                )}
              </PanelNote>
            )}
            <RouteStopRow badge="B" color="#ef6c00" label="To" stop={to} onShow={flyToStop} onClear={() => setTo(null)} />
            {routeResult && <RouteCheckNote result={routeResult} />}
            <button
              type="button"
              onClick={findRoute}
              disabled={!canFindRoute}
              style={{
                width: "100%",
                marginTop: 12,
                padding: "13px 16px",
                border: "none",
                borderRadius: 12,
                background: canFindRoute ? "linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%)" : "#cfd8dc",
                color: canFindRoute ? "#fff" : "#78909c",
                fontSize: 15,
                fontWeight: 700,
                cursor: canFindRoute ? "pointer" : "not-allowed",
                boxShadow: canFindRoute ? "0 6px 20px rgba(66, 165, 245, 0.4)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Route size={18} />
              FIND ROUTE
            </button>
            {(!from || !to) && (
              <p style={{ marginTop: 8, fontSize: 12, color: "#78909c", lineHeight: 1.5 }}>
                Click a stop on the map and choose <strong>Start here</strong> or <strong>End here</strong>.
              </p>
            )}

            <p style={{ marginTop: 14, fontSize: 11, color: "#90a4ae", lineHeight: 1.5 }}>
              Vehicle positions: City of Warsaw open data, refreshed every {VEHICLE_REFRESH_MS / 1000} s.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PanelNote({ children, color = "#546e7a" }: { children: ReactNode; color?: string }) {
  return <div style={{ margin: "0 0 4px 36px", fontSize: 12, lineHeight: 1.5, color }}>{children}</div>;
}

function RouteCheckNote({ result }: { result: RouteCheck }) {
  switch (result.status) {
    case "checking":
      return <PanelNote>Checking connections…</PanelNote>;
    case "found": {
      const count = `${result.count}${result.count >= 20 ? "+" : ""}`;
      const noun = result.count === 1 ? "connection" : "connections";
      return (
        <PanelNote color="#2e7d32">
          <strong>✓ {count} {result.transfers ? `${noun} with one transfer` : `direct ${noun}`}</strong>
        </PanelNote>
      );
    }
    case "none":
      return (
        <PanelNote color="#c62828">
          <strong>No connections between these stops</strong>, even with a transfer. Pick another destination – green stops have direct routes.
        </PanelNote>
      );
    case "error":
      return <PanelNote color="#c62828">⚠️ Couldn&apos;t check connections: {result.message}</PanelNote>;
  }
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{ marginTop: 16, marginBottom: 8, fontSize: 12, fontWeight: 800, letterSpacing: 0.6, color: "#1565c0", textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

function LayerToggle({ active, color, icon, label, onClick }: { active: boolean; color: string; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "9px 6px",
        borderRadius: 10,
        border: `2px solid ${active ? color : "#e0e0e0"}`,
        background: active ? `${color}14` : "#f5f5f5",
        color: active ? color : "#90a4ae",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function RouteStopRow({
  badge,
  color,
  label,
  stop,
  onShow,
  onClear,
}: {
  badge: string;
  color: string;
  label: string;
  stop: Stop | null;
  onShow: (stop: Stop) => void;
  onClear: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
      <span
        style={{
          width: 26,
          height: 26,
          flexShrink: 0,
          borderRadius: "50%",
          background: color,
          color: "#fff",
          fontSize: 13,
          fontWeight: 900,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {badge}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#90a4ae", textTransform: "uppercase" }}>{label}</div>
        {stop ? (
          <button
            type="button"
            onClick={() => onShow(stop)}
            title="Show on map"
            style={{
              display: "block",
              maxWidth: "100%",
              padding: 0,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              fontSize: 14,
              fontWeight: 700,
              color: "#0a1929",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {stop.name}
          </button>
        ) : (
          <div style={{ fontSize: 14, color: "#b0bec5", fontStyle: "italic" }}>Choose a stop on the map</div>
        )}
      </div>
      {stop && (
        <button
          type="button"
          onClick={onClear}
          title={`Clear ${label.toLowerCase()}`}
          aria-label={`Clear ${label.toLowerCase()}`}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#90a4ae", padding: 4, display: "flex" }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
