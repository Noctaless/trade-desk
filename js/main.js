import { state, update, onChange, persist } from "./store.js";
import { refreshRates } from "./rates.js";
import { initCalc, renderCalc } from "./calc.js";
import { initJournal, renderJournal, openTradeDialog } from "./journal.js";
import { initPortfolio, renderPortfolio } from "./portfolio.js";
import { initSettings, renderSettings } from "./settings.js";

const TABS = ["calc", "journal", "portfolio", "settings"];
let portfolioDirty = true;

// ---------- Telegram Mini App ----------
const tg = window.Telegram && window.Telegram.WebApp;
const inTelegram = !!(tg && tg.initData);
function applyTelegramTheme() {
  if (!inTelegram) return;
  document.documentElement.dataset.theme = tg.colorScheme === "dark" ? "dark" : "light";
  const surface = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();
  try { tg.setHeaderColor(surface); tg.setBackgroundColor(surface); } catch (e) {}
}
if (inTelegram) {
  tg.ready();
  tg.expand();
  applyTelegramTheme();
  tg.onEvent("themeChanged", () => { applyTelegramTheme(); portfolioDirty = true; renderVisible(); });
}

// ---------- tabs ----------
function showTab(name) {
  if (!TABS.includes(name)) name = "calc";
  TABS.forEach(t => ($("tab-" + t).hidden = t !== name));
  document.querySelectorAll(".tab-btn").forEach(b => {
    if (b.dataset.tab === name) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  if (state.ui.tab !== name) { state.ui.tab = name; persist(); }
  if (name === "portfolio" && portfolioDirty) { renderPortfolio(); portfolioDirty = false; }
  history.replaceState(null, "", "#" + name);
  window.scrollTo(0, 0);
}
const $ = id => document.getElementById(id);

function renderVisible() {
  renderCalc();
  renderJournal();
  renderSettings();
  if (state.ui.tab === "portfolio") { renderPortfolio(); portfolioDirty = false; } else portfolioDirty = true;
}

// ---------- boot ----------
initCalc({
  onSave: prefill => { showTab("journal"); openTradeDialog(prefill); },
});
initJournal();
initPortfolio();
initSettings();
onChange(renderVisible);

document.querySelectorAll(".tab-btn").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
renderVisible();
showTab(location.hash.slice(1) || state.ui.tab);

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { portfolioDirty = true; if (state.ui.tab === "portfolio") renderPortfolio(); });
// Chart.js loads with `defer`; if it arrived after the first render, draw the chart once it's there.
window.addEventListener("load", () => { if (state.ui.tab === "portfolio") renderPortfolio(); });

// "Add to Home Screen" hint: only in iPhone/iPad Safari, not when already installed or inside Telegram.
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const installed = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
let tipDismissed = false;
try { tipDismissed = localStorage.getItem("tradedesk.tipDismissed") === "1"; } catch (e) {}
if (isIOS && !installed && !inTelegram && !tipDismissed) $("installTip").hidden = false;
$("installTipClose").addEventListener("click", () => {
  $("installTip").hidden = true;
  try { localStorage.setItem("tradedesk.tipDismissed", "1"); } catch (e) {}
});

refreshRates();
document.addEventListener("visibilitychange", () => { if (!document.hidden) { refreshRates(); renderVisible(); } });

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
