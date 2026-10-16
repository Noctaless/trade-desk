// Small shared UI helpers.
import { GROUPS } from "./instruments.js";

export const $ = id => document.getElementById(id);

/**
 * Parse a number typed by hand. Accepts both decimal separators (iPhone/Android keyboards in
 * Indonesian locale type "199,512"), and thousands separators ("4.105,50", "4,105.50", "100 000").
 */
export const num = v => {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  let s = String(v ?? "").trim().replace(/[\s']/g, "");
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    // both present: the one that comes last is the decimal separator
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = s.replace(",", ".");
  }
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
};

export const fmt = (n, d = 2) => Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export function usd(n, d = 2, sign = false) {
  if (!Number.isFinite(n)) return "—";
  const s = n < 0 ? "-" : sign && n > 0 ? "+" : "";
  return s + "$" + fmt(Math.abs(n), d);
}

export const pct = (n, d = 2, sign = false) => (Number.isFinite(n) ? (sign && n > 0 ? "+" : "") + fmt(n, d) + "%" : "—");

export const cls = n => (n > 0 ? "pos" : n < 0 ? "neg" : "");

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function fillPairSelect(sel) {
  sel.innerHTML = GROUPS.map(([name, list]) =>
    '<optgroup label="' + name + '">' + list.map(p => '<option value="' + p.s + '">' + p.s + "</option>").join("") + "</optgroup>"
  ).join("");
}

let toastTimer;
export function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2200);
}

/** Copy text; returns a promise that resolves true/false. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch (e2) {
      return false;
    }
  }
}

export function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/** Two-tap confirm for destructive buttons (native confirm() is unreliable inside Telegram). */
export function armButton(btn, armedLabel, action) {
  const label = btn.textContent;
  let timer;
  btn.addEventListener("click", () => {
    if (btn.classList.contains("armed")) {
      clearTimeout(timer);
      btn.classList.remove("armed"); btn.textContent = label;
      action();
      return;
    }
    btn.classList.add("armed"); btn.textContent = armedLabel;
    timer = setTimeout(() => { btn.classList.remove("armed"); btn.textContent = label; }, 3000);
  });
  return () => { clearTimeout(timer); btn.classList.remove("armed"); btn.textContent = label; };
}
