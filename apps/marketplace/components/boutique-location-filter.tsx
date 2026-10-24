/* eslint-disable @next/next/no-img-element -- Map tiles use browser caching and provider attribution. */
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { project, unproject } from "../lib/map-projection.mjs";

const size = 256;

export function BoutiqueLocationFilter({
  city,
  cities,
}: {
  city: string;
  cities: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [center, setCenter] = useState({ lat: 17.385, lon: 78.4867 });
  const [zoom, setZoom] = useState(11);
  const [width, setWidth] = useState(640);
  const [query, setQuery] = useState(city);
  const [chosenCity, setChosenCity] = useState(city);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tileError, setTileError] = useState(false);
  const map = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    setChosenCity(city);
    setQuery(city);
    if (open && city) void lookup({ query: city });
    // Recenter the map when navigation changes the city filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, open]);
  useEffect(() => {
    if (!open || !map.current) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width),
    );
    observer.observe(map.current);
    return () => observer.disconnect();
  }, [open]);
  function apply(value: string) {
    setChosenCity(value);
    const q = new URLSearchParams(params.toString());
    q.set("type", "boutiques");
    q.delete("page");
    if (value) q.set("city", value);
    else q.delete("city");
    router.push(`/discover?${q}`);
  }
  async function lookup(body: Record<string, unknown>, applyResult = false) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/discovery-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCenter({ lat: data.latitude, lon: data.longitude });
      const aliases: Record<string, string> = {
        bangalore: "bengaluru",
        bombay: "mumbai",
        gurgaon: "gurugram",
        madras: "chennai",
      };
      const normalize = (s: string) =>
        aliases[s.toLowerCase()] || s.toLowerCase();
      const match =
        cities.find((c) => normalize(c) === normalize(data.city)) || data.city;
      setChosenCity(match);
      setQuery(match);
      setMessage(
        `Selected city: ${match}. Results match boutique cities, not exact distances.`,
      );
      if (applyResult) apply(match);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not find this location. Please choose a city.",
      );
    } finally {
      setBusy(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setMessage(
        "Location detection is unavailable. Choose a point or city instead.",
      );
      return;
    }
    setBusy(true);
    setMessage("Waiting for your location permission…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        setCenter(point);
        setZoom(12);
        void lookup({ latitude: point.lat, longitude: point.lon }, true);
      },
      () => {
        setBusy(false);
        setMessage(
          "Location permission was denied or your position could not be found. Choose a point or city instead.",
        );
      },
      { timeout: 12000, maximumAge: 60000, enableHighAccuracy: false },
    );
  }
  const world = project(center.lat, center.lon, zoom);
  const tiles = [];
  if (open)
    for (
      let y = Math.floor((world.y - 160) / size);
      y <= Math.floor((world.y + 160) / size);
      y++
    )
      for (
        let x = Math.floor((world.x - width / 2) / size);
        x <= Math.floor((world.x + width / 2) / size);
        x++
      ) {
        const n = 2 ** zoom;
        if (y >= 0 && y < n)
          tiles.push(
            <img
              key={`${zoom}-${x}-${y}`}
              draggable={false}
              alt=""
              aria-hidden="true"
              src={`https://tile.openstreetmap.org/${zoom}/${((x % n) + n) % n}/${y}.png`}
              width={256}
              height={256}
              style={{
                position: "absolute",
                left: x * size - world.x + width / 2,
                top: y * size - world.y + 160,
              }}
              onError={() => setTileError(true)}
            />,
          );
      }
  function pan(dx: number, dy: number) {
    setCenter(unproject(world.x + dx, world.y + dy, zoom));
  }
  return (
    <section
      className="boutique-location"
      aria-label="Boutique location filter"
    >
      <div className="offer-actions">
        <button
          className="button button--ghost"
          aria-expanded={open}
          aria-controls="boutique-map-filter"
          onClick={() => setOpen(!open)}
        >
          {open ? "Hide map" : "Find boutiques on map"}
        </button>
        <button
          className="button button--ghost"
          disabled={busy}
          onClick={locate}
        >
          Use my location
        </button>
        {city && (
          <>
            <span>Showing boutiques in {city}</span>
            <button className="button button--ghost" onClick={() => apply("")}>
              Clear location
            </button>
          </>
        )}
      </div>
      <p>
        Choose a location to browse boutiques in that city. Your position is
        used for this search and is not saved to your account.
      </p>
      {message && <p role="status">{message}</p>}
      {open && (
        <div id="boutique-map-filter">
          <form
            className="offer-actions"
            onSubmit={(e) => {
              e.preventDefault();
              void lookup({ query });
            }}
          >
            <label>
              Find a city
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="City, e.g. Hyderabad"
                minLength={2}
                maxLength={120}
                required
              />
            </label>
            <button className="button button--ghost" disabled={busy}>
              Find on map
            </button>
          </form>
          <p>
            Tap to move the pin, drag sideways to pan, or use the arrow keys.
            Swipe up or down to scroll the page on your phone. Then select
            “Search this map location”.
          </p>
          <div
            className="boutique-map"
            ref={map}
            tabIndex={0}
            role="application"
            aria-label="Choose a location. Arrow keys pan the map; use the search button to apply."
            onKeyDown={(e) => {
              const offsets: Record<string, number[]> = {
                ArrowLeft: [-80, 0],
                ArrowRight: [80, 0],
                ArrowUp: [0, -80],
                ArrowDown: [0, 80],
              };
              if (offsets[e.key]) {
                e.preventDefault();
                pan(offsets[e.key][0], offsets[e.key][1]);
              }
            }}
            onPointerDown={(e) => {
              drag.current = { x: e.clientX, y: e.clientY };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerUp={(e) => {
              const start = drag.current;
              drag.current = null;
              if (!start) return;
              const dx = e.clientX - start.x,
                dy = e.clientY - start.y;
              if (Math.abs(dx) + Math.abs(dy) > 8) pan(-dx, -dy);
              else {
                const rect = e.currentTarget.getBoundingClientRect();
                pan(
                  e.clientX - rect.left - width / 2,
                  e.clientY - rect.top - 160,
                );
              }
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            {tiles}
            <span className="boutique-map__pin" aria-hidden="true">
              📍
            </span>
          </div>
          <small>
            Map data ©{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              OpenStreetMap contributors
            </a>{" "}
            ·{" "}
            <a
              href="https://www.openstreetmap.org/fixthemap"
              target="_blank"
              rel="noreferrer"
            >
              Report a map issue
            </a>
          </small>
          {tileError && (
            <p role="status">
              Map images could not load. You can still choose a city below.
            </p>
          )}
          <div className="offer-actions">
            <button
              className="button button--ghost"
              aria-label="Zoom in"
              disabled={zoom >= 17}
              onClick={() => setZoom(zoom + 1)}
            >
              +
            </button>
            <button
              className="button button--ghost"
              aria-label="Zoom out"
              disabled={zoom <= 4}
              onClick={() => setZoom(zoom - 1)}
            >
              −
            </button>
            <button
              className="button button--primary"
              disabled={busy}
              onClick={() =>
                lookup({ latitude: center.lat, longitude: center.lon }, true)
              }
            >
              Search this map location
            </button>
          </div>
          <div className="offer-actions">
            <label>
              Or select a boutique city
              <select
                value={chosenCity}
                onChange={(e) => setChosenCity(e.target.value)}
              >
                <option value="">All cities</option>
                {[...new Set([...cities, ...(chosenCity ? [chosenCity] : [])])]
                  .sort()
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="button button--ghost"
              onClick={() => apply(chosenCity)}
            >
              Apply city
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
