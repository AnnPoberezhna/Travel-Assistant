"use client";

// Interactive Leaflet map: stops from our database, live Warsaw buses and trams,
// and picking a start/destination stop to plan a route on the search page.
// Leaflet needs `window`, so this component is loaded with ssr: false (see app/(dashboard)/map/page.tsx).

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import L from "leaflet";
import { Circle, CircleMarker, MapContainer, Marker, Pane, Polyline, Popup, TileLayer, ZoomControl } from "react-leaflet";
import { Bus, ChevronDown, ChevronUp, LocateFixed, MapPin, Radar, RefreshCw, Route, TramFront, X } from "lucide-react";
import type { Vehicle, VehicleType } from "@/app/lib/warsawApi";
import type { LiveDeparture } from "@/app/lib/liveRoutes";
import type { RouteLeg, RoutePaths, TransportType } from "@/app/lib/routePaths";
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
/** A departure the user follows on the map ("Where's my bus?"). Line + brigade identify one vehicle. */
type Tracked = { line: string; brigade: string; departureTime: string; type: TransportType; stop: Stop };

const WARSAW_CENTER: L.LatLngTuple = [52.2297, 21.0122];
const DEFAULT_ZOOM = 12;
const VEHICLE_REFRESH_MS = 15_000;
const VEHICLE_REFRESH_TRACKING_MS = 10_000; // the server caches positions for 10 s
const TRANSPORT_TYPES: TransportType[] = ["BUS", "TRAM", "RAIL", "OTHER"];
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

// Route drawn between the chosen stops (see app/lib/routePaths.ts): a coloured line with a white
// outline, small dots for the stops in between, line-number labels and a "Change here" marker.
const ROUTE_COLOR: Record<TransportType, string> = { BUS: VEHICLE_COLOR.bus, TRAM: VEHICLE_COLOR.tram, RAIL: "#6d4c41", OTHER: "#546e7a" };
const ROUTE_TYPES = Object.keys(ROUTE_COLOR) as TransportType[];
const ROUTE_CASING_STYLE: L.PathOptions = { color: "#fff", weight: 11, opacity: 0.95, lineCap: "round", lineJoin: "round" };
const ROUTE_LINE_STYLE = Object.fromEntries(
  ROUTE_TYPES.map((t) => [t, { color: ROUTE_COLOR[t], weight: 6, opacity: 1, lineCap: "round", lineJoin: "round" }])
) as Record<TransportType, L.PathOptions>;
const ROUTE_STOP_STYLE = Object.fromEntries(
  ROUTE_TYPES.map((t) => [t, { color: ROUTE_COLOR[t], weight: 3, fillColor: "#fff", fillOpacity: 1 }])
) as Record<TransportType, L.PathOptions>;
const TRANSFER_STOP_STYLE: L.PathOptions = { color: "#fff", weight: 3, fillColor: "#fbc02d", fillOpacity: 1 };
const TRANSFER_ICON = L.divIcon({ className: "route-label-anchor", html: '<span class="route-transfer">⇄ Change here</span>', iconSize: [0, 0] });

const routeLabelIcons = new Map<string, L.DivIcon>();
function routeLabelIcon(leg: RouteLeg): L.DivIcon {
  const text = leg.lines.join(" · ");
  const key = `${leg.type}|${text}`;
  let icon = routeLabelIcons.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: "route-label-anchor",
      html: `<span class="route-label route-label--${leg.type}">${escapeHtml(text)}</span>`,
      iconSize: [0, 0],
    });
    routeLabelIcons.set(key, icon);
  }
  return icon;
}

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

// --- "Where's my bus?" helpers ---

// Timetable and GPS both give the brigade; compare "06" and "6" as the same
const normBrigade = (b: string) => b.trim().replace(/^0+(?=\d)/, "");
const isTrackedVehicle = (v: Vehicle, t: Tracked) =>
  v.line.trim().toUpperCase() === t.line.trim().toUpperCase() && normBrigade(v.brigade) === normBrigade(t.brigade);

/** Straight-line distance in metres */
function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

const formatDistance = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

/** Minutes from now (Warsaw time) until "HH:MM"; negative when it has passed */
function minutesUntil(hhmm: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const [h, m] = hhmm.split(":").map(Number);
  let diff = h * 60 + m - (get("hour") * 60 + get("minute"));
  if (diff < -720) diff += 1440; // e.g. 00:10 seen at 23:50
  if (diff > 720) diff -= 1440;
  return diff;
}

const TRACK_LINE_STYLE: L.PathOptions = { color: "#37474f", weight: 2, opacity: 0.8, dashArray: "6 8" };

/** Compass bearing in degrees (0 = north, 90 = east) from a to b */
function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const dLon = (b.lon - a.lon) * rad;
  const y = Math.sin(dLon) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos(dLon);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

// Bus and tram pictograms: Lucide's "bus-front" and "tram-front" icons (ISC licence),
// the same drawings lucide-react uses elsewhere in the app, inlined because Leaflet markers take HTML.
const VEHICLE_SVG: Record<VehicleType, string> = {
  bus: '<path d="M4 6 2 7"/><path d="M10 6h4"/><path d="m22 7-2-1"/><rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M8 15h.01"/><path d="M16 15h.01"/><path d="M6 19v2"/><path d="M18 21v-2"/>',
  tram: '<rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><path d="M8 15h.01"/><path d="M16 15h.01"/>',
};

// The tracked vehicle: a bus/tram tile with the line number, a pulsing halo and an arrow
// showing the direction of travel (rotated via the --heading CSS variable, see map.css).
// The icon stays the same while the vehicle moves, so the marker can glide to new positions.
const trackedIcons = new Map<string, L.DivIcon>();
function trackedVehicleIcon(type: VehicleType, line: string): L.DivIcon {
  const key = `${type}:${line}`;
  let icon = trackedIcons.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: "tracked-vehicle-marker",
      html: `<div class="tracked-vehicle tracked-vehicle--${type}">
        <span class="tracked-vehicle__pulse"></span>
        <span class="tracked-vehicle__heading"></span>
        <span class="tracked-vehicle__body"><svg viewBox="0 0 24 24" aria-hidden="true">${VEHICLE_SVG[type]}</svg></span>
        <span class="tracked-vehicle__line">${escapeHtml(line)}</span>
      </div>`,
      iconSize: [0, 0],
    });
    trackedIcons.set(key, icon);
  }
  return icon;
}

// The map remembers its view, the chosen stops and the layer toggles for this browser tab,
// so going to the search page and back doesn't lose them.
const STORAGE_KEY = "travel-assistant:map";
type SavedMapState = {
  center?: L.LatLngTuple;
  zoom?: number;
  from?: Stop | null;
  to?: Stop | null;
  showStops?: boolean;
  showBuses?: boolean;
  showTrams?: boolean;
  tracked?: Tracked | null;
};

const isStop = (s: unknown): s is Stop =>
  !!s && typeof s === "object" && ["id", "lat", "lon"].every((k) => typeof (s as Record<string, unknown>)[k] === "number");

const isTracked = (t: unknown): t is Tracked =>
  !!t &&
  typeof t === "object" &&
  ["line", "brigade", "departureTime"].every((k) => typeof (t as Record<string, unknown>)[k] === "string") &&
  TRANSPORT_TYPES.includes((t as Tracked).type) &&
  isStop((t as Tracked).stop);

function loadSavedState(): SavedMapState {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (!raw || typeof raw !== "object") return {};
    const okCenter = Array.isArray(raw.center) && raw.center.length === 2 && raw.center.every((n: unknown) => typeof n === "number");
    return {
      center: okCenter ? raw.center : undefined,
      zoom: typeof raw.zoom === "number" ? raw.zoom : undefined,
      from: isStop(raw.from) ? raw.from : null,
      to: isStop(raw.to) ? raw.to : null,
      showStops: typeof raw.showStops === "boolean" ? raw.showStops : undefined,
      showBuses: typeof raw.showBuses === "boolean" ? raw.showBuses : undefined,
      showTrams: typeof raw.showTrams === "boolean" ? raw.showTrams : undefined,
      tracked: isTracked(raw.tracked) ? raw.tracked : null,
    };
  } catch {
    return {};
  }
}

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
  const [saved] = useState(loadSavedState);

  // Layers and filters
  const [showStops, setShowStops] = useState(saved.showStops ?? true);
  const [showBuses, setShowBuses] = useState(saved.showBuses ?? true);
  const [showTrams, setShowTrams] = useState(saved.showTrams ?? true);
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
  const [from, setFrom] = useState<Stop | null>(saved.from ?? null);
  const [to, setTo] = useState<Stop | null>(saved.to ?? null);
  const [reachable, setReachable] = useState<{ from: number; stops: Stop[]; ids: Set<number> } | null>(null);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [routeCheck, setRouteCheck] = useState<{ key: string; result: RouteCheck } | null>(null);
  // Next real departures for the chosen pair (null = no live data, e.g. not a Warsaw stop)
  const [liveCheck, setLiveCheck] = useState<{ key: string; departures: LiveDeparture[] | null } | null>(null);
  // The stops the route passes, for drawing it (null = couldn't load)
  const [routePath, setRoutePath] = useState<{ key: string; data: RoutePaths | null } | null>(null);
  const [myLocation, setMyLocation] = useState<MyLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // "Where's my bus?" – only while its departure stop is still the chosen start
  const [tracked, setTracked] = useState<Tracked | null>(saved.tracked ?? null);
  const activeTracked = tracked && from?.id === tracked.stop.id ? tracked : null;
  const isTracking = activeTracked !== null;

  // Links from the search page open the map with stops (and a bus to track) already chosen:
  // /map?from=ID&to=ID[&trackLine=520&trackBrigade=6&trackTime=22:14&trackType=BUS]
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromId = Number(params.get("from"));
    const toId = Number(params.get("to"));
    if (!Number.isInteger(fromId) || fromId <= 0) return;
    const controller = new AbortController();
    const ids = [fromId, toId].filter((n) => Number.isInteger(n) && n > 0).join(",");
    fetch(`/api/stops?ids=${ids}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        const byId = new Map<number, Stop>((json.stops ?? []).map((s: Stop) => [s.id, s]));
        const start = byId.get(fromId);
        if (!start) return;
        setFrom(start);
        setTo(byId.get(toId) ?? null);
        const line = params.get("trackLine");
        const brigade = params.get("trackBrigade");
        const type = params.get("trackType") as TransportType;
        setTracked(
          line && brigade
            ? { line, brigade, departureTime: params.get("trackTime") ?? "", type: TRANSPORT_TYPES.includes(type) ? type : "BUS", stop: start }
            : null
        );
        // Drop the parameters, so a reload doesn't undo what the user changes on the map later
        window.history.replaceState(null, "", window.location.pathname);
      })
      .catch(() => {
        // the map still works without the preselection
      });
    return () => controller.abort();
  }, []);

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

  // Remember the view, chosen stops and layers for this tab (see STORAGE_KEY)
  useEffect(() => {
    if (!view) return;
    const center = view.bounds.getCenter();
    const state: SavedMapState = {
      center: [center.lat, center.lng],
      zoom: view.zoom,
      from,
      to,
      showStops,
      showBuses,
      showTrams,
      tracked: activeTracked,
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage can be unavailable (private mode, blocked site data) – the map works without it
    }
  }, [view, from, to, showStops, showBuses, showTrams, activeTracked]);

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

  // Poll live vehicle positions while buses or trams are shown (or a bus is tracked) and the tab is visible
  const vehiclesEnabled = showBuses || showTrams || isTracking;
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
    const timer = setInterval(load, isTracking ? VEHICLE_REFRESH_TRACKING_MS : VEHICLE_REFRESH_MS);
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
  }, [vehiclesEnabled, refreshTick, isTracking]);

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

    // In parallel: today's real departures from the Warsaw API for the direct lines
    fetch(`/api/routeSearch/live?startId=${from.id}&endId=${to.id}&limit=3`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        const usable = res.ok && json?.available && json.lines?.length > 0;
        setLiveCheck({ key, departures: usable ? json.departures : null });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setLiveCheck({ key, departures: null });
      });

    // ...and the stops the route passes, to draw it on the map
    fetch(`/api/routeSearch/path?startId=${from.id}&endId=${to.id}`, { signal: controller.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        setRoutePath({ key, data: res.ok ? json : null });
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setRoutePath({ key, data: null });
      });

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
  const liveDepartures = routeKey && liveCheck?.key === routeKey ? liveCheck.departures : null;

  const currentRoute = routeKey && routePath?.key === routeKey ? routePath.data : null;
  const routeLegs = useMemo<RouteLeg[]>(() => {
    if (currentRoute?.kind === "direct") return currentRoute.options;
    if (currentRoute?.kind === "transfer") return currentRoute.legs;
    return [];
  }, [currentRoute]);

  // Zoom to a newly drawn route once (afterwards the user can move the map freely).
  // While tracking a bus, the view follows the bus instead.
  const fittedRouteKey = useRef<string | null>(null);
  useEffect(() => {
    if (!map || !routeKey || routeLegs.length === 0 || fittedRouteKey.current === routeKey || isTracking) return;
    fittedRouteKey.current = routeKey;
    const points = routeLegs.flatMap((leg) => leg.stops.map((s) => [s.lat, s.lon] as L.LatLngTuple));
    map.fitBounds(L.latLngBounds(points), {
      paddingTopLeft: [panelOpen ? 360 : 40, 60],
      paddingBottomRight: [70, 60],
      maxZoom: 16,
    });
  }, [map, routeKey, routeLegs, panelOpen, isTracking]);

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

  // The vehicle doing the tracked departure (freshest GPS position if listed twice)
  const trackedVehicle = useMemo(() => {
    if (!activeTracked) return null;
    const matches = vehicles.filter((v) => isTrackedVehicle(v, activeTracked));
    return matches.sort((a, b) => a.ageSeconds - b.ageSeconds)[0] ?? null;
  }, [vehicles, activeTracked]);
  const trackedVehicleKey = trackedVehicle ? vehicleKey(trackedVehicle) : null;

  // Direction of travel: the GPS feed has no heading, so it's the bearing from the previous position.
  // The previous point is only replaced once the vehicle has really moved (>15 m), so GPS jitter
  // at a stop doesn't spin the arrow. Applied straight to the marker element, so the icon (and its
  // glide animation) isn't recreated.
  const trackedMarkerRef = useRef<L.Marker | null>(null);
  const lastTrackedPosition = useRef<{ key: string; lat: number; lon: number; heading: number | null } | null>(null);
  useEffect(() => {
    if (!trackedVehicle) return;
    const key = vehicleKey(trackedVehicle);
    const last = lastTrackedPosition.current;
    const sameVehicle = last?.key === key;
    const moved = sameVehicle && distanceMeters(last, trackedVehicle) > 15;
    const heading = moved ? bearing(last, trackedVehicle) : sameVehicle ? last.heading : null;
    if (!sameVehicle || moved) {
      lastTrackedPosition.current = { key, lat: trackedVehicle.lat, lon: trackedVehicle.lon, heading };
    }
    const element = trackedMarkerRef.current?.getElement();
    if (element && heading !== null) {
      element.style.setProperty("--heading", `${Math.round(heading)}deg`);
      element.classList.add("has-heading");
    }
  }, [trackedVehicle]);

  // Show the tracked bus together with the stop once, then keep it in view as it moves
  const trackKey = activeTracked ? `${activeTracked.line}|${activeTracked.brigade}|${activeTracked.stop.id}` : null;
  const fittedTrackKey = useRef<string | null>(null);
  useEffect(() => {
    if (!map || !trackKey || !activeTracked || !trackedVehicle) return;
    const bus = L.latLng(trackedVehicle.lat, trackedVehicle.lon);
    const padding = { paddingTopLeft: L.point(panelOpen ? 360 : 40, 60), paddingBottomRight: L.point(70, 60) };
    if (fittedTrackKey.current !== trackKey) {
      fittedTrackKey.current = trackKey;
      const points: L.LatLngExpression[] = [bus, [activeTracked.stop.lat, activeTracked.stop.lon]];
      if (to) points.push([to.lat, to.lon]);
      map.fitBounds(L.latLngBounds(points), { ...padding, maxZoom: 16 });
    } else {
      map.panInside(bus, padding);
    }
  }, [map, trackKey, activeTracked, trackedVehicle, to, panelOpen]);

  const drawBadges = (view?.zoom ?? DEFAULT_ZOOM) >= BADGE_ZOOM || shownVehicles.length <= MAX_BADGES;
  // Many badges are only drawn for the visible area; dots are cheap enough to draw everywhere
  const badgeArea = drawBadges && shownVehicles.length > MAX_BADGES && view ? view.bounds.pad(0.2) : null;

  const vehicleMarkers = useMemo(() => {
    const visible = badgeArea ? shownVehicles.filter((v) => badgeArea.contains([v.lat, v.lon])) : shownVehicles;
    // The tracked bus gets its own, bigger marker
    const list = trackedVehicleKey ? visible.filter((v) => vehicleKey(v) !== trackedVehicleKey) : visible;
    return list.map((v) => {
      const handlers = { click: () => openVehiclePopup(v) };
      return drawBadges ? (
        <Marker key={vehicleKey(v)} position={[v.lat, v.lon]} icon={vehicleBadgeIcon(v.type, v.line)} eventHandlers={handlers} />
      ) : (
        <CircleMarker key={vehicleKey(v)} center={[v.lat, v.lon]} radius={4} pathOptions={VEHICLE_DOT_STYLE[v.type]} eventHandlers={handlers} />
      );
    });
  }, [shownVehicles, drawBadges, badgeArea, openVehiclePopup, trackedVehicleKey]);

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
        center={saved.center ?? WARSAW_CENTER}
        zoom={saved.zoom ?? DEFAULT_ZOOM}
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

        {/* The drawn route sits under vehicles and stops, so buses can be seen driving along it.
            The pane stays mounted: Leaflet keeps one canvas per pane name. */}
        <Pane name="route" style={{ zIndex: 390 }}>
          {routeLegs.map((leg, i) => {
            const positions = leg.stops.map((s) => [s.lat, s.lon] as L.LatLngTuple);
            return (
              <Fragment key={`${routeKey}-leg-${i}`}>
                <Polyline positions={positions} pathOptions={ROUTE_CASING_STYLE} interactive={false} />
                <Polyline positions={positions} pathOptions={ROUTE_LINE_STYLE[leg.type]} interactive={false} />
                {leg.stops.slice(1, -1).map((s, j) => (
                  <CircleMarker key={`${s.id}-${j}`} center={[s.lat, s.lon]} radius={4} pathOptions={ROUTE_STOP_STYLE[leg.type]} interactive={false} />
                ))}
              </Fragment>
            );
          })}
          {currentRoute?.kind === "transfer" && (
            <CircleMarker
              center={[currentRoute.transferStop.lat, currentRoute.transferStop.lon]}
              radius={8}
              pathOptions={TRANSFER_STOP_STYLE}
              interactive={false}
            />
          )}
        </Pane>
        {routeLegs.map((leg, i) => {
          const middle = leg.stops[Math.floor(leg.stops.length / 2)];
          return <Marker key={`${routeKey}-label-${i}`} position={[middle.lat, middle.lon]} icon={routeLabelIcon(leg)} interactive={false} />;
        })}
        {currentRoute?.kind === "transfer" && (
          <Marker
            position={[currentRoute.transferStop.lat, currentRoute.transferStop.lon]}
            icon={TRANSFER_ICON}
            interactive={false}
            zIndexOffset={900}
          />
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

        {activeTracked && trackedVehicle && (
          <>
            <Polyline
              positions={[
                [trackedVehicle.lat, trackedVehicle.lon],
                [activeTracked.stop.lat, activeTracked.stop.lon],
              ]}
              pathOptions={TRACK_LINE_STYLE}
              interactive={false}
            />
            <Marker
              ref={trackedMarkerRef}
              position={[trackedVehicle.lat, trackedVehicle.lon]}
              icon={trackedVehicleIcon(trackedVehicle.type, trackedVehicle.line)}
              title={`Your ${VEHICLE_LABEL[trackedVehicle.type].toLowerCase()} ${trackedVehicle.line}`}
              zIndexOffset={2000}
              eventHandlers={{ click: () => openVehiclePopup(trackedVehicle) }}
            />
          </>
        )}

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
            {activeTracked && (
              <TrackingCard
                tracked={activeTracked}
                vehicle={trackedVehicle}
                updatedAt={vehiclesFetchedAt}
                error={vehiclesError}
                onShow={() => trackedVehicle && map?.flyTo([trackedVehicle.lat, trackedVehicle.lon], Math.max(map.getZoom(), 15))}
                onStop={() => setTracked(null)}
              />
            )}

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
            {currentRoute && currentRoute.kind !== "none" && <RouteSummaryNote route={currentRoute} />}
            {liveDepartures && (
              <LiveDeparturesNote
                departures={liveDepartures}
                tracked={activeTracked}
                onTrack={(d) =>
                  from && setTracked({ line: d.line, brigade: d.brigade, departureTime: d.departureTime, type: d.type, stop: from })
                }
              />
            )}
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

function LineChip({ line, type }: { line: string; type: TransportType }) {
  return (
    <span style={{ padding: "1px 6px", borderRadius: 6, color: "#fff", fontWeight: 800, background: ROUTE_COLOR[type] }}>{line}</span>
  );
}

/** One line in the panel describing what is drawn on the map. */
function RouteSummaryNote({ route }: { route: Exclude<RoutePaths, { kind: "none" }> }) {
  const stopsAfterStart = (leg: RouteLeg) => leg.stops.length - 1;
  const plural = (n: number) => `${n} ${n === 1 ? "stop" : "stops"}`;
  return (
    <div style={{ margin: "2px 0 6px 36px", fontSize: 12, lineHeight: 1.9, color: "#37474f" }}>
      <span style={{ fontWeight: 800, color: "#1565c0" }}>On the map: </span>
      {route.kind === "direct" ? (
        <>
          {route.options[0].lines.map((l) => (
            <Fragment key={l}>
              <LineChip line={l} type={route.options[0].type} />{" "}
            </Fragment>
          ))}
          · {plural(stopsAfterStart(route.options[0]))}
          {route.options.length > 1 && ` (+${route.options.length - 1} other ${route.options.length === 2 ? "path" : "paths"})`}
        </>
      ) : (
        <>
          <LineChip line={route.legs[0].lines[0]} type={route.legs[0].type} /> {plural(stopsAfterStart(route.legs[0]))} → change at{" "}
          <strong>{route.transferStop.name}</strong> → <LineChip line={route.legs[1].lines[0]} type={route.legs[1].type} />{" "}
          {plural(stopsAfterStart(route.legs[1]))}
        </>
      )}
    </div>
  );
}

function LiveDeparturesNote({
  departures,
  tracked,
  onTrack,
}: {
  departures: LiveDeparture[];
  tracked: Tracked | null;
  onTrack: (departure: LiveDeparture) => void;
}) {
  if (departures.length === 0) {
    return <PanelNote>No more direct departures in the next hours.</PanelNote>;
  }
  return (
    <div style={{ margin: "4px 0 4px 36px" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#2e7d32", letterSpacing: 0.5, marginBottom: 4 }}>NEXT DEPARTURES (LIVE)</div>
      {departures.map((d) => {
        const isTrackedRow = !!tracked && tracked.line === d.line && normBrigade(tracked.brigade) === normBrigade(d.brigade);
        return (
          <div key={`${d.line}-${d.brigade}-${d.departureTime}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#37474f", padding: "2px 0" }}>
            <LineChip line={d.line} type={d.type} />
            <strong>{d.departureTime}</strong>
            <span style={{ color: d.minutesFromNow <= 5 ? "#e65100" : "#607d8b", whiteSpace: "nowrap" }}>
              {d.minutesFromNow <= 0 ? "now" : `in ${d.minutesFromNow} min`}
            </span>
            <button
              type="button"
              onClick={() => onTrack(d)}
              disabled={isTrackedRow}
              title={`Where's my ${d.type === "TRAM" ? "tram" : "bus"}? Show ${d.line} on the map`}
              style={{
                marginLeft: "auto",
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                padding: "2px 7px",
                borderRadius: 999,
                border: `1.5px solid ${isTrackedRow ? "#fbc02d" : "#90caf9"}`,
                background: isTrackedRow ? "#fff8e1" : "#fff",
                color: isTrackedRow ? "#e65100" : "#1565c0",
                fontSize: 11,
                fontWeight: 800,
                cursor: isTrackedRow ? "default" : "pointer",
              }}
            >
              <Radar size={12} />
              {isTrackedRow ? "Tracking" : "Track"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** "Where's my bus?" – where the vehicle of the chosen departure is right now. */
function TrackingCard({
  tracked,
  vehicle,
  updatedAt,
  error,
  onShow,
  onStop,
}: {
  tracked: Tracked;
  vehicle: Vehicle | null;
  /** ISO time of the last vehicle refresh, null while the first one is loading */
  updatedAt: string | null;
  error: string | null;
  onShow: () => void;
  onStop: () => void;
}) {
  const kind = tracked.type === "TRAM" ? "tram" : "bus";
  // "Now" is the time of the last position refresh (every 10 s while tracking)
  const wait = tracked.departureTime && updatedAt ? minutesUntil(tracked.departureTime, new Date(updatedAt)) : null;
  const gpsAge = vehicle ? vehicle.ageSeconds : null;

  let status: ReactNode;
  if (error && !vehicle) {
    status = <span style={{ color: "#c62828" }}>⚠️ {error}</span>;
  } else if (vehicle) {
    const metres = distanceMeters(vehicle, tracked.stop);
    status = (
      <>
        Now <strong>{formatDistance(metres)}</strong> from {tracked.stop.name}
        {metres < 150 && <strong style={{ color: "#e65100" }}> – it&apos;s at your stop!</strong>}
        <br />
        <span style={{ color: "#78909c" }}>
          GPS {gpsAge !== null && gpsAge < 90 ? `${gpsAge} s` : `${Math.round((gpsAge ?? 0) / 60)} min`} ago · vehicle {vehicle.vehicleNumber}
        </span>
      </>
    );
  } else if (!updatedAt) {
    status = `Looking for the ${kind}…`;
  } else {
    status = `No GPS signal from this ${kind} yet – it may not have started its run. Checking again every 10 s.`;
  }

  return (
    <div style={{ marginTop: 4, padding: 12, borderRadius: 14, background: "#fff8e1", border: "2px solid #fbc02d" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Radar size={16} color="#e65100" />
        <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.5, color: "#e65100" }}>WHERE&apos;S MY {kind.toUpperCase()}?</span>
        <button
          type="button"
          onClick={onStop}
          title="Stop tracking"
          aria-label="Stop tracking"
          style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", color: "#8d6e63", padding: 2, display: "flex" }}
        >
          <X size={16} />
        </button>
      </div>
      <div style={{ fontSize: 13, color: "#37474f", lineHeight: 1.6 }}>
        <LineChip line={tracked.line} type={tracked.type} /> <span style={{ color: "#78909c" }}>brigade {tracked.brigade}</span>
        {tracked.departureTime && (
          <div>
            Departs {tracked.stop.name} at <strong>{tracked.departureTime}</strong>
            {wait !== null && (
              <span style={{ color: wait <= 5 ? "#e65100" : "#607d8b" }}>
                {" "}
                ({wait > 0 ? `in ${wait} min` : wait === 0 ? "now" : `${-wait} min ago`})
              </span>
            )}
          </div>
        )}
        <div style={{ marginTop: 2 }}>{status}</div>
      </div>
      {vehicle && (
        <button
          type="button"
          onClick={onShow}
          style={{
            marginTop: 8,
            width: "100%",
            padding: "8px 10px",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg, #ffb300 0%, #fb8c00 100%)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Show my {kind}
        </button>
      )}
    </div>
  );
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
