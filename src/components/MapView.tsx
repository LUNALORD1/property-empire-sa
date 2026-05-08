import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import type { Property } from "@/lib/game";
import { formatZAR } from "@/lib/format";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function makeIcon(color: string, dim = false) {
  const opacity = dim ? 0.55 : 1;
  return L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};opacity:${opacity};box-shadow:0 4px 12px rgba(0,0,0,0.4);border:2px solid rgba(255,255,255,0.9);display:grid;place-items:center;"><div style="width:8px;height:8px;background:white;border-radius:50%;transform:rotate(45deg);"></div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
  });
}

const ICON_AFFORDABLE     = makeIcon("oklch(0.82 0.14 85)");        // gold — for sale & you can afford
const ICON_UNAFFORDABLE   = makeIcon("oklch(0.55 0.04 270)", true); // muted slate — for sale but too pricey
const ICON_OWNED_RENTED   = makeIcon("oklch(0.62 0.18 155)");
const ICON_OWNED_VACANT   = makeIcon("oklch(0.75 0.18 70)");

function ResizeHandler() {
  const map = useMap();
  useEffect(() => { setTimeout(() => map.invalidateSize(), 50); }, [map]);
  return null;
}

export function MapView({ properties, ownedMap, onSelect, cash }: {
  properties: Property[];
  ownedMap: Record<string, "rented" | "vacant">;
  onSelect: (p: Property) => void;
  cash: number;
}) {
  return (
    <MapContainer center={[-29.5, 25]} zoom={5.5} scrollWheelZoom style={{ width: "100%", height: "100%" }} zoomControl={false}>
      <ResizeHandler />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {properties.map((p) => {
        const owned = ownedMap[p.id];
        const price = Number(p.listing_price);
        const affordable = cash >= price;
        const icon =
          owned === "rented" ? ICON_OWNED_RENTED :
          owned === "vacant" ? ICON_OWNED_VACANT :
          affordable ? ICON_AFFORDABLE : ICON_UNAFFORDABLE;

        const tooltipLabel = owned
          ? (owned === "rented" ? "Rented · yours" : "Vacant · yours")
          : (affordable ? "Affordable" : "Out of reach");
        const tooltipColor = owned
          ? (owned === "rented" ? "oklch(0.62 0.18 155)" : "oklch(0.75 0.18 70)")
          : (affordable ? "oklch(0.82 0.14 85)" : "oklch(0.7 0.04 270)");

        return (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={icon}
            eventHandlers={{ click: () => onSelect(p) }}
          >
            <Tooltip direction="top" offset={[0, -28]} opacity={1} sticky className="pe-tooltip">
              <div style={{ minWidth: 160 }}>
                <div style={{ fontSize: 11, color: tooltipColor, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
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
    </MapContainer>
  );
}
