"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { supabase } from "@/lib/supabase";

interface DriverLocationRow {
  lat:     number;
  lng:     number;
  heading: number | null;
}

export default function LiveMap({ requestId, token }: { requestId: string; token: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const markerRef    = useRef<mapboxgl.Marker | null>(null);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

  // Initialise map once on mount
  useEffect(() => {
    if (!containerRef.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:     "mapbox://styles/mapbox/streets-v12",
      center:    [78.9629, 20.5937],
      zoom:      5,
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current  = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch initial position
  useEffect(() => {
    if (!token || !mapboxToken) return;
    fetch(`/api/location/${requestId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((j: { data: DriverLocationRow | null }) => {
        if (j.data && mapRef.current) {
          placeOrMoveMarker(mapRef.current, markerRef, j.data.lat, j.data.lng, j.data.heading);
        }
      })
      .catch(() => {});
  }, [requestId, token, mapboxToken]);

  // Realtime subscription for live updates
  useEffect(() => {
    if (!mapboxToken) return;

    const channel = supabase
      .channel(`location:${requestId}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "DriverLocation",
          filter: `request_id=eq.${requestId}`,
        },
        (payload) => {
          const row = payload.new as DriverLocationRow;
          if (mapRef.current) {
            placeOrMoveMarker(mapRef.current, markerRef, row.lat, row.lng, row.heading);
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [requestId, mapboxToken]);

  if (!mapboxToken) {
    return (
      <div className="h-[220px] rounded-2xl bg-pale flex items-center justify-center mt-3">
        <p className="text-xs text-sub">Map unavailable</p>
      </div>
    );
  }

  return <div ref={containerRef} className="h-[220px] rounded-2xl overflow-hidden mt-3" />;
}

function placeOrMoveMarker(
  map:       mapboxgl.Map,
  markerRef: MutableRefObject<mapboxgl.Marker | null>,
  lat:       number,
  lng:       number,
  heading:   number | null,
) {
  if (markerRef.current) {
    markerRef.current.setLngLat([lng, lat]);
    if (heading !== null) {
      markerRef.current.getElement().style.transform = `rotate(${heading}deg)`;
    }
    return;
  }

  // First placement — create the custom marker element
  const el = document.createElement("div");
  el.style.cssText = [
    "width:36px",
    "height:36px",
    "background:#2d6a4f",
    "border-radius:50%",
    "border:3px solid white",
    "box-shadow:0 2px 8px rgba(0,0,0,0.3)",
    "display:flex",
    "align-items:center",
    "justify-content:center",
  ].join(";");
  el.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
  </svg>`;

  if (heading !== null) el.style.transform = `rotate(${heading}deg)`;

  markerRef.current = new mapboxgl.Marker({ element: el })
    .setLngLat([lng, lat])
    .addTo(map);

  map.flyTo({ center: [lng, lat], zoom: 13, duration: 1000 });
}
