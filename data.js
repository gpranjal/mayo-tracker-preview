// Synthetic event dataset for the Mayo Clinic tracker preview.
// Schema mirrors the live Google Sheet 1:1 so this file could be replaced
// with a Sheets API call later without touching app.js.
//
// Columns: Timestamp | Activity Type | Page URL | Page Title | Clicked Link |
//          Link URL | Button | Field Name | Entered Data | User ID |
//          Session ID | Referrer | Device Type | Device Info | Notes

const SEED = 0x4D41594F; // "MAYO"
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const range = (n) => Array.from({ length: n }, (_, i) => i);

// ---------- Catalog ----------

const SKUS = [
  { id: 'mc-scrub-navy', name: 'Mayo Navy Scrub Set', cat: 'scrubs', price: 84 },
  { id: 'mc-scrub-teal', name: 'Mayo Teal Scrub Set', cat: 'scrubs', price: 84 },
  { id: 'mc-scrub-grey', name: 'Mayo Graphite Scrub Set', cat: 'scrubs', price: 84 },
  { id: 'mc-scrub-petite', name: 'Mayo Petite-Fit Scrub', cat: 'scrubs', price: 92 },
  { id: 'mc-coat-mens', name: 'Mayo Embroidered Lab Coat (M)', cat: 'lab-coats', price: 128 },
  { id: 'mc-coat-womens', name: 'Mayo Embroidered Lab Coat (W)', cat: 'lab-coats', price: 128 },
  { id: 'mc-coat-long', name: 'Mayo Long Lab Coat', cat: 'lab-coats', price: 142 },
  { id: 'mc-coat-consult', name: 'Mayo Consult Coat', cat: 'lab-coats', price: 118 },
  { id: 'mc-fleece', name: 'Mayo Embroidered Fleece', cat: 'gear', price: 96 },
  { id: 'mc-quarterzip', name: 'Mayo Quarter-Zip Pullover', cat: 'gear', price: 78 },
  { id: 'mc-polo', name: 'Mayo Performance Polo', cat: 'gear', price: 54 },
  { id: 'mc-vest', name: 'Mayo Soft-Shell Vest', cat: 'gear', price: 88 },
  { id: 'mc-cap', name: 'Mayo Surgical Cap (3-pack)', cat: 'gear', price: 32 },
  { id: 'mc-bag', name: 'Mayo Embroidered Tote', cat: 'gear', price: 38 },
  { id: 'mc-mug', name: 'Mayo Stainless Tumbler', cat: 'gear', price: 28 },
];

const CATS = [
  { slug: 'scrubs', name: 'Scrubs' },
  { slug: 'lab-coats', name: 'Lab Coats' },
  { slug: 'gear', name: 'Embroidered Gear' },
];

const DEVICES = [
  { type: 'Mobile', info: 'iPhone 15 / Safari', weight: 28 },
  { type: 'Mobile', info: 'iPhone 14 / Safari', weight: 14 },
  { type: 'Mobile', info: 'Pixel 8 / Chrome', weight: 10 },
  { type: 'Mobile', info: 'Samsung S24 / Chrome', weight: 8 },
  { type: 'Desktop', info: 'macOS / Chrome', weight: 14 },
  { type: 'Desktop', info: 'Windows / Edge', weight: 10 },
  { type: 'Desktop', info: 'macOS / Safari', weight: 6 },
  { type: 'Tablet', info: 'iPad / Safari', weight: 8 },
  { type: 'Tablet', info: 'iPad / Chrome', weight: 2 },
];

const REFERRERS = [
  { src: 'mayoclinic.org/staff-store', weight: 32 },
  { src: 'newsletter.mayoclinic.org', weight: 16 },
  { src: 'google.com', weight: 14 },
  { src: 'linkedin.com', weight: 10 },
  { src: '(direct)', weight: 18 },
  { src: 'mail.google.com', weight: 6 },
  { src: 'm.facebook.com', weight: 4 },
];

function weightedPick(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rand() * total;
  for (const i of items) {
    r -= i.weight;
    if (r <= 0) return i;
  }
  return items[items.length - 1];
}

// ---------- Timing model ----------

const NOW = new Date('2026-04-29T20:00:00Z');
const DAYS = 30;

// Hourly traffic curve: lunch + evening peaks weekdays, flatter weekends
function hourWeight(date) {
  const dow = date.getUTCDay();
  const h = date.getUTCHours();
  const isWeekend = dow === 0 || dow === 6;
  if (isWeekend) return 0.3 + 0.4 * Math.sin((h / 24) * Math.PI);
  // weekday: bumps at noon (h=17 UTC = 12pm CT) and 8pm (h=1 UTC next day)
  const lunch = Math.exp(-Math.pow((h - 17) / 2.2, 2));
  const evening = Math.exp(-Math.pow((h - 1 + (h < 6 ? 0 : -24)) / 2.5, 2));
  const morning = Math.exp(-Math.pow((h - 14) / 3, 2)) * 0.6;
  return 0.15 + lunch * 1.4 + evening * 1.1 + morning * 0.7;
}

// ---------- Session generator ----------

function uid() {
  return 'u-' + Math.floor(rand() * 1e8).toString(36);
}
function sid() {
  return 's-' + Math.floor(rand() * 1e10).toString(36);
}

const ACTIVITY = {
  PAGE_VIEW: 'page_view',
  SCROLL: 'scroll',
  CLICK: 'click',
  PRODUCT_VIEW: 'product_view',
  ADD_TO_CART: 'add_to_cart',
  FORM_FIELD_FOCUS: 'form_field_focus',
  FORM_SUBMIT: 'form_submit',
};

// Funnel decay applied per session: 100% land, 28% view product,
// 12% add to cart, 4% submit form.
function generateSession(start, totalUsers) {
  const device = weightedPick(DEVICES);
  const ref = weightedPick(REFERRERS);
  const userIdx = Math.floor(rand() * totalUsers);
  const userId = `u-${userIdx.toString(36).padStart(5, '0')}`;
  const sessionId = sid();

  const events = [];
  let t = new Date(start);
  const push = (over) =>
    events.push({
      Timestamp: new Date(t).toISOString(),
      'Activity Type': over.type,
      'Page URL': over.url || '',
      'Page Title': over.title || '',
      'Clicked Link': over.clickedLink || '',
      'Link URL': over.linkUrl || '',
      Button: over.button || '',
      'Field Name': over.field || '',
      'Entered Data': over.entered || '',
      'User ID': userId,
      'Session ID': sessionId,
      Referrer: over.refOverride || ref.src,
      'Device Type': device.type,
      'Device Info': device.info,
      Notes: over.notes || '',
    });

  // Landing
  push({
    type: ACTIVITY.PAGE_VIEW,
    url: '/',
    title: 'PK Health Gear — Mayo Clinic Storefront',
  });
  // 4-7 scroll ticks per page sampled at 25/50/75/100
  const scrollMilestones = [25, 50, 75, 100];
  for (const m of scrollMilestones) {
    if (rand() < 0.78) {
      t = new Date(t.getTime() + 1500 + rand() * 4500);
      push({
        type: ACTIVITY.SCROLL,
        url: '/',
        title: 'PK Health Gear — Mayo Clinic Storefront',
        notes: `depth=${m}%`,
      });
    }
  }
  // Browse a category 70%
  if (rand() < 0.7) {
    const cat = pick(CATS);
    t = new Date(t.getTime() + 3000 + rand() * 6000);
    push({
      type: ACTIVITY.CLICK,
      url: '/',
      title: 'PK Health Gear — Mayo Clinic Storefront',
      clickedLink: cat.name,
      linkUrl: `/products/category/${cat.slug}`,
    });
    t = new Date(t.getTime() + 800 + rand() * 1500);
    push({
      type: ACTIVITY.PAGE_VIEW,
      url: `/products/category/${cat.slug}`,
      title: `${cat.name} — Mayo Clinic Storefront`,
    });
    for (const m of [25, 50, 75]) {
      if (rand() < 0.65) {
        t = new Date(t.getTime() + 1500 + rand() * 3500);
        push({
          type: ACTIVITY.SCROLL,
          url: `/products/category/${cat.slug}`,
          title: `${cat.name} — Mayo Clinic Storefront`,
          notes: `depth=${m}%`,
        });
      }
    }
    // Funnel: product_view 28% (subset of category browsers)
    if (rand() < 0.4) {
      // 0.7 * 0.4 ≈ 28%
      const skuPool = SKUS.filter((s) => s.cat === cat.slug);
      const sku = pick(skuPool.length ? skuPool : SKUS);
      t = new Date(t.getTime() + 2000 + rand() * 5000);
      push({
        type: ACTIVITY.CLICK,
        url: `/products/category/${cat.slug}`,
        title: `${cat.name} — Mayo Clinic Storefront`,
        clickedLink: sku.name,
        linkUrl: `/products/${sku.id}`,
      });
      t = new Date(t.getTime() + 800 + rand() * 1500);
      push({
        type: ACTIVITY.PAGE_VIEW,
        url: `/products/${sku.id}`,
        title: `${sku.name} — Mayo Clinic Storefront`,
      });
      // product_view event fires on PDP load
      push({
        type: ACTIVITY.PRODUCT_VIEW,
        url: `/products/${sku.id}`,
        title: `${sku.name} — Mayo Clinic Storefront`,
        notes: `sku=${sku.id}|category=${sku.cat}|price=${sku.price}`,
      });
      for (const m of [25, 50, 75, 100]) {
        if (rand() < 0.7) {
          t = new Date(t.getTime() + 1500 + rand() * 3500);
          push({
            type: ACTIVITY.SCROLL,
            url: `/products/${sku.id}`,
            title: `${sku.name} — Mayo Clinic Storefront`,
            notes: `depth=${m}%`,
          });
        }
      }
      // add_to_cart 43% of product viewers (yields 12% overall)
      if (rand() < 0.43) {
        t = new Date(t.getTime() + 3000 + rand() * 7000);
        push({
          type: ACTIVITY.ADD_TO_CART,
          url: `/products/${sku.id}`,
          title: `${sku.name} — Mayo Clinic Storefront`,
          button: 'Add to Cart',
          notes: `sku=${sku.id}|qty=1`,
        });
        // form starts 60% of add_to_cart
        if (rand() < 0.6) {
          t = new Date(t.getTime() + 2500 + rand() * 5000);
          push({
            type: ACTIVITY.PAGE_VIEW,
            url: '/inquiry',
            title: 'Inquiry — Mayo Clinic Storefront',
          });
          for (const f of ['name', 'email', 'org_unit', 'message']) {
            if (rand() < 0.92) {
              t = new Date(t.getTime() + 1200 + rand() * 4000);
              push({
                type: ACTIVITY.FORM_FIELD_FOCUS,
                url: '/inquiry',
                title: 'Inquiry — Mayo Clinic Storefront',
                field: f,
              });
            }
          }
          // form_submit 55% of starters (yields ~4% overall)
          if (rand() < 0.55) {
            t = new Date(t.getTime() + 4000 + rand() * 6000);
            push({
              type: ACTIVITY.FORM_SUBMIT,
              url: '/inquiry',
              title: 'Inquiry — Mayo Clinic Storefront',
              button: 'Send Inquiry',
              entered: '[redacted PII]',
              notes: `sku=${sku.id}|source=${ref.src}`,
            });
          }
        }
      }
    }
  }
  return events;
}

// ---------- Build dataset ----------

function buildDataset() {
  const events = [];
  const totalUsers = 980;
  // Sessions per day baseline ~46, anomalies on a few days
  for (let d = DAYS - 1; d >= 0; d--) {
    const dayBase = new Date(NOW);
    dayBase.setUTCDate(dayBase.getUTCDate() - d);
    dayBase.setUTCHours(0, 0, 0, 0);
    const dow = dayBase.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    let dailyTarget = isWeekend ? 24 : 50;
    // Anomaly: a small Mayo newsletter blast 9 days ago
    if (d === 9) dailyTarget = 124;
    // Anomaly: bot-shaped spike 3 days ago (lots of scroll, no conversions)
    let botMode = d === 3;

    for (let s = 0; s < dailyTarget; s++) {
      // pick an hour weighted by hour curve
      let h = 0;
      let attempts = 0;
      while (attempts++ < 20) {
        const candidate = Math.floor(rand() * 24);
        const probe = new Date(dayBase);
        probe.setUTCHours(candidate);
        if (rand() < hourWeight(probe) / 2.5) {
          h = candidate;
          break;
        }
      }
      const start = new Date(dayBase);
      start.setUTCHours(h, Math.floor(rand() * 60), Math.floor(rand() * 60));
      if (botMode) {
        // bot-style session: lots of scroll, no funnel progression
        const device = { type: 'Desktop', info: 'Linux / HeadlessChrome' };
        const sessionId = sid();
        const userId = 'u-bot-' + s.toString(36);
        let t = new Date(start);
        for (let k = 0; k < 14; k++) {
          events.push({
            Timestamp: new Date(t).toISOString(),
            'Activity Type': k === 0 ? ACTIVITY.PAGE_VIEW : ACTIVITY.SCROLL,
            'Page URL': '/',
            'Page Title': 'PK Health Gear — Mayo Clinic Storefront',
            'Clicked Link': '',
            'Link URL': '',
            Button: '',
            'Field Name': '',
            'Entered Data': '',
            'User ID': userId,
            'Session ID': sessionId,
            Referrer: '(direct)',
            'Device Type': device.type,
            'Device Info': device.info,
            Notes: k === 0 ? '' : `depth=${(k * 10) % 100}%`,
          });
          t = new Date(t.getTime() + 800 + rand() * 1200);
        }
      } else {
        events.push(...generateSession(start, totalUsers));
      }
    }
  }
  events.sort((a, b) => a.Timestamp.localeCompare(b.Timestamp));
  return events;
}

const EVENTS = buildDataset();

// ---------- Aggregations consumed by app.js ----------

const SESSION_INDEX = (() => {
  const map = new Map();
  for (const e of EVENTS) {
    const sid = e['Session ID'];
    if (!map.has(sid)) {
      map.set(sid, {
        sessionId: sid,
        userId: e['User ID'],
        deviceType: e['Device Type'],
        referrer: e.Referrer,
        start: e.Timestamp,
        end: e.Timestamp,
        events: 0,
        sawProduct: false,
        addedToCart: false,
        submitted: false,
      });
    }
    const s = map.get(sid);
    s.events++;
    s.end = e.Timestamp;
    if (e['Activity Type'] === ACTIVITY.PRODUCT_VIEW) s.sawProduct = true;
    if (e['Activity Type'] === ACTIVITY.ADD_TO_CART) s.addedToCart = true;
    if (e['Activity Type'] === ACTIVITY.FORM_SUBMIT) s.submitted = true;
  }
  return map;
})();

const SESSIONS = [...SESSION_INDEX.values()];

const KPI = (() => {
  const sessions = SESSIONS.length;
  const submitted = SESSIONS.filter((s) => s.submitted).length;
  const conv = sessions ? (submitted / sessions) * 100 : 0;
  const lengths = SESSIONS.map(
    (s) => (new Date(s.end) - new Date(s.start)) / 1000
  ).filter((n) => n > 0);
  const avgLen = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
  // top SKU by product_view
  const skuCount = new Map();
  for (const e of EVENTS) {
    if (e['Activity Type'] === ACTIVITY.PRODUCT_VIEW) {
      const m = /sku=([^|]+)/.exec(e.Notes);
      if (m) skuCount.set(m[1], (skuCount.get(m[1]) || 0) + 1);
    }
  }
  let topSku = null;
  let topCount = 0;
  for (const [k, v] of skuCount) {
    if (v > topCount) {
      topCount = v;
      topSku = k;
    }
  }
  const topSkuRow = SKUS.find((s) => s.id === topSku);
  return {
    sessions,
    avgLenSec: Math.round(avgLen),
    convPct: +conv.toFixed(2),
    topSku: topSkuRow ? topSkuRow.name : '—',
    topSkuViews: topCount,
  };
})();

const FUNNEL = (() => {
  const sessions = SESSIONS.length;
  const productViews = SESSIONS.filter((s) => s.sawProduct).length;
  const addToCart = SESSIONS.filter((s) => s.addedToCart).length;
  // Form starts: any FORM_FIELD_FOCUS in session
  const formStarters = new Set();
  for (const e of EVENTS) {
    if (e['Activity Type'] === ACTIVITY.FORM_FIELD_FOCUS) {
      formStarters.add(e['Session ID']);
    }
  }
  const submits = SESSIONS.filter((s) => s.submitted).length;
  return [
    { stage: 'Sessions', value: sessions },
    { stage: 'Product views', value: productViews },
    { stage: 'Add to cart', value: addToCart },
    { stage: 'Form starts', value: formStarters.size },
    { stage: 'Form submits', value: submits },
  ];
})();

const HOURLY = (() => {
  // 7 (Sun..Sat) x 24 matrix
  const m = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const s of SESSIONS) {
    const d = new Date(s.start);
    m[d.getUTCDay()][d.getUTCHours()]++;
  }
  return m;
})();

const DEVICE_SPLIT = (() => {
  const m = new Map();
  for (const s of SESSIONS) {
    m.set(s.deviceType, (m.get(s.deviceType) || 0) + 1);
  }
  return [...m.entries()].map(([name, value]) => ({ name, value }));
})();

const ACTIVITY_TOP = (() => {
  const m = new Map();
  for (const e of EVENTS) {
    const k = e['Activity Type'];
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
})();

const SCROLL_DEPTH = (() => {
  // For each Page URL, distribution of max depth reached per session
  const perPageSessions = new Map();
  for (const e of EVENTS) {
    if (e['Activity Type'] !== ACTIVITY.SCROLL) continue;
    const m = /depth=(\d+)%/.exec(e.Notes);
    if (!m) continue;
    const depth = +m[1];
    const key = e['Page URL'];
    const sid = e['Session ID'];
    if (!perPageSessions.has(key)) perPageSessions.set(key, new Map());
    const sessionMap = perPageSessions.get(key);
    if (!sessionMap.has(sid) || sessionMap.get(sid) < depth) {
      sessionMap.set(sid, depth);
    }
  }
  // Roll up
  const rows = [];
  for (const [page, sessionMap] of perPageSessions.entries()) {
    const tally = { 25: 0, 50: 0, 75: 0, 100: 0 };
    for (const d of sessionMap.values()) {
      if (d >= 100) tally[100]++;
      else if (d >= 75) tally[75]++;
      else if (d >= 50) tally[50]++;
      else tally[25]++;
    }
    const total = Object.values(tally).reduce((a, b) => a + b, 0);
    rows.push({ page, total, ...tally });
  }
  rows.sort((a, b) => b.total - a.total);
  return rows.slice(0, 6);
})();

// Sample from the last ~24h of events, prioritizing variety so the live
// ticker doesn't show 20 consecutive scrolls from one session.
const RECENT = (() => {
  const tail = EVENTS.slice(-600).reverse();
  const hot = tail.filter((e) =>
    ['form_submit', 'add_to_cart', 'product_view'].includes(e['Activity Type'])
  );
  const warm = tail.filter((e) =>
    ['click', 'page_view', 'form_field_focus'].includes(e['Activity Type'])
  );
  const cool = tail.filter((e) => e['Activity Type'] === 'scroll');
  const out = [];
  let i = 0;
  while (out.length < 80) {
    const slot = i % 6;
    if (slot === 0 && hot.length) out.push(hot.shift());
    else if (slot === 3 && cool.length) out.push(cool.shift());
    else if (warm.length) out.push(warm.shift());
    else if (cool.length) out.push(cool.shift());
    else if (hot.length) out.push(hot.shift());
    else break;
    i++;
  }
  return out;
})();

window.MAYO_DATA = {
  EVENTS,
  SESSIONS,
  KPI,
  FUNNEL,
  HOURLY,
  DEVICE_SPLIT,
  ACTIVITY_TOP,
  SCROLL_DEPTH,
  RECENT,
  SKUS,
};
