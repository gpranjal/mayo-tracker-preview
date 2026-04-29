# Mayo Clinic Storefront — Analytics Preview

A static, single-page prototype dashboard for the **PK Health Gear × Mayo Clinic** corporate storefront tracker. It shows what the analytics layer could look like once the three missing events (`product_view`, `add_to_cart`, `form_submit`) are instrumented.

**Live preview:** https://gpranjal.github.io/mayo-tracker-preview/

> **Important.** The page renders synthetic data only. The numbers, sessions, and events you see are generated client-side by `data.js` from a seeded RNG — nothing is connected to the real Google Sheet, the real storefront, or any live tracker. The schema, however, mirrors the production sheet column-for-column, so the same `app.js` could be driven by real data later by replacing `data.js` with a Sheets API call.

## Why this exists

The first consult on the tracker recommended Looker Studio as the immediate dashboard layer (free, sits on top of the existing sheet, auto-refreshes). This prototype is the **next chapter** — what a custom branded experience looks like once the tracker is mature enough to graduate from Looker Studio. It is not meant to replace that recommendation; it is meant to make the future visible.

## What's in here

| File | Purpose |
|------|---------|
| `index.html` | Page layout, masthead, six analytics sections |
| `styles.css` | Design system. **All brand-specific colors and fonts are CSS variables** — re-themeing for another client is one file's worth of edits. |
| `data.js` | Seeded synthetic dataset (~1,400 sessions, ~30 days, schema-faithful). Aggregates feed `app.js`. |
| `app.js` | Chart initialization (ECharts), KPI count-up animations, live recent-activity ticker. |

## Re-themeing for another corporate client

Edit `:root` in `styles.css`. The visual identity — primary brand color, accent, surface tones, type pair — is tokenized so a new client (e.g., Cleveland Clinic, Intermountain) is a single token swap, not a rebuild.

## Running locally

No build step. Open `index.html` in any modern browser, or:

```bash
python3 -m http.server 8765    # http://localhost:8765
```

## Stack

Vanilla HTML, CSS, and JavaScript. ECharts via CDN for charts, Google Fonts (Fraunces, Inter Tight, IBM Plex Mono). No `node_modules`, no build, no runtime dependencies beyond two `<script>` tags.

## Schema reference

Columns expected (mirrors the live sheet):

```
Timestamp | Activity Type | Page URL | Page Title | Clicked Link | Link URL |
Button | Field Name | Entered Data | User ID | Session ID | Referrer |
Device Type | Device Info | Notes
```

Activity types in use (existing + recommended additions):

- `page_view`, `scroll`, `click`, `form_field_focus` (existing)
- `product_view`, `add_to_cart`, `form_submit` (recommended additions; see funnel section)
