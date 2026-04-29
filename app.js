// ===== Theme tokens read from CSS variables (single source of truth) =====
const css = getComputedStyle(document.documentElement);
const T = {
  ink: css.getPropertyValue('--ink').trim(),
  ink2: css.getPropertyValue('--ink-2').trim(),
  ink3: css.getPropertyValue('--ink-3').trim(),
  rule: css.getPropertyValue('--rule').trim(),
  ruleStrong: css.getPropertyValue('--rule-strong').trim(),
  brand: css.getPropertyValue('--brand').trim(),
  brand2: css.getPropertyValue('--brand-2').trim(),
  brandSoft: css.getPropertyValue('--brand-soft').trim(),
  accent: css.getPropertyValue('--accent').trim(),
  accentSoft: css.getPropertyValue('--accent-soft').trim(),
  positive: css.getPropertyValue('--positive').trim(),
  surface: css.getPropertyValue('--surface').trim(),
  surface2: css.getPropertyValue('--surface-2').trim(),
  fontBody: css.getPropertyValue('--font-body').trim().replace(/['"]/g, ''),
  fontMono: css.getPropertyValue('--font-mono').trim().replace(/['"]/g, ''),
};

const baseTextStyle = {
  fontFamily: T.fontBody,
  color: T.ink2,
  fontSize: 12,
};

const baseTooltip = {
  backgroundColor: T.surface,
  borderColor: T.ruleStrong,
  borderWidth: 1,
  textStyle: { color: T.ink, fontFamily: T.fontBody, fontSize: 12 },
  padding: [10, 12],
  extraCssText: 'box-shadow: 0 8px 24px rgba(20,20,30,0.06); border-radius:6px;',
};

const D = window.MAYO_DATA;

// ===== Helpers =====
const fmtInt = (n) => n.toLocaleString('en-US');
const fmtMs = (sec) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

function animateCounter(el, target, decimals = 0, duration = 1100) {
  const start = performance.now();
  const unit = el.querySelector('.unit');
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const v = target * eased;
    const text = decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString('en-US');
    if (unit) {
      el.firstChild.nodeValue = text;
    } else {
      el.textContent = text;
    }
    if (t < 1) requestAnimationFrame(step);
  }
  // Make sure unit (if any) stays in DOM
  if (unit) {
    el.firstChild.nodeValue = '0';
  } else {
    el.textContent = '0';
  }
  requestAnimationFrame(step);
}

// ===== KPI population =====
function renderKPIs() {
  const counters = document.querySelectorAll('[data-counter]');
  counters[0].dataset.target = D.KPI.sessions;
  counters[1].dataset.target = D.KPI.convPct;

  animateCounter(counters[0], D.KPI.sessions, 0);
  animateCounter(counters[1], D.KPI.convPct, 2);

  document.getElementById('v-session-len').textContent = fmtMs(D.KPI.avgLenSec);
  document.getElementById('v-top-sku').textContent = D.KPI.topSku;
  document.getElementById('v-top-sku-sub').textContent = `${fmtInt(
    D.KPI.topSkuViews
  )} product views`;

  // Synthetic deltas — for prototype believability only
  document.getElementById('d-sessions').textContent = '+18%';
  document.getElementById('d-len').textContent = '+6%';
  document.getElementById('d-conv').textContent = '+0.4 pts';

  document.getElementById('last-refresh').textContent =
    new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
}

// ===== Chart: Funnel =====
function renderFunnel() {
  const el = document.getElementById('chart-funnel');
  const chart = echarts.init(el);
  const data = D.FUNNEL.map((d, i) => ({
    name: d.stage,
    value: d.value,
    itemStyle: {
      color:
        i === 4
          ? T.brand
          : i === 3
          ? T.brand2
          : i === 0
          ? '#A8B0C4'
          : i === 1
          ? '#7E8AAE'
          : '#5A698F',
    },
  }));
  const top = data[0].value;
  chart.setOption({
    textStyle: baseTextStyle,
    tooltip: {
      ...baseTooltip,
      formatter: (p) =>
        `<div style="font-family:${T.fontBody}; font-size:12px;"><b>${p.name}</b><br>${fmtInt(
          p.value
        )} sessions · ${(p.value / top * 100).toFixed(1)}% of top</div>`,
    },
    series: [
      {
        type: 'funnel',
        left: '6%',
        right: '20%',
        top: 10,
        bottom: 10,
        width: '74%',
        gap: 4,
        sort: 'descending',
        minSize: '14%',
        label: {
          show: true,
          position: 'right',
          formatter: (p) =>
            `{name|${p.name}}\n{val|${fmtInt(p.value)}} {pct|${(
              (p.value / top) *
              100
            ).toFixed(1)}%}`,
          rich: {
            name: {
              fontFamily: T.fontBody,
              fontSize: 13,
              color: T.ink,
              fontWeight: 500,
              lineHeight: 18,
            },
            val: {
              fontFamily: T.fontMono,
              fontSize: 12,
              color: T.ink2,
            },
            pct: {
              fontFamily: T.fontMono,
              fontSize: 11,
              color: T.ink3,
              padding: [0, 0, 0, 6],
            },
          },
        },
        labelLine: {
          length: 18,
          lineStyle: { color: T.ruleStrong },
        },
        emphasis: { label: { fontWeight: 600 } },
        data,
      },
    ],
  });
  window.addEventListener('resize', () => chart.resize());
}

// ===== Chart: Hourly heatmap (7 x 24) =====
function renderHourly() {
  const el = document.getElementById('chart-hourly');
  const chart = echarts.init(el);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, h) =>
    h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`
  );
  const data = [];
  let max = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const v = D.HOURLY[d][h];
      if (v > max) max = v;
      data.push([h, d, v]);
    }
  }
  chart.setOption({
    textStyle: baseTextStyle,
    tooltip: {
      ...baseTooltip,
      formatter: (p) => {
        const [h, d, v] = p.data;
        return `<b>${days[d]} · ${hours[h]}</b><br>${fmtInt(v)} sessions`;
      },
    },
    grid: { left: 44, right: 16, top: 12, bottom: 30 },
    xAxis: {
      type: 'category',
      data: hours,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: T.rule } },
      axisLabel: {
        color: T.ink3,
        fontSize: 10,
        fontFamily: T.fontMono,
        interval: 1,
      },
    },
    yAxis: {
      type: 'category',
      data: days,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: {
        color: T.ink2,
        fontSize: 11,
        fontFamily: T.fontMono,
      },
    },
    visualMap: {
      min: 0,
      max: max,
      show: false,
      inRange: {
        color: ['#FAFAF7', '#DDE1EC', '#A8B0C4', T.brand2, T.brand],
      },
    },
    series: [
      {
        type: 'heatmap',
        data,
        itemStyle: { borderColor: T.bg, borderWidth: 1, borderRadius: 1 },
        emphasis: {
          itemStyle: { borderColor: T.accent, borderWidth: 1.5 },
        },
      },
    ],
  });
  window.addEventListener('resize', () => chart.resize());
}

// ===== Chart: Top events =====
function renderEvents() {
  const el = document.getElementById('chart-events');
  const chart = echarts.init(el);
  const top = D.ACTIVITY_TOP;
  const labels = top.map((d) => d.name);
  const values = top.map((d) => d.value);
  const isAnomaly = (name, v) => name === 'scroll' && v > 4000;
  chart.setOption({
    textStyle: baseTextStyle,
    tooltip: {
      ...baseTooltip,
      formatter: (p) =>
        `<b>${p.name}</b><br>${fmtInt(p.value)} events`,
    },
    grid: { left: 130, right: 32, top: 16, bottom: 24 },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: T.rule, type: 'dashed' } },
      axisLabel: {
        color: T.ink3,
        fontSize: 10,
        fontFamily: T.fontMono,
        formatter: (v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v),
      },
    },
    yAxis: {
      type: 'category',
      data: labels.slice().reverse(),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: T.ink,
        fontSize: 12,
        fontFamily: T.fontMono,
      },
    },
    series: [
      {
        type: 'bar',
        data: values
          .slice()
          .reverse()
          .map((v, i) => {
            const name = labels.slice().reverse()[i];
            return {
              value: v,
              itemStyle: {
                color: isAnomaly(name, v) ? T.accent : T.brand,
                borderRadius: [0, 3, 3, 0],
              },
            };
          }),
        barWidth: 16,
        label: {
          show: true,
          position: 'right',
          color: T.ink2,
          fontFamily: T.fontMono,
          fontSize: 11,
          formatter: (p) => fmtInt(p.value),
        },
      },
    ],
  });
  window.addEventListener('resize', () => chart.resize());
}

// ===== Chart: Devices donut =====
function renderDevices() {
  const el = document.getElementById('chart-devices');
  const chart = echarts.init(el);
  const palette = {
    Mobile: T.brand,
    Desktop: T.brand2,
    Tablet: '#A8B0C4',
  };
  const data = D.DEVICE_SPLIT.map((d) => ({
    name: d.name,
    value: d.value,
    itemStyle: { color: palette[d.name] || T.brand2 },
  }));
  const total = data.reduce((a, b) => a + b.value, 0);
  chart.setOption({
    textStyle: baseTextStyle,
    tooltip: {
      ...baseTooltip,
      formatter: (p) =>
        `<b>${p.name}</b><br>${fmtInt(p.value)} sessions · ${(
          (p.value / total) *
          100
        ).toFixed(1)}%`,
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: T.ink2, fontFamily: T.fontMono, fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: ['58%', '78%'],
        center: ['50%', '46%'],
        avoidLabelOverlap: true,
        label: {
          show: true,
          position: 'center',
          formatter: () =>
            `{big|${fmtInt(total)}}\n{small|sessions · 30 days}`,
          rich: {
            big: {
              fontFamily: T.fontBody,
              fontSize: 30,
              color: T.ink,
              fontWeight: 500,
              lineHeight: 36,
            },
            small: {
              fontFamily: T.fontMono,
              fontSize: 10,
              color: T.ink3,
              letterSpacing: 1.5,
            },
          },
        },
        labelLine: { show: false },
        emphasis: {
          label: { show: true, position: 'center' },
          scale: false,
        },
        data,
      },
    ],
  });
  window.addEventListener('resize', () => chart.resize());
}

// ===== Chart: Scroll depth (stacked horizontal bar) =====
function renderScroll() {
  const el = document.getElementById('chart-scroll');
  const chart = echarts.init(el);
  const rows = D.SCROLL_DEPTH;
  const labels = rows.map((r) => r.page);
  const series = ['25', '50', '75', '100'].map((band, i) => ({
    name: `${band}%`,
    type: 'bar',
    stack: 'depth',
    data: rows.map((r) => r[band]),
    itemStyle: {
      color: ['#E8ECF4', '#A8B0C4', T.brand2, T.brand][i],
    },
    barWidth: 22,
    label: {
      show: i === 3,
      position: 'right',
      color: T.ink2,
      fontFamily: T.fontMono,
      fontSize: 11,
      formatter: (p) => fmtInt(rows[p.dataIndex].total),
    },
  }));
  chart.setOption({
    textStyle: baseTextStyle,
    tooltip: {
      ...baseTooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const idx = params[0].dataIndex;
        const r = rows[idx];
        return `<b>${r.page}</b><br>` +
          ['25', '50', '75', '100']
            .map(
              (b) => `<span style="color:${T.ink3};">≥${b}%</span> ${fmtInt(r[b])}`
            )
            .join('<br>');
      },
    },
    legend: {
      bottom: 0,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 4,
      textStyle: { color: T.ink2, fontFamily: T.fontMono, fontSize: 11 },
      formatter: (n) => `≥${n}`,
    },
    grid: { left: 280, right: 60, top: 16, bottom: 56 },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: T.rule, type: 'dashed' } },
      axisLabel: {
        color: T.ink3,
        fontSize: 10,
        fontFamily: T.fontMono,
      },
    },
    yAxis: {
      type: 'category',
      data: labels,
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: T.ink,
        fontSize: 12,
        fontFamily: T.fontMono,
        width: 250,
        overflow: 'truncate',
      },
    },
    series,
  });
  window.addEventListener('resize', () => chart.resize());
}

// ===== Live recent activity feed =====
const FEED_LIMIT = 20;
const HOT_TYPES = new Set(['form_submit', 'add_to_cart', 'product_view']);

function shortType(t) {
  return t.replace(/_/g, ' ');
}
function shortPage(url) {
  if (!url) return '';
  if (url === '/') return '/ (home)';
  return url.length > 40 ? url.slice(0, 38) + '…' : url;
}
function relTime(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'now';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function renderFeedRow(e, fresh) {
  const li = document.createElement('li');
  if (fresh) li.classList.add('fresh');
  const type = e['Activity Type'];
  const isHot = HOT_TYPES.has(type);
  li.innerHTML = `
    <span class="when">${relTime(e.Timestamp)}</span>
    <span class="what">
      <span class="type ${isHot ? 'hot' : ''}">${shortType(type)}</span>
      <span>${shortPage(e['Page URL'])}</span>
      <span class="meta">
        ${e['Device Type']} · ${e.Referrer || '(direct)'}${
          e.Notes ? ` · ${e.Notes.replace(/sku=([^|]+).*/, 'sku=$1')}` : ''
        }
      </span>
    </span>
  `;
  return li;
}

function renderFeed() {
  const ul = document.getElementById('feed');
  ul.innerHTML = '';
  D.RECENT.slice(0, FEED_LIMIT).forEach((e) => {
    ul.appendChild(renderFeedRow(e, false));
  });
  document.getElementById('feed-clock').textContent = 'live · syncing';

  let cursor = FEED_LIMIT;
  setInterval(() => {
    const next = D.RECENT[cursor % D.RECENT.length];
    cursor++;
    // Make it look like the new event "just happened"
    const synth = { ...next, Timestamp: new Date().toISOString() };
    const li = renderFeedRow(synth, true);
    ul.insertBefore(li, ul.firstChild);
    while (ul.children.length > FEED_LIMIT) ul.removeChild(ul.lastChild);

    // Update the clock pill
    document.getElementById('feed-clock').textContent =
      'live · ' +
      new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      });

    // Refresh relative timestamps in older rows
    [...ul.querySelectorAll('li .when')].forEach((node, i) => {
      if (i === 0) return;
      const event = D.RECENT[(cursor - 1 - i + D.RECENT.length) % D.RECENT.length];
      // Keep it simple — just slowly age them
      node.textContent = `${i * 4}s ago`;
    });
  }, 4000);
}

// ===== Boot =====
document.addEventListener('DOMContentLoaded', () => {
  renderKPIs();
  renderFunnel();
  renderHourly();
  renderEvents();
  renderDevices();
  renderScroll();
  renderFeed();
});
