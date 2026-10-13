// Portofolio tab: prop-firm rule meters, balance curve, statistics, P/L calendar, breakdowns.
import { computeStats, breakdown, localStamp, dayFnFor, pad } from "./core.js";
import { state, update, cfg, accountTrades } from "./store.js";
import { $, fmt, usd, pct, cls, esc } from "./ui.js";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
let chart = null;
let calMonth = localStamp().slice(0, 7);

export function initPortfolio() {
  $("p-calPrev").addEventListener("click", () => { calMonth = shiftMonth(calMonth, -1); renderCalendar(computeStats(accountTrades(), cfg())); });
  $("p-calNext").addEventListener("click", () => { calMonth = shiftMonth(calMonth, 1); renderCalendar(computeStats(accountTrades(), cfg())); });
  $("p-breakSeg").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    update(s => { s.ui.breakdown = b.dataset.k; }, { silent: true });
    renderBreakdown();
  });
}

function shiftMonth(m, by) {
  const d = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + by, 1);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1);
}

export function renderPortfolio() {
  const s = computeStats(accountTrades(), cfg());
  renderRules(s);
  renderChart(s);
  renderStats(s);
  renderCalendar(s);
  renderBreakdown();
}

function bar(p, tone) {
  const w = Math.max(0, Math.min(100, p || 0));
  return '<div class="bar ' + tone + '"><i style="width:' + w + '%"></i></div>';
}

function renderRules(s) {
  const st = cfg();
  const cards = [];
  cards.push('<div class="rule"><span class="section-label">' + esc(st.name) + " · " + esc(st.phase) + "</span>" +
    '<span class="big">' + usd(s.balance) + "</span>" +
    '<div class="row"><span>Net P/L</span><b class="' + cls(s.net) + '">' + usd(s.net, 2, true) + " (" + pct(s.netPct, 2, true) + ")</b></div>" +
    '<div class="row"><span>Balance tertinggi</span><b>' + usd(s.peak) + "</b></div></div>");

  if (s.target) {
    const done = s.target.remaining <= 0;
    cards.push('<div class="rule"><span class="section-label">Profit target ' + pct(st.profitTargetPct, 1) + "</span>" +
      '<span class="big">' + pct(Math.max(0, s.target.progress), 0) + "</span>" + bar(s.target.progress, "good") +
      '<div class="row"><span>' + (done ? "Target tercapai" : "Sisa") + "</span><b>" + (done ? usd(s.target.goal, 0) : usd(s.target.remaining)) + "</b></div></div>");
  }

  if (s.today.limit > 0) {
    const used = s.today.used, tone = used >= 100 ? "bad" : used >= 50 ? "warn" : "good";
    cards.push('<div class="rule ' + (used >= 100 ? "danger" : used >= 50 ? "warn" : "") + '"><span class="section-label">Daily loss hari ini</span>' +
      '<span class="big ' + cls(s.today.pnl) + '">' + usd(s.today.pnl, 2, true) + "</span>" + bar(used, tone) +
      '<div class="row"><span>Terpakai</span><b>' + pct(used, 0) + " dari " + usd(s.today.limit, 0) + "</b></div>" +
      '<div class="row"><span>Sisa jatah' + (s.openRisk > 0 ? " (minus risiko open)" : "") + "</span><b>" + usd(Math.max(0, s.today.remaining), 0) + "</b></div></div>");
  }

  if (s.maxLoss.limit > 0) {
    const used = s.maxLoss.used, tone = used >= 80 ? "bad" : used >= 50 ? "warn" : "good";
    cards.push('<div class="rule ' + (used >= 80 ? "danger" : used >= 50 ? "warn" : "") + '"><span class="section-label">Max loss ' + (st.maxLossType === "trailing" ? "trailing" : "statis") + "</span>" +
      '<span class="big">' + usd(s.maxLoss.distance, 0) + "</span>" + bar(used, tone) +
      '<div class="row"><span>Jarak ke batas · terpakai</span><b>' + pct(used, 0) + " dari " + usd(s.maxLoss.limit, 0) + "</b></div>" +
      '<div class="row"><span>Balance tidak boleh di bawah</span><b>' + usd(s.maxLoss.floor, 0) + "</b></div></div>");
  }
  if (s.consistency) {
    const c = s.consistency;
    const ratioTxt = c.ratio === null ? "—" : pct(c.ratio, 0);
    cards.push('<div class="rule ' + (c.ok ? "" : "warn") + '"><span class="section-label">Consistency rule ' + pct(c.limitPct, 0) + "</span>" +
      '<span class="big ' + (c.ok ? "pos" : "") + '">' + (c.ok ? "Aman" : "Belum") + "</span>" +
      bar(c.ratio === null ? (c.bestDay > 0 ? 100 : 0) : c.ratio / c.limitPct * 100, c.ok ? "good" : "warn") +
      '<div class="row"><span>Hari terbaik / total profit</span><b>' + usd(c.bestDay, 0) + " · " + ratioTxt + "</b></div>" +
      '<div class="row"><span>' + (c.ok ? "Total profit minimal" : "Perlu profit tambahan") + "</span><b>" + (c.ok ? usd(c.needed, 0) : usd(c.shortfall, 0)) + "</b></div></div>");
  }

  if (s.payout) {
    const p = s.payout;
    cards.push('<div class="rule"><span class="section-label">Withdraw</span>' +
      '<span class="big ' + (p.eligible ? "pos" : "") + '">' + (p.eligible ? usd(p.amount, 0) : "Belum bisa") + "</span>" +
      bar(p.min > 0 ? s.net / p.min * 100 : 0, p.eligible ? "good" : "") +
      '<div class="row"><span>Minimal profit untuk withdraw</span><b>' + usd(p.min, 0) + "</b></div>" +
      (p.cap > 0 ? '<div class="row"><span>Maksimal per withdraw</span><b>' + usd(p.cap, 0) + "</b></div>" : "") +
      (s.consistency && !s.consistency.ok ? '<div class="row"><span>Syarat consistency belum terpenuhi</span></div>' : "") + "</div>");
  }
  $("p-rules").innerHTML = cards.join("");
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function renderChart(s) {
  const canvas = $("p-chart");
  if (!window.Chart) { $("p-chartNote").textContent = "Grafik butuh koneksi internet saat pertama dibuka."; return; }
  $("p-chartNote").textContent = s.n ? s.n + " trade selesai" : "Grafik muncul setelah ada trade yang ditutup.";
  const c = { ink: cssVar("--ink"), muted: cssVar("--muted"), line: cssVar("--line"), brass: cssVar("--brass"), sell: cssVar("--sell"), buy: cssVar("--buy"), soft: cssVar("--brass-soft") };
  const labels = s.curve.map((p, i) => (i === 0 ? "Awal" : "#" + i));
  const datasets = [
    { label: "Balance", data: s.curve.map(p => p.bal), borderColor: c.brass, backgroundColor: c.soft, fill: true, tension: 0.15, pointRadius: s.curve.length > 60 ? 0 : 3, pointHoverRadius: 5, borderWidth: 2 },
  ];
  if (cfg().maxLossPct > 0) {
    datasets.push({ label: "Batas max loss", data: s.curve.map(p => p.floor), borderColor: c.sell, borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, stepped: true, fill: false });
  }
  if (s.target) {
    datasets.push({ label: "Profit target", data: s.curve.map(() => s.target.goal), borderColor: c.buy, borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, fill: false });
  }
  const opts = {
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { labels: { color: c.muted, boxWidth: 14, font: { family: "Figtree" } } },
      tooltip: {
        callbacks: {
          title: items => { const p = s.curve[items[0].dataIndex]; return p.trade ? p.label + " · " + p.trade.pair + " " + p.trade.dir : "Balance awal"; },
          label: it => it.dataset.label + ": " + usd(it.parsed.y),
          afterBody: items => { const p = s.curve[items[0].dataIndex]; return p.trade ? "P/L trade: " + usd(p.trade.pnl, 2, true) : ""; },
        },
      },
    },
    scales: {
      x: { ticks: { color: c.muted, maxTicksLimit: 10, font: { family: "JetBrains Mono", size: 11 } }, grid: { display: false }, border: { color: c.line } },
      y: { ticks: { color: c.muted, font: { family: "JetBrains Mono", size: 11 }, callback: v => "$" + Number(v).toLocaleString("en-US") }, grid: { color: c.line }, border: { display: false } },
    },
  };
  if (chart) chart.destroy();
  chart = new window.Chart(canvas, { type: "line", data: { labels, datasets }, options: opts });
}

function renderStats(s) {
  const pf = s.profitFactor === Infinity ? "∞" : s.profitFactor === null ? "—" : fmt(s.profitFactor, 2);
  const items = [
    ["Trade selesai", s.n + (s.n ? " (" + s.nWin + "W " + s.nLoss + "L" + (s.nBe ? " " + s.nBe + "BE" : "") + ")" : ""), ""],
    ["Win rate", s.winRate === null ? "—" : pct(s.winRate, 1), ""],
    ["Profit factor", pf, s.profitFactor === null ? "" : s.profitFactor >= 1 ? "pos" : "neg"],
    ["Expectancy / trade", s.expectancy === null ? "—" : usd(s.expectancy, 2, true), cls(s.expectancy)],
    ["Rata-rata R", s.avgR === null ? "—" : (s.avgR > 0 ? "+" : "") + fmt(s.avgR, 2) + "R", cls(s.avgR)],
    ["Rata-rata profit", s.avgWin === null ? "—" : usd(s.avgWin), "pos"],
    ["Rata-rata loss", s.avgLoss === null ? "—" : usd(s.avgLoss), "neg"],
    ["Trade terbaik", s.best === null ? "—" : usd(s.best, 2, true), cls(s.best)],
    ["Trade terburuk", s.worst === null ? "—" : usd(s.worst, 2, true), cls(s.worst)],
    ["Max drawdown", s.maxDD ? usd(-s.maxDD) + " (" + pct(s.maxDDPct, 2) + ")" : "—", s.maxDD ? "neg" : ""],
    ["Loss beruntun terpanjang", String(s.maxLossStreak), ""],
    ["Hari trading", String(s.tradingDays), ""],
    ["Sesuai rencana", s.planRate === null ? "—" : pct(s.planRate, 0), ""],
    ["Posisi open", s.openCount ? s.openCount + " · risiko " + usd(s.openRisk, 0) : "0", ""],
  ];
  $("p-stats").innerHTML = items.map(([k, v, c]) => '<div><span class="k">' + k + '</span><span class="v ' + c + '">' + v + "</span></div>").join("");
}

function renderCalendar(s) {
  const y = +calMonth.slice(0, 4), m = +calMonth.slice(5, 7) - 1;
  const days = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
  const today = dayFnFor(cfg())(localStamp());
  let monthNet = 0;
  const cells = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(d => '<div class="cal-h">' + d + "</div>");
  for (let i = 0; i < lead; i++) cells.push('<div class="cal-d blank"></div>');
  for (let d = 1; d <= days; d++) {
    const k = calMonth + "-" + pad(d), v = s.daily[k];
    if (v) monthNet += v.pnl;
    const tone = v ? (v.pnl > 0 ? "win" : v.pnl < 0 ? "loss" : "") : "";
    cells.push('<div class="cal-d ' + tone + (k === today ? " today" : "") + '"><span class="n">' + d + "</span>" +
      (v ? '<span class="p">' + usd(v.pnl, 0, true) + '</span><span class="c">' + v.n + " trade</span>" : "") + "</div>");
  }
  $("p-cal").innerHTML = cells.join("");
  $("p-calTitle").innerHTML = MONTHS[m] + " " + y + (monthNet ? ' · <span class="' + cls(monthNet) + '">' + usd(monthNet, 0, true) + "</span>" : "");
}

function renderBreakdown() {
  const by = state.ui.breakdown || "pair";
  document.querySelectorAll("#p-breakSeg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.k === by)));
  const rows = breakdown(accountTrades(), by);
  const head = { pair: "Instrumen", setup: "Setup", session: "Sesi", weekday: "Hari", dir: "Arah" }[by];
  $("p-break").innerHTML = "<thead><tr><th>" + head + "</th><th>Trade</th><th>Win rate</th><th>Net P/L</th><th>Rata-rata R</th></tr></thead><tbody>" +
    (rows.length ? rows.map(r => "<tr><td>" + esc(r.key) + "</td><td>" + r.n + "</td><td>" + pct(r.winRate, 0) + '</td><td class="' + cls(r.net) + '">' + usd(r.net, 2, true) +
      '</td><td class="' + cls(r.avgR) + '">' + (r.avgR === null ? "—" : (r.avgR > 0 ? "+" : "") + fmt(r.avgR, 2) + "R") + "</td></tr>").join("")
      : '<tr><td colspan="5" class="mut">Belum ada trade yang ditutup.</td></tr>') + "</tbody>";
}
