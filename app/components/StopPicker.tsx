"use client";

// A text field with stop suggestions: type a few letters, pick a stop from the list.
// Suggestions come from /api/stops/search (our database, imported from the Warsaw GTFS timetable,
// so they are the same stops the map and the Warsaw API use).

import { useEffect, useId, useState } from "react";
import { Loader2, MapPin, X } from "lucide-react";

export type StopOption = { id: number; name: string; address: string | null };

type Props = {
  label: string;
  placeholder: string;
  value: StopOption | null;
  onChange: (stop: StopOption | null) => void;
  color: string;
  /** Called when Enter is pressed while a stop is already chosen (e.g. to start the search) */
  onSubmit?: () => void;
};

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;

/** Address line under a suggestion, unless it only repeats the stop name */
const addressNote = (stop: StopOption) => {
  const address = stop.address?.trim();
  if (!address) return null;
  const base = stop.name.replace(/\s\d{2}$/, "").toLowerCase();
  return address.toLowerCase() === base || address.toLowerCase() === stop.name.toLowerCase() ? null : address;
};

export default function StopPicker({ label, placeholder, value, onChange, color, onSubmit }: Props) {
  // What the user typed; while a stop is chosen the field shows the stop's name instead
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<{ query: string; stops: StopOption[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputId = useId();

  const text = value ? value.name : typed;
  const query = typed.trim();
  const searching = !value && query.length >= MIN_CHARS;
  const stops = searching && results?.query === query ? results.stops : [];
  const loading = searching && results?.query !== query && !error;

  // Ask the server for matching stops shortly after the user stops typing
  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stops/search?q=${encodeURIComponent(query)}&limit=8`, { signal: controller.signal });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
        setResults({ query, stops: json.stops ?? [] });
        setActive(0);
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Couldn't load stops. Is the server running?");
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searching, query]);

  const choose = (stop: StopOption) => {
    onChange(stop);
    setTyped(stop.name);
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setTyped("");
    setResults(null);
    setOpen(true);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value) {
      e.preventDefault();
      onSubmit?.();
      return;
    }
    if (!open || stops.length === 0) {
      if (e.key === "ArrowDown" && searching) setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % stops.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + stops.length) % stops.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const stop = stops.at(active);
      if (stop) choose(stop);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && searching;
  const activeStop = showList ? stops.at(active) : undefined;

  return (
    <div style={{ position: "relative" }}>
      <label htmlFor={inputId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: "#1565c0", marginBottom: 12 }}>
        <MapPin size={20} color={color} />
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          id={inputId}
          value={text}
          onChange={(e) => {
            setTyped(e.target.value);
            setError(null);
            setOpen(true);
            if (value) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeStop ? `${listId}-${activeStop.id}` : undefined}
          style={{
            width: "100%",
            padding: "16px 48px 16px 20px",
            border: `3px solid ${value ? color : "#e3f2fd"}`,
            borderRadius: 12,
            fontSize: 16,
            fontWeight: value ? 700 : 500,
            outline: "none",
            background: value ? "#fff" : "#fafafa",
            color: "#0d47a1",
          }}
        />
        {(value || typed) && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            aria-label={`Clear ${label.toLowerCase()}`}
            title="Clear"
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: "#90a4ae", display: "flex", padding: 4 }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          style={{
            position: "absolute",
            zIndex: 20,
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 6,
            listStyle: "none",
            padding: 6,
            background: "#fff",
            borderRadius: 12,
            border: "2px solid #e3f2fd",
            boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {error ? (
            <li style={{ padding: "10px 12px", color: "#c62828", fontSize: 14 }}>⚠️ {error}</li>
          ) : loading ? (
            <li style={{ padding: "10px 12px", color: "#78909c", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Searching stops…
            </li>
          ) : stops.length === 0 ? (
            <li style={{ padding: "10px 12px", color: "#78909c", fontSize: 14 }}>No stops match “{query}”.</li>
          ) : (
            stops.map((stop, i) => {
              const note = addressNote(stop);
              return (
                <li
                  key={stop.id}
                  id={`${listId}-${stop.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(stop)}
                  onMouseEnter={() => setActive(i)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: i === active ? "#e3f2fd" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <MapPin size={16} color={color} style={{ flexShrink: 0 }} />
                  <span>
                    <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "#0d47a1" }}>{stop.name}</span>
                    {note && <span style={{ display: "block", fontSize: 12, color: "#78909c" }}>{note}</span>}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
