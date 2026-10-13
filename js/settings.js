// Akun tab: account rules, preferences, backup/restore.
import { state, update, exportJSON, importJSON, exportCSV, storageWorks } from "./store.js";
import { $, num, toast, copyText, download, armButton } from "./ui.js";

// form field id -> [settings key, type]
const FIELDS = {
  "s-name": ["name", "text"], "s-phase": ["phase", "text"], "s-start": ["startBalance", "num"], "s-leverage": ["leverage", "num"],
  "s-target": ["profitTargetPct", "num"], "s-daily": ["dailyLossPct", "num"], "s-dailyBase": ["dailyBase", "text"],
  "s-max": ["maxLossPct", "num"], "s-maxType": ["maxLossType", "text"],
  "s-risk": ["defaultRisk", "num"], "s-riskBase": ["riskBase", "text"], "s-comm": ["commission", "num"], "s-step": ["lotStep", "num"],
};
const MIN = { startBalance: 1, leverage: 1, lotStep: 0.01 };

const status = msg => { $("s-status").textContent = msg; };

export function initSettings() {
  Object.entries(FIELDS).forEach(([id, [key, type]]) => {
    $(id).addEventListener(type === "num" ? "input" : "change", () => {
      const raw = $(id).value;
      if (type === "num") {
        const v = num(raw);
        if (!(v >= (MIN[key] ?? 0))) return; // keep the last valid value while typing
        update(s => { s.settings[key] = v; });
      } else {
        update(s => { s.settings[key] = raw; });
      }
    });
  });
  $("s-form").addEventListener("submit", e => e.preventDefault());

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
    update(s => { s.trades = []; });
    toast("Semua trade dihapus");
  });
}

function restore(text) {
  try {
    const n = importJSON(text);
    $("s-paste").value = "";
    status("Data dipulihkan: " + n + " trade.");
    toast("Backup dipulihkan");
  } catch (e) {
    status("Gagal memulihkan: " + (e instanceof SyntaxError ? "isi backup tidak lengkap atau rusak." : e.message));
  }
}

export function renderSettings() {
  Object.entries(FIELDS).forEach(([id, [key]]) => {
    if (document.activeElement !== $(id)) $(id).value = state.settings[key];
  });
  if (!storageWorks()) status("Browser ini tidak mengizinkan penyimpanan. Data akan hilang saat halaman ditutup.");
}
