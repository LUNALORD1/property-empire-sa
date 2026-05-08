// Deterministic property image helper.
// source.unsplash.com was deprecated in 2024 and now returns broken redirects,
// so we use direct images.unsplash.com CDN URLs (curated photo IDs per tier)
// chosen deterministically from the property id so the same property always
// shows the same photo without needing an API key.

import { tierForPrice, type Tier } from "@/lib/game";

// Curated Unsplash photo IDs grouped by tier. All are exterior shots of
// homes / apartments / estates that broadly match each price band.
const TIER_PHOTOS: Record<Tier, string[]> = {
  1: [
    "photo-1568605114967-8130f3a36994", // small modern house
    "photo-1572120360610-d971b9d7767c", // simple house
    "photo-1494526585095-c41746248156", // small flat
    "photo-1493809842364-78817add7ffb", // modest townhouse
    "photo-1502672260266-1c1ef2d93688", // small apartment block
    "photo-1448630360428-65456885c650", // tiny home
  ],
  2: [
    "photo-1570129477492-45c003edd2be", // suburban house
    "photo-1580587771525-78b9dba3b914", // family home
    "photo-1512917774080-9991f1c4c750", // suburban
    "photo-1576941089067-2de3c901e126", // townhouse
    "photo-1520637836862-4d197d17c55a", // starter home
    "photo-1505843513577-22bb7d21e455", // family starter
  ],
  3: [
    "photo-1564013799919-ab600027ffc6", // larger family home
    "photo-1600585154340-be6161a56a0c", // modern home
    "photo-1600596542815-ffad4c1539a9", // architect home
    "photo-1600607687939-ce8a6c25118c", // double storey
    "photo-1600566753190-17f0baa2a6c3", // mid-range
    "photo-1600585154526-990dced4db0d", // suburban executive
  ],
  4: [
    "photo-1613490493576-7fde63acd811", // luxury villa
    "photo-1600047509807-ba8f99d2cdde", // prestige home
    "photo-1613553474179-e1eda3ea5734", // estate
    "photo-1602343168117-bb8ffe3e2e9f", // executive home
    "photo-1600585154363-67eb9e2e2099", // upmarket
    "photo-1599809275671-b5942cabc7a2", // luxury exterior
  ],
  5: [
    "photo-1613977257363-707ba9348227", // mansion
    "photo-1613490493576-7fde63acd811", // trophy villa
    "photo-1577495508048-b635879837f1", // mansion estate
    "photo-1613977257592-4871e5fcd7c4", // luxury mansion
    "photo-1582268611958-ebfd161ef9cf", // beachfront mansion
    "photo-1600585154084-4e5fe7c39198", // architectural trophy
  ],
};

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getPropertyImageUrl(
  propertyId: string | undefined | null,
  listingPrice: number | undefined | null,
): string {
  const id = propertyId ?? "fallback";
  const price = Number(listingPrice ?? 0);
  const tier = (price > 0 ? tierForPrice(price).id : 1) as Tier;
  const pool = TIER_PHOTOS[tier] ?? TIER_PHOTOS[1];
  const photo = pool[hashId(id) % pool.length];
  return `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=800&h=600&q=70`;
}
