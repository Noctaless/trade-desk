// Position sizing, P/L and journal statistics. Pure module (no DOM) so it can be tested with Node.

/** Floor to the lot step without floating-point drift (0.29999 -> 0.29, 0.3 -> 0.3). */
export function floorToStep(x, step) {
  if (!(x > 0) || !(step > 0)) return 0;
  const n = Math.floor(x / step + 1e-9);
  const dec = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
  return +(n * step).toFixed(dec);
}

/**
 * Lot size from risk.
 * in: { entry, sl, tp, contract, qUSD, riskBalance, riskPct, comm, step, leverage, balance }
 */
export function sizePosition(i) {
  const out = { dir: null, ok: false };
  if (!(i.entry > 0) || !(i.sl > 0) || i.entry === i.sl) return out;
  out.dir = i.sl < i.entry ? "BUY" : "SELL";
  out.slDist = Math.abs(i.entry - i.sl);
  out.hasTp = i.tp > 0;
  out.tpValid = !out.hasTp || (out.dir === "BUY" ? i.tp > i.entry : i.tp < i.entry);
  out.tpDist = out.hasTp ? Math.abs(i.tp - i.entry) : 0;
  if (!(i.contract > 0) || !(i.qUSD > 0) || !(i.riskBalance > 0) || !(i.riskPct > 0)) return out;

  const comm = i.comm > 0 ? i.comm : 0;
  out.lossPerLot = out.slDist * i.contract * i.qUSD + comm;
  out.riskTarget = i.riskBalance * i.riskPct / 100;
  out.rawLots = out.riskTarget / out.lossPerLot;
  out.lots = floorToStep(out.rawLots, i.step);
  out.belowMin = out.lots < i.step;
  out.minLotRisk = i.step * out.lossPerLot;
  out.actualRisk = out.lots * out.lossPerLot;
  out.profit = out.hasTp && out.tpValid ? out.lots * (out.tpDist * i.contract * i.qUSD - comm) : null;
  out.rr = out.hasTp && out.tpValid ? out.tpDist / out.slDist : null;
  const notionalPerLot = i.contract * i.entry * i.qUSD; // in USD
  out.margin = i.leverage > 0 ? out.lots * notionalPerLot / i.leverage : NaN;
  out.maxLot = i.leverage > 0 && i.balance > 0 ? floorToStep(i.balance * i.leverage / notionalPerLot, i.step) : NaN;
  out.ok = out.tpValid;
  return out;
}

/** Net P/L of a trade closed at `exit` (commission per lot round-turn deducted). */
export function pnlAt(t, exit, contract, qUSD, comm) {
  const sign = t.dir === "SELL" ? -1 : 1;
  return sign * (exit - t.entry) * contract * qUSD * t.lots - (comm > 0 ? comm : 0) * t.lots;
}

/** Money at risk if the stop is hit. */
export function riskOf(t, contract, qUSD, comm) {
  if (!(t.sl > 0) || !(t.entry > 0)) return null;
  return Math.abs(t.entry - t.sl) * contract * qUSD * t.lots + (comm > 0 ? comm : 0) * t.lots;
}

// ---------- dates ----------
export const pad = n => String(n).padStart(2, "0");
export function localStamp(d = new Date()) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}
export const dayKey = s => (s || "").slice(0, 10);

// MT5 prop-firm servers mostly run on "New York close" time (GMT+2 winter / GMT+3 summer):
// the trading day rolls over at 17:00 New York, i.e. 04:00 or 05:00 WIB.
const NY = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export function serverDayKey(stamp) {
  const d = new Date(stamp);
  if (isNaN(d)) return dayKey(stamp);
  const p = Object.fromEntries(NY.formatToParts(d).map(x => [x.type, x.value]));
  const t = new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) + 7 * 3600e3);
  return t.getUTCFullYear() + "-" + pad(t.getUTCMonth() + 1) + "-" + pad(t.getUTCDate());
}
export const dayFnFor = s => (s.dayReset === "local" ? dayKey : serverDayKey);
export const WEEKDAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** Trading session from the open time (stored as local time, classified in UTC). */
export function sessionOf(stamp) {
  const d = new Date(stamp);
  if (isNaN(d)) return "—";
  const h = d.getUTCHours();
  if (h >= 12 && h < 16) return "London + New York";
  if (h >= 7 && h < 12) return "London";
  if (h >= 16 && h < 21) return "New York";
  return "Asia";
}

const isClosed = t => t.status === "closed" && Number.isFinite(t.pnl);
const closeTime = t => t.closedAt || t.openedAt || "";

// ---------- statistics ----------
export function computeStats(trades, s, now = localStamp()) {
  const dayOf = dayFnFor(s);
  const today = dayOf(now);
  const start = s.startBalance;
  const closed = trades.filter(isClosed).sort((a, b) => closeTime(a).localeCompare(closeTime(b)));
  const open = trades.filter(t => t.status !== "closed");
  const maxLossAmt = start * (s.maxLossPct || 0) / 100;

  let bal = start, peak = start, maxDD = 0, maxDDPct = 0;
  const floorAt = pk => (s.maxLossType === "trailing" ? Math.min(pk - maxLossAmt, start) : start - maxLossAmt);
  const curve = [{ label: "Awal", bal: start, floor: floorAt(start), trade: null }];
  const daily = {};
  let dayStart = start;

  for (const t of closed) {
    const dk = dayOf(closeTime(t));
    if (dk < today) dayStart = bal + t.pnl;
    bal += t.pnl;
    peak = Math.max(peak, bal);
    const dd = peak - bal;
    if (dd > maxDD) { maxDD = dd; maxDDPct = dd / peak * 100; }
    curve.push({ label: closeTime(t).replace("T", " "), bal, floor: floorAt(peak), trade: t });
    (daily[dk] ||= { pnl: 0, n: 0 }).pnl += t.pnl;
    daily[dk].n++;
  }

  const wins = closed.filter(t => t.pnl > 0), losses = closed.filter(t => t.pnl < 0);
  const sum = a => a.reduce((x, t) => x + t.pnl, 0);
  const grossWin = sum(wins), grossLoss = -sum(losses);
  const withR = closed.filter(t => t.risk > 0);
  const planned = closed.filter(t => t.plan === "yes" || t.plan === "no");

  let streakW = 0, streakL = 0, maxW = 0, maxL = 0;
  for (const t of closed) {
    if (t.pnl > 0) { streakW++; streakL = 0; } else if (t.pnl < 0) { streakL++; streakW = 0; } else { streakW = 0; streakL = 0; }
    maxW = Math.max(maxW, streakW); maxL = Math.max(maxL, streakL);
  }

  const todayPnl = daily[today]?.pnl || 0;
  const dailyLimit = (s.dailyBase === "dayStart" ? dayStart : start) * (s.dailyLossPct || 0) / 100;
  const openRisk = open.reduce((x, t) => x + (t.risk > 0 ? t.risk : 0), 0);
  const floor = floorAt(peak);
  const targetAmt = start * (s.profitTargetPct || 0) / 100;
  const net = bal - start;

  // Consistency rule: the best day may be at most X% of total profit.
  let consistency = null;
  if (s.consistencyPct > 0) {
    const bestDay = Math.max(0, ...Object.values(daily).map(d => d.pnl));
    const limitPct = s.consistencyPct;
    consistency = {
      limitPct, bestDay,
      ratio: net > 0 ? bestDay / net * 100 : null,
      ok: bestDay === 0 || (net > 0 && bestDay / net * 100 <= limitPct + 1e-9),
      // total profit needed so the best day is within the limit
      needed: bestDay > 0 ? bestDay * 100 / limitPct : 0,
    };
    consistency.shortfall = Math.max(0, consistency.needed - net);
  }
  const payout = s.payoutMin > 0 || s.payoutCap > 0
    ? { min: s.payoutMin || 0, cap: s.payoutCap || 0, eligible: net >= (s.payoutMin || 0) && net > 0 && (!consistency || consistency.ok), amount: Math.max(0, s.payoutCap > 0 ? Math.min(net, s.payoutCap) : net) }
    : null;

  return {
    start, balance: bal, net, netPct: net / start * 100, peak, maxDD, maxDDPct, curve, daily,
    n: closed.length, nWin: wins.length, nLoss: losses.length, nBe: closed.length - wins.length - losses.length,
    winRate: closed.length ? wins.length / closed.length * 100 : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : null),
    avgWin: wins.length ? grossWin / wins.length : null,
    avgLoss: losses.length ? -grossLoss / losses.length : null,
    expectancy: closed.length ? net / closed.length : null,
    avgR: withR.length ? withR.reduce((x, t) => x + t.pnl / t.risk, 0) / withR.length : null,
    best: closed.length ? Math.max(...closed.map(t => t.pnl)) : null,
    worst: closed.length ? Math.min(...closed.map(t => t.pnl)) : null,
    maxWinStreak: maxW, maxLossStreak: maxL,
    tradingDays: Object.keys(daily).length, consistency, payout,
    planRate: planned.length ? planned.filter(t => t.plan === "yes").length / planned.length * 100 : null,
    openCount: open.length, openRisk,
    today: {
      key: today, pnl: todayPnl, n: daily[today]?.n || 0, dayStart, limit: dailyLimit,
      floor: dayStart - dailyLimit,
      // what can still be lost today before breaching, after counting open positions' stop risk
      remaining: dailyLimit + Math.min(todayPnl, 0) - openRisk,
      used: dailyLimit > 0 ? Math.max(0, -todayPnl) / dailyLimit * 100 : null,
    },
    maxLoss: { limit: maxLossAmt, floor, distance: bal - floor, used: maxLossAmt > 0 ? Math.max(0, maxLossAmt - (bal - floor)) / maxLossAmt * 100 : null },
    target: targetAmt > 0 ? { goal: start + targetAmt, amount: targetAmt, progress: net / targetAmt * 100, remaining: targetAmt - net } : null,
  };
}

const GROUP_KEYS = {
  pair: t => t.pair,
  setup: t => t.setup || "(tanpa setup)",
  session: t => sessionOf(t.openedAt),
  weekday: t => { const d = new Date(t.openedAt); return isNaN(d) ? "—" : WEEKDAYS[d.getDay()]; },
  dir: t => t.dir,
};

export function breakdown(trades, by) {
  const f = GROUP_KEYS[by];
  const g = {};
  for (const t of trades.filter(isClosed)) {
    const k = f(t);
    const r = (g[k] ||= { key: k, n: 0, win: 0, net: 0, rSum: 0, rN: 0 });
    r.n++; r.net += t.pnl; if (t.pnl > 0) r.win++;
    if (t.risk > 0) { r.rSum += t.pnl / t.risk; r.rN++; }
  }
  return Object.values(g)
    .map(r => ({ ...r, winRate: r.win / r.n * 100, avgR: r.rN ? r.rSum / r.rN : null }))
    .sort((a, b) => b.net - a.net);
}
