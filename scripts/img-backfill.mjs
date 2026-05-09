import { createClient } from '@supabase/supabase-js';
import { buildPool, TIER_TARGETS } from './img-pool.mjs';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function tierFor(price){if(price<400000)return 1;if(price<900000)return 2;if(price<2000000)return 3;if(price<5000000)return 4;return 5;}

const { data: props, error } = await sb.from('properties').select('id, tier, listing_price, created_at').order('created_at', { ascending: true });
if (error) { console.error(error); process.exit(1); }

// Group by tier
const byTier = { 1:[], 2:[], 3:[], 4:[], 5:[] };
for (const p of props) {
  const t = p.tier ?? tierFor(Number(p.listing_price));
  byTier[t].push(p);
}

// Build per-tier pool sized to actual count (>= TIER_TARGETS as floor)
const updates = [];
const allUrls = new Set();
for (const t of [1,2,3,4,5]) {
  const list = byTier[t];
  const need = Math.max(list.length, TIER_TARGETS[t]);
  const pool = buildPool(t, need);
  list.forEach((p, i) => {
    let url = pool[i];
    // Guarantee global uniqueness across all tiers
    let n = 2;
    while (allUrls.has(url)) {
      url = `${pool[i]}${pool[i].includes('?') ? '&' : '?'}t=${t}-${n++}`;
    }
    allUrls.add(url);
    updates.push({ id: p.id, image_url: url });
  });
  console.log(`Tier ${t}: ${list.length} properties, pool size ${pool.length}`);
}

let n=0;
for (let i=0;i<updates.length;i+=40) {
  const batch = updates.slice(i,i+40);
  await Promise.all(batch.map(u => sb.from('properties').update({ image_url: u.image_url }).eq('id', u.id)));
  n += batch.length;
}
console.log('total updated:', n, 'unique urls:', allUrls.size);
