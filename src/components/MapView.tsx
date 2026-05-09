import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, Circle, useMap, useMapEvent } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { tierForPrice, type City, type Property } from "@/lib/game";
import { formatZAR } from "@/lib/format";
import { Wallet } from "lucide-react";
import { TIERS } from "@/lib/game";

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
  unaffordable: "oklch(0.58 0.20 25)", // red-ish lock badge
};

type PinStatus = "rented" | "vacant" | "unaffordable" | "available";

function pinSvg(tierColor: string, status: PinStatus) {
  // Ring + badge convey status; body color always = tier color so tier stays visible.
  const ringColor =
    status === "rented" ? STATUS_COLORS.rented
    : status === "vacant" ? STATUS_COLORS.vacant
    : status === "unaffordable" ? "rgba(180,190,210,0.55)"
    : "rgba(255,255,255,0.95)";
  const ringWidth = status === "rented" || status === "vacant" ? 3 : 2;
  const bodyOpacity = status === "unaffordable" ? 0.78 : 1;

  const badge =
    status === "rented"
      ? `<div class="pe-pin-badge" style="background:${STATUS_COLORS.rented}">✓</div>`
      : status === "vacant"
      ? `<div class="pe-pin-badge" style="background:${STATUS_COLORS.vacant};color:#1a1a1a">●</div>`
      : status === "unaffordable"
      ? `<div class="pe-pin-badge" style="background:${STATUS_COLORS.unaffordable}">🔒</div>`
      : "";

  return `
    <div class="pe-pin" style="--pin-color:${tierColor};">
      <div class="pe-pin-glow" style="background:${tierColor}"></div>
      <div class="pe-pin-body" style="background:linear-gradient(155deg, ${tierColor} 0%, color-mix(in oklab, ${tierColor} 70%, black) 100%);border-color:${ringColor};border-width:${ringWidth}px;opacity:${bodyOpacity};">
        <div class="pe-pin-dot"></div>
      </div>
      ${badge}
    </div>`;
}

function makePin(tierColor: string, status: PinStatus) {
  return L.divIcon({
    className: "pe-pin-wrap",
    html: pinSvg(tierColor, status),
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
  const [affordableOnly, setAffordableOnly] = useState(false);

  // Pre-build icon cache so identical pins reuse divIcons
  const iconFor = useMemo(() => {
    const cache = new Map<string, L.DivIcon>();
    return (tierColor: string, status: PinStatus) => {
      const k = `${tierColor}|${status}`;
      let icon = cache.get(k);
      if (!icon) { icon = makePin(tierColor, status); cache.set(k, icon); }
      return icon;
    };
  }, []);

  const visibleProps = useMemo(() => {
    if (!affordableOnly) return properties;
    return properties.filter((p) => ownedMap[p.id] || cash >= Number(p.listing_price));
  }, [properties, affordableOnly, cash, ownedMap]);

  const useClusters = zoom < 10;

  const markerNodes = visibleProps.map((p) => {
    const owned = ownedMap[p.id];
    const price = Number(p.listing_price);
    const affordable = cash >= price;
    const tier = tierForPrice(price);
    const tierColor = TIER_COLORS[tier.id];
    const status: PinStatus =
      owned === "rented" ? "rented"
      : owned === "vacant" ? "vacant"
      : !affordable ? "unaffordable"
      : "available";
    const icon = iconFor(tierColor, status);
    const tooltipLabel = owned
      ? (owned === "rented" ? "Rented · yours" : "Vacant · yours")
      : (affordable ? `${tier.label} · affordable` : `${tier.label} · out of reach`);
    return (
      <Marker key={p.id} position={[p.latitude, p.longitude]} icon={icon}
        eventHandlers={{ click: () => onSelect(p) }}>
        <Tooltip direction="top" offset={[0, -36]} opacity={1} sticky className="pe-tooltip">
          <div style={{ minWidth: 160 }}>
            <div style={{ fontSize: 11, color: tierColor, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
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
  });

  return (
    <div className="w-full h-full relative">
    <div className="absolute top-3 right-3 z-[450] pointer-events-auto">
      <button
        onClick={() => setAffordableOnly((v) => !v)}
        className={"flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border backdrop-blur transition " +
          (affordableOnly ? "bg-gradient-gold text-primary-foreground border-primary/40 shadow-gold" : "bg-card/80 text-muted-foreground border-border hover:text-foreground")}
        title="Show only listings you can afford"
      >
        <Wallet className="w-3.5 h-3.5" />
        {affordableOnly ? "Affordable only" : "Show all"}
      </button>
    </div>
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

      {/* Outer warm gold halo — most visible at country zoom */}
      {zoom < 9 && (cities ?? []).map((c) => (
        <Circle
          key={`halo-outer-${c.id}`}
          center={[c.latitude, c.longitude]}
          radius={zoom < 7 ? 120000 : 75000}
          pathOptions={{
            stroke: false,
            fillColor: "oklch(0.82 0.16 75)",
            fillOpacity: 0.18,
          }}
          interactive={false}
        />
      ))}
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
            fillOpacity: zoom < 9 ? 0.18 : 0.04,
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

      {useClusters ? (
        <MarkerClusterGroup
          chunkedLoading
          showCoverageOnHover={false}
          spiderfyOnMaxZoom
          maxClusterRadius={(z: number) => (z < 8 ? 80 : 50)}
          iconCreateFunction={clusterIcon}
        >
          {markerNodes}
        </MarkerClusterGroup>
      ) : (
        <>{markerNodes}</>
      )}
    </MapContainer>
    {zoom >= 10 && (
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[400] pointer-events-none px-2 max-w-[100vw]">
        <div className="pointer-events-auto rounded-full bg-card/80 backdrop-blur-xl border border-border/60 px-3 py-1.5 shadow-card flex items-center gap-3 text-[10px] whitespace-nowrap overflow-x-auto">
          <span className="flex items-center gap-1"><Dot color="oklch(0.62 0.18 155)" />Rented</span>
          <span className="flex items-center gap-1"><Dot color="oklch(0.75 0.18 70)" />Vacant</span>
          <span className="flex items-center gap-1"><Dot color="oklch(0.58 0.20 25)" />Locked</span>
          <span className="text-border">|</span>
          {TIERS.map((t) => (
            <span key={t.id} className="flex items-center gap-1">
              <Dot color={TIER_COLORS[t.id]} />{t.short}
            </span>
          ))}
        </div>
      </div>
    )}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />;
}
