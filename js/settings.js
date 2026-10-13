// Akun tab: accounts (one per prop-firm phase), their rules, global preferences, backup/restore.
import { state, update, exportJSON, importJSON, exportCSV, storageWorks, activeAccount, makeAccount, PRESETS } from "./store.js";
import { $, num, toast, copyText, download, armButton } from "./ui.js";

// form field id -> [key, type]; ACCOUNT fields live on the active account, PREFS on state.settings
const ACCOUNT = {
  "s-name": ["name", "text"], "s-phase": ["phase", "text"], "s-start": ["startBalance", "num"], "s-leverage": ["leverage", "num"],
  "s-target": ["profitTargetPct", "num"], "s-daily": ["dailyLossPct", "num"], "s-dailyBase": ["dailyBase", "text"],
  "s-max": ["maxLossPct", "num"], "s-maxType": ["maxLossType", "text"],
  "s-consistency": ["consistencyPct", "num"], "s-payoutMin": ["payoutMin", "num"], "s-payoutCap": ["payoutCap", "num"],
};
const PREFS = {
  "s-risk": ["defaultRisk", "num"], "s-riskBase": ["riskBase", "text"], "s-comm": ["commission", "num"], "s-step": ["lotStep", "num"],
  "s-dayReset": ["dayReset", "text"],
};
const MIN = { startBalance: 1, leverage: 1, lotStep: 0.01 };

const status = msg => { $("s-status").textContent = msg; };

function bind(map, target) {
  Object.entries(map).forEach(([id, [key, type]]) => {
    const el = $(id);
    const isText = el.tagName === "SELECT" || type === "text";
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
      if (isText) { update(s => { target(s)[key] = el.value.trim() || target(s)[key]; }); return; }
      const v = num(el.value);
      if (!(v >= (MIN[key] ?? 0))) return; // keep the last valid value while typing
      update(s => { target(s)[key] = v; });
    });
  });
}

export function initSettings() {
  bind(ACCOUNT, s => s.accounts.find(a => a.id === s.activeId));
  bind(PREFS, s => s.settings);
  $("s-form").addEventListener("submit", e => e.preventDefault());
  $("s-prefs").addEventListener("submit", e => e.preventDefault());

  $("s-preset").innerHTML = Object.entries(PRESETS).map(([k, p]) => '<option value="' + k + '">' + p.label + "</option>").join("");
  $("s-account").addEventListener("change", e => {
    update(s => { s.activeId = e.target.value; });
    toast("Akun aktif: " + activeAccount().name);
  });
  $("s-newAcc").addEventListener("click", () => {
    const acc = makeAccount($("s-preset").value);
    update(s => { s.accounts.push(acc); s.activeId = acc.id; });
    toast("Akun " + acc.name + " dibuat dan aktif");
  });
  armButton($("s-delAcc"), "Yakin? Semua trade akun ini ikut terhapus", () => {
    const id = state.activeId, name = activeAccount().name;
    update(s => {
      s.trades = s.trades.filter(t => t.accountId !== id);
      s.accounts = s.accounts.filter(a => a.id !== id);
      if (!s.accounts.length) s.accounts.push(makeAccount("custom"));
      s.activeId = s.accounts[0].id;
    });
    toast("Akun " + name + " dihapus");
  });

  const stamp = () => new Date().toISOString().slice(0, 10);
  $("s-export").addEventListener("click", () => {
    download("trade-desk-backup-" + stamp() + ".json", exportJSON(), "application/json");
    status("Backup diunduh. Kalau tidak muncul (misalnya di Telegram), pakai Salin backup.");
  });
  $("s-csv").addEventListener("click", () => {
    download("trade-desk-" + stamp() + ".csv", exportCSV(), "text/csv");
    status("CSV diunduh. Bisa dibuka di Excel atau Google Sheets.");
  });
  $("s-copy").addEventListener("click", async () => {
    const ok = await copyText(exportJSON());
    status(ok ? "Backup tersalin. Tempel ke catatan atau kirim ke Saved Messages di Telegram." : "Gagal menyalin. Coba Unduh backup.");
  });
  $("s-importFile").addEventListener("change", async e => {
    const f = e.target.files[0]; if (!f) return;
    restore(await f.text());
    e.target.value = "";
  });
  $("s-pasteBtn").addEventListener("click", () => restore($("s-paste").value));
  armButton($("s-reset"), "Yakin? Tekan lagi untuk hapus", () => {
    const id = state.activeId;
    update(s => { s.trades = s.trades.filter(t => t.accountId !== id); });
    toast("Semua trade akun ini dihapus");
  });
}

function restore(text) {
  try {
    const n = importJSON(text);
    $("s-paste").value = "";
    status("Data dipulihkan: " + state.accounts.length + " akun, " + n + " trade.");
    toast("Backup dipulihkan");
  } catch (e) {
    status("Gagal memulihkan: " + (e instanceof SyntaxError ? "isi backup tidak lengkap atau rusak." : e.message));
  }
}

export function renderSettings() {
  const acc = activeAccount();
  const counts = {};
  state.trades.forEach(t => (counts[t.accountId] = (counts[t.accountId] || 0) + 1));
  $("s-account").innerHTML = state.accounts.map(a =>
    '<option value="' + a.id + '">' + a.name.replace(/</g, "&lt;") + " · " + (counts[a.id] || 0) + " trade</option>").join("");
  $("s-account").value = acc.id;
  const fill = (map, src) => Object.entries(map).forEach(([id, [key]]) => {
    if (document.activeElement !== $(id)) $(id).value = src[key];
  });
  fill(ACCOUNT, acc);
  fill(PREFS, state.settings);
  if (!storageWorks()) status("Browser ini tidak mengizinkan penyimpanan. Data akan hilang saat halaman ditutup.");
}
