// App state persisted in localStorage. Every change goes through update() so all tabs re-render.

const KEY = "tradedesk.v1";

// Global preferences (shared by all accounts).
export const DEFAULT_SETTINGS = {
  defaultRisk: 1,
  riskBase: "initial",
  commission: 0,
  lotStep: 0.01,
  dayReset: "server", // "server" = MT5 server day (New York close, 17:00 NY) | "local" = device midnight
  contract: {}, // per-symbol contract size overrides
};

// Per-account rules. Each prop-firm phase is its own account because the balance restarts.
const ACCOUNT_FIELDS = {
  name: "Akun 100K", phase: "Evaluasi", startBalance: 100000, leverage: 100,
  profitTargetPct: 10, dailyLossPct: 5, dailyBase: "initial", maxLossPct: 10, maxLossType: "static",
  consistencyPct: 0, payoutMin: 0, payoutCap: 0,
};

// Rules from The5ers 2-step 100K plan (checkout page): target 10% / 5% / 10%, max loss $10,000,
// daily loss 3%, leverage 1:100, funded: consistency 50%, withdraw target $250, withdraw cap $2,000.
const FIVERS = { startBalance: 100000, leverage: 100, dailyLossPct: 3, dailyBase: "dayStart", maxLossPct: 10, maxLossType: "static" };
export const PRESETS = {
  "5ers-1": { label: "The5ers 100K · Step 1", ...FIVERS, name: "The5ers Step 1", phase: "Evaluasi Step 1", profitTargetPct: 10, consistencyPct: 0, payoutMin: 0, payoutCap: 0 },
  "5ers-2": { label: "The5ers 100K · Step 2", ...FIVERS, name: "The5ers Step 2", phase: "Evaluasi Step 2", profitTargetPct: 5, consistencyPct: 0, payoutMin: 0, payoutCap: 0 },
  "5ers-f": { label: "The5ers 100K · Funded", ...FIVERS, name: "The5ers Funded", phase: "Funded", profitTargetPct: 10, consistencyPct: 50, payoutMin: 250, payoutCap: 2000 },
  custom: { label: "Kosong (atur sendiri)", ...ACCOUNT_FIELDS },
};

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function makeAccount(presetKey) {
  const { label, ...p } = PRESETS[presetKey] || PRESETS.custom;
  return { id: newId(), ...ACCOUNT_FIELDS, ...p, createdAt: Date.now() };
}

function fresh() {
  const acc = makeAccount("5ers-1");
  return {
    version: 2,
    settings: { ...DEFAULT_SETTINGS },
    accounts: [acc],
    activeId: acc.id,
    trades: [],
    calc: { pair: "XAUUSD", risk: null, prices: { XAUUSD: { entry: 4105.5, sl: 4095.5, tp: 4130.5 } }, convManual: {} },
    rates: null, // { date, source, fetchedAt, usdPer: { EUR: 1.11, JPY: 0.0063, ... } }
    ui: { tab: "calc", breakdown: "pair" },
  };
}

/** Bring older saves (single account inside `settings`) up to the multi-account shape. */
function migrate(raw, base) {
  const s = { ...base, ...raw, calc: { ...base.calc, ...raw.calc }, ui: { ...base.ui, ...raw.ui } };
  s.trades = Array.isArray(raw.trades) ? raw.trades : [];
  const oldSettings = raw.settings || {};
  if (!Array.isArray(raw.accounts) || !raw.accounts.length) {
    const acc = { id: newId(), ...ACCOUNT_FIELDS, createdAt: Date.now() };
    Object.keys(ACCOUNT_FIELDS).forEach(k => { if (k in oldSettings) acc[k] = oldSettings[k]; });
    s.accounts = [acc];
  }
  s.accounts = s.accounts.map(a => ({ ...ACCOUNT_FIELDS, ...a }));
  if (!s.accounts.some(a => a.id === s.activeId)) s.activeId = s.accounts[0].id;
  s.settings = { ...DEFAULT_SETTINGS };
  Object.keys(DEFAULT_SETTINGS).forEach(k => { if (k in oldSettings) s.settings[k] = oldSettings[k]; });
  s.trades.forEach(t => { if (!t.accountId || !s.accounts.some(a => a.id === t.accountId)) t.accountId = s.activeId; });
  s.version = 2;
  return s;
}

function load() {
  const base = fresh();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    return raw ? migrate(raw, base) : base;
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

export const activeAccount = () => state.accounts.find(a => a.id === state.activeId) || state.accounts[0];
export const accountTrades = () => state.trades.filter(t => t.accountId === activeAccount().id);
/** Rules of the active account merged with global preferences: what stats and the calculator use. */
export const cfg = () => ({ ...state.settings, ...activeAccount() });

export function contractFor(p) {
  const o = state.settings.contract[p.s];
  return o > 0 ? o : p.contract;
}

// ---------- backup ----------
export function exportJSON() {
  return JSON.stringify({
    app: "trade-desk", version: 2, exportedAt: new Date().toISOString(),
    settings: state.settings, accounts: state.accounts, activeId: state.activeId, trades: state.trades,
  }, null, 2);
}

export function importJSON(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.trades)) throw new Error("File ini bukan backup Trade Desk (tidak ada daftar trade).");
  const next = migrate({ ...data, trades: data.trades.filter(t => t && t.id && t.pair) }, fresh());
  update(s => {
    s.settings = next.settings; s.accounts = next.accounts; s.activeId = next.activeId; s.trades = next.trades;
  });
  return state.trades.length;
}

export function exportCSV() {
  const names = Object.fromEntries(state.accounts.map(a => [a.id, a.name]));
  const cols = ["account", "openedAt", "closedAt", "pair", "dir", "lots", "entry", "sl", "tp", "exit", "pnl", "risk", "status", "setup", "emotion", "plan", "link", "notes"];
  const esc = v => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [cols.join(","), ...state.trades.map(t => cols.map(c => esc(c === "account" ? names[t.accountId] : t[c])).join(","))].join("\n");
}
