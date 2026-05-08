import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, Circle, useMap, useMapEvent } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { tierForPrice, type City, type Property } from "@/lib/game";
import { formatZAR } from "@/lib/format";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ---------- Tier + status colours ----------
export const TIER_COLORS: Record<number, string> = {
  1: "oklch(0.88 0.01 260)", // white/grey
  2: "oklch(0.68 0.16 240)", // blue
  3: "oklch(0.82 0.14 85)",  // gold
  4: "oklch(0.72 0.18 50)",  // orange
  5: "oklch(0.62 0.21 25)",  // red
};
const STATUS_COLORS = {
  rented: "oklch(0.62 0.18 155)",
  vacant: "oklch(0.75 0.18 70)",
  unaffordable: "oklch(0.55 0.04 270)",
};

function pinSvg(color: string, dim: boolean, owned: boolean) {
  const opacity = dim ? 0.55 : 1;
  const ringColor = owned ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.85)";
  // Slightly larger pin (34px) with soft glow
  return `
    <div class="pe-pin" style="--pin-color:${color};opacity:${opacity};">
      <div class="pe-pin-glow" style="background:${color}"></div>
      <div class="pe-pin-body" style="background:linear-gradient(155deg, ${color} 0%, color-mix(in oklab, ${color} 70%, black) 100%);border-color:${ringColor};">
        <div class="pe-pin-dot"></div>
      </div>
    </div>`;
}

function makePin(color: string, dim = false, owned = false) {
  return L.divIcon({
    className: "pe-pin-wrap",
    html: pinSvg(color, dim, owned),
    iconSize: [34, 42],
    iconAnchor: [17, 40],
  });
}

// Cluster icon factory — gold badge with count
function clusterIcon(cluster: any) {
  const count = cluster.getChildCount();
  const size = count < 10 ? 38 : count < 50 ? 46 : 54;
  return L.divIcon({
    className: "pe-cluster-wrap",
    html: `<div class="pe-cluster" style="width:${size}px;height:${size}px;">
      <div class="pe-cluster-glow"></div>
      <div class="pe-cluster-body">${count}<span class="pe-cluster-sub">listings</span></div>
    </div>`,
    iconSize: [size, size],
  });
}

function ResizeHandler() {
  const map = useMap();
  useEffect(() => { setTimeout(() => map.invalidateSize(), 50); }, [map]);
  return null;
}

function ZoomTracker({ onChange }: { onChange: (z: number) => void }) {
  const map = useMap();
  useEffect(() => { onChange(map.getZoom()); }, [map, onChange]);
  useMapEvent("zoomend", (e) => onChange(e.target.getZoom()));
  return null;
}

export function MapView({ properties, ownedMap, onSelect, cash, cities }: {
  properties: Property[];
  ownedMap: Record<string, "rented" | "vacant">;
  onSelect: (p: Property) => void;
  cash: number;
  cities?: City[];
}) {
  const [zoom, setZoom] = useState(5.5);

  // Pre-build icon cache so identical pins reuse divIcons
  const iconFor = useMemo(() => {
    const cache = new Map<string, L.DivIcon>();
    return (key: string, color: string, dim: boolean, owned: boolean) => {
      const k = `${key}|${color}|${dim}|${owned}`;
      let icon = cache.get(k);
      if (!icon) { icon = makePin(color, dim, owned); cache.set(k, icon); }
      return icon;
    };
  }, []);

  return (
    <MapContainer
      center={[-29.5, 25]}
      zoom={5.5}
      minZoom={5}
      maxBounds={[[-38, 10], [-15, 41]]}
      maxBoundsViscosity={1}
      scrollWheelZoom
      style={{ width: "100%", height: "100%" }}
      zoomControl={false}
      className="pe-map"
    >
      <ResizeHandler />
      <ZoomTracker onChange={setZoom} />
      {/* Detailed dark base */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {/* Bright street/labels overlay only at suburb zoom */}
      {zoom >= 12 && (
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
          opacity={0.55}
        />
      )}

      {/* City zone overlays — soft amber glow */}
      {(cities ?? []).map((c) => (
        <Circle
          key={`zone-${c.id}`}
          center={[c.latitude, c.longitude]}
          radius={zoom < 9 ? 35000 : 18000}
          pathOptions={{
            color: "oklch(0.82 0.14 85 / 0.55)",
            weight: 1.5,
            fillColor: "oklch(0.82 0.14 85)",
            fillOpacity: zoom < 9 ? 0.10 : 0.04,
            dashArray: zoom >= 11 ? "4 6" : undefined,
          }}
          interactive={false}
        />
      ))}

      {/* City labels — float above map even when zoomed out */}
      {(cities ?? []).map((c) => (
        <Marker
          key={`label-${c.id}`}
          position={[c.latitude, c.longitude]}
          icon={L.divIcon({
            className: "pe-city-label-wrap",
            html: `<div class="pe-city-label">${c.name}</div>`,
            iconSize: [120, 24],
            iconAnchor: [60, 12],
          })}
          interactive={false}
        />
      ))}

      <MarkerClusterGroup
        chunkedLoading
        showCoverageOnHover={false}
        spiderfyOnMaxZoom
        maxClusterRadius={(z: number) => (z < 8 ? 80 : z < 11 ? 50 : 30)}
        iconCreateFunction={clusterIcon}
      >
        {properties.map((p) => {
          const owned = ownedMap[p.id];
          const price = Number(p.listing_price);
          const affordable = cash >= price;
          const tier = tierForPrice(price);

          let color: string;
          if (owned === "rented") color = STATUS_COLORS.rented;
          else if (owned === "vacant") color = STATUS_COLORS.vacant;
          else if (!affordable) color = STATUS_COLORS.unaffordable;
          else color = TIER_COLORS[tier.id];

          const dim = !owned && !affordable;
          const icon = iconFor(`t${tier.id}-${owned ?? "n"}`, color, dim, !!owned);

          const tooltipLabel = owned
            ? (owned === "rented" ? "Rented · yours" : "Vacant · yours")
            : (affordable ? `${tier.label} · affordable` : `${tier.label} · out of reach`);

          return (
            <Marker
              key={p.id}
              position={[p.latitude, p.longitude]}
              icon={icon}
              eventHandlers={{ click: () => onSelect(p) }}
            >
              <Tooltip direction="top" offset={[0, -36]} opacity={1} sticky className="pe-tooltip">
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontSize: 11, color, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                    {tooltipLabel}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{formatZAR(price)}</div>
                  <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>
                    {p.suburb} · {p.bedrooms}bd
                  </div>
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
