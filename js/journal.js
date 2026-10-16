// Jurnal tab: trade list and the trade form dialog.
import { PAIRS, quoteToUSD } from "./instruments.js";
import { pnlAt, riskOf, localStamp, dayKey, WEEKDAYS } from "./core.js";
import { state, update, newId, contractFor, cfg, accountTrades, activeAccount } from "./store.js";
import { convRateFor } from "./calc.js";
import { $, num, fmt, usd, cls, esc, fillPairSelect, toast, armButton } from "./ui.js";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const filter = { month: "", pair: "", result: "" };
let editingId = null;
let dir = "BUY";
let pnlTouched = false;
let disarmDelete = () => {};

const qUSDAt = (p, price) => quoteToUSD(p, price, convRateFor(p.quote));

export function initJournal() {
  fillPairSelect($("t-pair"));
  $("j-add").addEventListener("click", () => openTradeDialog());
  $("j-fMonth").addEventListener("change", e => { filter.month = e.target.value; renderJournal(); });
  $("j-fPair").addEventListener("change", e => { filter.pair = e.target.value; renderJournal(); });
  $("j-fResult").addEventListener("change", e => { filter.result = e.target.value; renderJournal(); });
  $("j-list").addEventListener("click", e => {
    const row = e.target.closest("[data-id]");
    if (row) openTradeDialog(null, row.dataset.id);
  });

  // dialog wiring
  const dlg = $("t-dialog");
  $("t-close").addEventListener("click", () => dlg.close());
  $("t-cancel").addEventListener("click", () => dlg.close());
  $("t-dirSeg").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    setDir(b.dataset.v); recalc();
  });
  $("t-closed").addEventListener("change", () => {
    $("t-closeBox").hidden = !$("t-closed").checked;
    if ($("t-closed").checked && !$("t-closedAt").value) $("t-closedAt").value = localStamp();
    recalc();
  });
  ["t-entry", "t-sl"].forEach(id => $(id).addEventListener("input", () => {
    const e = num($("t-entry").value), s = num($("t-sl").value);
    if (e > 0 && s > 0 && e !== s) setDir(s < e ? "BUY" : "SELL");
    recalc();
  }));
  ["t-lots", "t-tp", "t-exit"].forEach(id => $(id).addEventListener("input", recalc));
  $("t-pair").addEventListener("change", recalc);
  $("t-pnl").addEventListener("input", () => { pnlTouched = $("t-pnl").value.trim() !== ""; });
  $("t-hitTp").addEventListener("click", () => quickExit("t-tp"));
  $("t-hitSl").addEventListener("click", () => quickExit("t-sl"));
  $("t-hitBe").addEventListener("click", () => quickExit("t-entry"));
  $("t-form").addEventListener("submit", e => { e.preventDefault(); saveTrade(); });
  disarmDelete = armButton($("t-delete"), "Yakin hapus?", () => {
    update(s => { s.trades = s.trades.filter(t => t.id !== editingId); });
    dlg.close();
    toast("Trade dihapus");
  });
}

function setDir(v) {
  dir = v;
  document.querySelectorAll("#t-dirSeg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
}

function quickExit(srcId) {
  const v = $(srcId).value;
  if (v === "") { toast(srcId === "t-tp" ? "Isi harga TP dulu" : "Isi harga dulu"); return; }
  $("t-exit").value = v;
  pnlTouched = false;
  recalc();
}

/** Live risk info and auto P/L from the exit price. */
function recalc() {
  const p = PAIRS[$("t-pair").value];
  const t = { dir, lots: num($("t-lots").value), entry: num($("t-entry").value), sl: num($("t-sl").value) };
  const comm = state.settings.commission;
  const risk = t.lots > 0 ? riskOf(t, contractFor(p), qUSDAt(p, t.entry), comm) : null;
  const tp = num($("t-tp").value);
  let info = "";
  if (risk > 0) {
    info = "Risiko kalau SL kena: " + usd(risk) + " (" + fmt(risk / cfg().startBalance * 100, 2) + "% dari balance awal)";
    if (tp > 0 && t.sl > 0) info += " · R:R 1 : " + fmt(Math.abs(tp - t.entry) / Math.abs(t.entry - t.sl), 2);
  } else if (t.lots > 0 && t.entry > 0) {
    info = "Tanpa SL, risiko trade ini tidak bisa dihitung dan R-multiple tidak tercatat.";
  }
  $("t-riskInfo").textContent = info;

  const exit = num($("t-exit").value);
  if ($("t-closed").checked && !pnlTouched && exit > 0 && t.lots > 0 && t.entry > 0) {
    $("t-pnl").value = pnlAt(t, exit, contractFor(p), qUSDAt(p, exit), comm).toFixed(2);
  }
}

/** Open the trade form. `prefill` for a new trade (e.g. from the calculator), or `id` to edit. */
export function openTradeDialog(prefill, id) {
  const t = id ? state.trades.find(x => x.id === id) : null;
  editingId = t ? t.id : null;
  const d = t || { pair: state.calc.pair, dir: "BUY", openedAt: localStamp(), status: "open", ...prefill };
  $("t-title").textContent = t ? "Edit trade" : "Trade baru";
  $("t-pair").value = d.pair in PAIRS ? d.pair : "XAUUSD";
  setDir(d.dir || "BUY");
  const set = (elId, v) => ($(elId).value = v === undefined || v === null || Number.isNaN(v) ? "" : v);
  set("t-lots", d.lots); set("t-entry", d.entry); set("t-sl", d.sl); set("t-tp", d.tp);
  set("t-opened", d.openedAt); set("t-exit", d.exit); set("t-closedAt", d.closedAt); set("t-pnl", d.pnl);
  set("t-setup", d.setup); set("t-emotion", d.emotion || ""); set("t-plan", d.plan || ""); set("t-link", d.link); set("t-notes", d.notes);
  $("t-closed").checked = d.status === "closed";
  $("t-closeBox").hidden = d.status !== "closed";
  pnlTouched = Number.isFinite(d.pnl);
  $("t-delete").hidden = !t;
  disarmDelete();
  $("t-error").hidden = true;
  const setups = [...new Set(state.trades.map(x => x.setup).filter(Boolean))];
  $("t-setups").innerHTML = setups.map(s => '<option value="' + esc(s) + '"></option>').join("");
  recalc();
  $("t-dialog").showModal();
}

function saveTrade() {
  const p = PAIRS[$("t-pair").value];
  const v = id => ($(id).value.trim() === "" ? null : num($(id).value));
  const closed = $("t-closed").checked;
  const t = {
    id: editingId || newId(),
    accountId: editingId ? state.trades.find(x => x.id === editingId).accountId : activeAccount().id,
    pair: p.s, dir,
    lots: v("t-lots"), entry: v("t-entry"), sl: v("t-sl"), tp: v("t-tp"),
    openedAt: $("t-opened").value,
    status: closed ? "closed" : "open",
    exit: closed ? v("t-exit") : null,
    closedAt: closed ? $("t-closedAt").value || localStamp() : null,
    pnl: closed ? v("t-pnl") : null,
    setup: $("t-setup").value.trim(), emotion: $("t-emotion").value, plan: $("t-plan").value,
    link: $("t-link").value.trim(), notes: $("t-notes").value.trim(),
  };
  const err = msg => { $("t-error").textContent = msg; $("t-error").hidden = false; $("t-error").scrollIntoView({ block: "nearest" }); };
  if (!(t.lots > 0)) return err("Isi jumlah lot.");
  if (!(t.entry > 0)) return err("Isi harga entry.");
  if (!t.openedAt) return err("Isi waktu open.");
  if (t.sl !== null && (t.dir === "BUY" ? t.sl >= t.entry : t.sl <= t.entry)) return err("Untuk " + t.dir + ", SL harus di " + (t.dir === "BUY" ? "bawah" : "atas") + " entry.");
  if (closed && !Number.isFinite(t.pnl)) return err("Isi harga exit atau P/L bersih.");
  if (closed && t.closedAt < t.openedAt) return err("Waktu close lebih awal dari waktu open.");

  const old = editingId ? state.trades.find(x => x.id === editingId) : null;
  // risk is fixed at the time it was journaled, so R-multiples don't drift with later FX moves
  const sameRiskInputs = old && old.pair === t.pair && old.lots === t.lots && old.entry === t.entry && old.sl === t.sl && old.risk > 0;
  t.risk = sameRiskInputs ? old.risk : riskOf(t, contractFor(p), qUSDAt(p, t.entry), state.settings.commission);
  t.createdAt = old ? old.createdAt : Date.now();

  update(s => {
    const i = s.trades.findIndex(x => x.id === t.id);
    if (i >= 0) s.trades[i] = t; else s.trades.push(t);
  });
  $("t-dialog").close();
  toast(old ? "Trade diperbarui" : "Trade tercatat");
}

export function renderJournal() {
  const trades = accountTrades();
  // filter options
  const months = [...new Set(trades.map(t => (t.openedAt || "").slice(0, 7)).filter(Boolean))].sort().reverse();
  const pairs = [...new Set(trades.map(t => t.pair))].sort();
  if (filter.month && !months.includes(filter.month)) filter.month = "";
  if (filter.pair && !pairs.includes(filter.pair)) filter.pair = "";
  $("j-fMonth").innerHTML = '<option value="">Semua bulan</option>' +
    months.map(m => '<option value="' + m + '">' + MONTHS[+m.slice(5, 7) - 1] + " " + m.slice(0, 4) + "</option>").join("");
  $("j-fPair").innerHTML = '<option value="">Semua instrumen</option>' + pairs.map(p => "<option>" + p + "</option>").join("");
  $("j-fMonth").value = filter.month; $("j-fPair").value = filter.pair; $("j-fResult").value = filter.result;

  const list = trades.filter(t =>
    (!filter.month || (t.openedAt || "").startsWith(filter.month)) &&
    (!filter.pair || t.pair === filter.pair) &&
    (!filter.result ||
      (filter.result === "open" && t.status !== "closed") ||
      (filter.result === "win" && t.status === "closed" && t.pnl > 0) ||
      (filter.result === "loss" && t.status === "closed" && t.pnl < 0))
  ).sort((a, b) => (b.openedAt || "").localeCompare(a.openedAt || ""));

  const closed = list.filter(t => t.status === "closed" && Number.isFinite(t.pnl));
  const net = closed.reduce((x, t) => x + t.pnl, 0);
  const wins = closed.filter(t => t.pnl > 0).length;
  $("j-summary").innerHTML = list.length
    ? "<b>" + list.length + "</b> trade · net <b class=\"" + cls(net) + "\">" + usd(net, 2, true) + "</b>" +
      (closed.length ? " · win rate <b>" + fmt(wins / closed.length * 100, 0) + "%</b>" : "") +
      (list.length - closed.length ? " · <b>" + (list.length - closed.length) + "</b> masih open" : "")
    : "";

  if (!trades.length) {
    $("j-list").innerHTML = '<div class="empty"><b>Belum ada trade</b><span>Hitung lot di tab Kalkulator lalu tekan "Catat ke jurnal", atau tambah manual di sini.</span></div>';
    return;
  }
  if (!list.length) {
    $("j-list").innerHTML = '<div class="empty"><b>Tidak ada trade yang cocok</b><span>Ubah filter di atas.</span></div>';
    return;
  }

  const byDay = {};
  list.forEach(t => (byDay[dayKey(t.openedAt)] ||= []).push(t));
  $("j-list").innerHTML = Object.entries(byDay).map(([day, ts]) => {
    const d = new Date(day + "T00:00");
    const dayNet = ts.filter(t => t.status === "closed").reduce((x, t) => x + (t.pnl || 0), 0);
    const head = WEEKDAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3) + " " + d.getFullYear();
    return '<div class="j-day"><div class="j-day-head"><span>' + head + '</span><span class="v ' + cls(dayNet) + '">' + usd(dayNet, 2, true) + "</span></div>" +
      ts.map(rowHTML).join("") + "</div>";
  }).join("");
}

function rowHTML(t) {
  const open = t.status !== "closed";
  const meta = [t.setup, t.emotion, t.plan === "no" ? "keluar rencana" : ""].filter(Boolean).map(esc).join(" · ");
  const r = !open && t.risk > 0 ? (t.pnl / t.risk >= 0 ? "+" : "") + fmt(t.pnl / t.risk, 2) + "R" : "";
  const res = open
    ? '<span class="pill open">OPEN</span><span class="r">risiko ' + (t.risk > 0 ? usd(t.risk, 0) : "—") + "</span>"
    : '<span class="v ' + cls(t.pnl) + '">' + usd(t.pnl, 2, true) + '</span><span class="r">' + r + "</span>";
  return '<button type="button" class="j-row" data-id="' + t.id + '">' +
    '<span class="time">' + (t.openedAt || "").slice(11, 16) + "</span>" +
    '<span class="main"><span class="sym">' + t.pair + '</span><span class="pill ' + t.dir.toLowerCase() + '">' + t.dir + "</span>" +
    '<span class="mut">' + fmt(t.lots, 2) + " lot</span>" + (meta ? '<span class="meta">' + meta + "</span>" : "") + "</span>" +
    '<span class="res">' + res + "</span></button>";
}
