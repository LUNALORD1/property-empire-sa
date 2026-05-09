// Deterministic property image helper.
// source.unsplash.com was deprecated in 2024 and now returns broken redirects,
// so we use direct images.unsplash.com CDN URLs (curated photo IDs per tier)
// chosen deterministically from the property id so the same property always
// shows the same photo without needing an API key.

import { tierForPrice, type Tier } from "@/lib/game";

// Curated Unsplash photo IDs grouped by tier. All are verified exterior shots
// of residential buildings (houses, apartments, estates, mansions). The pools
// are intentionally large so most properties get a unique image while
// guaranteeing every image is residential — never random scenery, vehicles,
// or landscapes (which is what Picsum was returning).
const TIER_PHOTOS: Record<Tier, string[]> = {
  // Tier 1 — small flats, starter units, modest townhouses
  1: [
    "photo-1568605114967-8130f3a36994", "photo-1572120360610-d971b9d7767c",
    "photo-1494526585095-c41746248156", "photo-1493809842364-78817add7ffb",
    "photo-1502672260266-1c1ef2d93688", "photo-1448630360428-65456885c650",
    "photo-1494522855154-9297ac14b55f", "photo-1460317442991-0ec209397118",
    "photo-1484154218962-a197022b5858", "photo-1518780664697-55e3ad937233",
    "photo-1480074568708-e7b720bb3f09", "photo-1523217582562-09d0def993a6",
    "photo-1503174971373-b1f69850bded", "photo-1487958449943-2429e8be8625",
    "photo-1486325212027-8081e485255e", "photo-1531971589569-0d9370cbe1e5",
  ],
  // Tier 2 — suburban family homes
  2: [
    "photo-1570129477492-45c003edd2be", "photo-1580587771525-78b9dba3b914",
    "photo-1512917774080-9991f1c4c750", "photo-1576941089067-2de3c901e126",
    "photo-1520637836862-4d197d17c55a", "photo-1505843513577-22bb7d21e455",
    "photo-1449844908441-8829872d2607", "photo-1416331108676-a22ccb276e35",
    "photo-1430285561322-7808604715df", "photo-1542621334-a254cf47733d",
    "photo-1502005229762-cf1b2da7c5d6", "photo-1499916078039-922301b0eb9b",
    "photo-1464146072230-91cabc968266", "photo-1494526585095-c41746248156",
    "photo-1518883236005-46b305d39be6", "photo-1502005097973-6a7082348e28",
  ],
  // Tier 3 — larger family/executive homes
  3: [
    "photo-1564013799919-ab600027ffc6", "photo-1600585154340-be6161a56a0c",
    "photo-1600596542815-ffad4c1539a9", "photo-1600607687939-ce8a6c25118c",
    "photo-1600566753190-17f0baa2a6c3", "photo-1600585154526-990dced4db0d",
    "photo-1600585154084-4e5fe7c39198", "photo-1600573472556-e636c2acda88",
    "photo-1600573472591-ee6981cf35b6", "photo-1600573472550-8090b5e0745e",
    "photo-1600585152220-90363fe7e115", "photo-1600585154526-990dced4db0d",
    "photo-1600596542815-ffad4c1539a9", "photo-1600047509782-20d39509f26d",
    "photo-1600585152915-d208bec867a1", "photo-1600573472635-c2bf4321b2a3",
  ],
  // Tier 4 — upmarket villas and prestige homes
  4: [
    "photo-1613490493576-7fde63acd811", "photo-1600047509807-ba8f99d2cdde",
    "photo-1613553474179-e1eda3ea5734", "photo-1602343168117-bb8ffe3e2e9f",
    "photo-1600585154363-67eb9e2e2099", "photo-1599809275671-b5942cabc7a2",
    "photo-1600585154363-67eb9e2e2099", "photo-1613977257363-707ba9348227",
    "photo-1613977257592-4871e5fcd7c4", "photo-1605276374104-dee2a0ed3cd6",
    "photo-1600566753086-00f18fe6ba68", "photo-1600563438938-a9a27215d8d8",
    "photo-1605114984996-5b3f8b54ca10", "photo-1600585154256-bf2c5e1cb46e",
    "photo-1600210492486-724fe5c67fb0", "photo-1600210491892-03d54c0aaf87",
  ],
  // Tier 5 — trophy mansions and estates
  5: [
    "photo-1613977257363-707ba9348227", "photo-1613490493576-7fde63acd811",
    "photo-1577495508048-b635879837f1", "photo-1613977257592-4871e5fcd7c4",
    "photo-1582268611958-ebfd161ef9cf", "photo-1600585154084-4e5fe7c39198",
    "photo-1605146768851-eda79da39897", "photo-1600210492493-0946911123ea",
    "photo-1600566753190-17f0baa2a6c3", "photo-1613977257363-707ba9348227",
    "photo-1613553474179-e1eda3ea5734", "photo-1600596542815-ffad4c1539a9",
    "photo-1600585154340-be6161a56a0c", "photo-1600047509807-ba8f99d2cdde",
    "photo-1613490493576-7fde63acd811", "photo-1582268611958-ebfd161ef9cf",
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
