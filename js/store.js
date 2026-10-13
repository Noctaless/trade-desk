// App state persisted in localStorage. Every change goes through update() so all tabs re-render.

const KEY = "tradedesk.v1";

export const DEFAULT_SETTINGS = {
  name: "Funded 100K",
  phase: "Funded",
  startBalance: 100000,
  leverage: 100,
  profitTargetPct: 0,
  dailyLossPct: 5,
  dailyBase: "initial",
  maxLossPct: 10,
  maxLossType: "static",
  defaultRisk: 1,
  riskBase: "initial",
  commission: 0,
  lotStep: 0.01,
  contract: {}, // per-symbol overrides
};

function fresh() {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    trades: [],
    calc: { pair: "XAUUSD", risk: null, prices: { XAUUSD: { entry: 4105.5, sl: 4095.5, tp: 4130.5 } }, convManual: {} },
    rates: null, // { date, source, fetchedAt, usdPer: { EUR: 1.11, JPY: 0.0063, ... } }
    ui: { tab: "calc", breakdown: "pair" },
  };
}

function load() {
  const base = fresh();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw) return base;
    return {
      ...base, ...raw,
      settings: { ...base.settings, ...raw.settings },
      calc: { ...base.calc, ...raw.calc },
      ui: { ...base.ui, ...raw.ui },
      trades: Array.isArray(raw.trades) ? raw.trades : [],
    };
  } catch (e) {
    return base;
  }
}

export const state = load();
const listeners = new Set();
let storageOk = true;

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); storageOk = true; } catch (e) { storageOk = false; }
}
export const storageWorks = () => storageOk;

/** Mutate state, save, and notify. `silent` skips re-rendering (used while typing in the calculator). */
export function update(fn, { silent = false } = {}) {
  fn(state);
  persist();
  if (!silent) listeners.forEach(l => l());
}
export const onChange = fn => listeners.add(fn);

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function contractFor(p) {
  const o = state.settings.contract[p.s];
  return o > 0 ? o : p.contract;
}

// ---------- backup ----------
export function exportJSON() {
  return JSON.stringify({ app: "trade-desk", exportedAt: new Date().toISOString(), settings: state.settings, trades: state.trades }, null, 2);
}

export function importJSON(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.trades)) throw new Error("File ini bukan backup Trade Desk (tidak ada daftar trade).");
  update(s => {
    s.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
    s.trades = data.trades.filter(t => t && t.id && t.pair);
  });
  return state.trades.length;
}

export function exportCSV() {
  const cols = ["openedAt", "closedAt", "pair", "dir", "lots", "entry", "sl", "tp", "exit", "pnl", "risk", "status", "setup", "emotion", "plan", "link", "notes"];
  const esc = v => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [cols.join(","), ...state.trades.map(t => cols.map(c => esc(t[c])).join(","))].join("\n");
}
