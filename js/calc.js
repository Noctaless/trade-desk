// Kalkulator lot tab.
import { PAIRS, CONV, needsConversion, marketRate, quoteToUSD } from "./instruments.js";
import { sizePosition, computeStats } from "./core.js";
import { state, update, contractFor, cfg, accountTrades } from "./store.js";
import { $, num, fmt, usd, pct, fillPairSelect, toast, copyText } from "./ui.js";

const RISKS = [0.25, 0.5, 1, 1.5, 2];
let onSaveToJournal = () => {};
let last = null; // last sizing result, for "Catat ke jurnal"

export function convRateFor(quote) {
  const manual = state.calc.convManual[quote];
  return manual > 0 ? manual : marketRate(quote, state.rates && state.rates.usdPer);
}

export function initCalc({ onSave }) {
  onSaveToJournal = onSave;
  fillPairSelect($("c-pair"));
  $("c-riskChips").innerHTML = RISKS.map(r => '<button type="button" class="chip" data-r="' + r + '">' + r + "%</button>").join("");
  $("c-riskChips").addEventListener("click", e => {
    const b = e.target.closest(".chip"); if (!b) return;
    $("c-risk").value = b.dataset.r;
    readInputs();
  });

  ["c-risk", "c-entry", "c-sl", "c-tp"].forEach(id => $(id).addEventListener("input", readInputs));
  $("c-conv").addEventListener("input", () => {
    const p = PAIRS[state.calc.pair], v = num($("c-conv").value);
    update(s => { if (v > 0) s.calc.convManual[p.quote] = v; else delete s.calc.convManual[p.quote]; }, { silent: true });
    renderCalc();
  });
  $("c-convAuto").addEventListener("click", () => {
    const p = PAIRS[state.calc.pair];
    update(s => { delete s.calc.convManual[p.quote]; }, { silent: true });
    loadPair(); renderCalc();
  });
  $("c-contract").addEventListener("input", () => {
    const p = PAIRS[state.calc.pair], v = num($("c-contract").value);
    update(s => { if (v > 0 && v !== p.contract) s.settings.contract[p.s] = v; else delete s.settings.contract[p.s]; }, { silent: true });
    renderCalc();
  });
  $("c-pair").addEventListener("change", () => {
    update(s => { s.calc.pair = $("c-pair").value; }, { silent: true });
    loadPair(); renderCalc();
  });

  $("c-copy").addEventListener("click", async () => {
    if (!last || !(last.lots > 0)) return;
    toast((await copyText(fmt(last.lots, 2))) ? "Lot " + fmt(last.lots, 2) + " tersalin" : "Gagal menyalin. Salin manual dari angka di atas.");
  });
  $("c-save").addEventListener("click", () => {
    if (!last || !(last.lots > 0)) return;
    const pr = state.calc.prices[state.calc.pair] || {};
    onSaveToJournal({ pair: state.calc.pair, dir: last.dir, lots: last.lots, entry: pr.entry, sl: pr.sl, tp: pr.tp });
  });

  loadPair();
}

function readInputs() {
  const p = PAIRS[state.calc.pair];
  const val = id => ($(id).value.trim() === "" ? "" : num($(id).value));
  update(s => {
    const r = num($("c-risk").value);
    s.calc.risk = r > 0 ? r : null;
    s.calc.prices[p.s] = { entry: val("c-entry"), sl: val("c-sl"), tp: val("c-tp") };
  }, { silent: true });
  renderCalc();
}

function loadPair() {
  const p = PAIRS[state.calc.pair] || PAIRS.XAUUSD;
  $("c-pair").value = p.s;
  const pr = state.calc.prices[p.s] || {};
  $("c-entry").value = pr.entry ?? ""; $("c-sl").value = pr.sl ?? ""; $("c-tp").value = pr.tp ?? "";
  const stepAttr = (1 / 10 ** p.digits).toFixed(p.digits);
  ["c-entry", "c-sl", "c-tp"].forEach(id => ($(id).step = stepAttr));
  $("c-contract").value = contractFor(p);
  $("c-contractHint").textContent = "Default " + p.s + ": " + p.contract.toLocaleString("en-US") + ". Cek di MT4/MT5: klik kanan simbol → Specification.";
  $("c-convBox").hidden = !needsConversion(p);
  if (needsConversion(p)) $("c-conv").value = convRateFor(p.quote);
}

export function renderCalc() {
  const st = cfg();
  const p = PAIRS[state.calc.pair] || PAIRS.XAUUSD;
  if (document.activeElement !== $("c-risk")) $("c-risk").value = state.calc.risk ?? st.defaultRisk;
  const riskPct = num($("c-risk").value);
  document.querySelectorAll("#c-riskChips .chip").forEach(b => b.setAttribute("aria-pressed", String(num(b.dataset.r) === riskPct)));

  // conversion info
  if (needsConversion(p)) {
    const c = CONV[p.quote], manual = state.calc.convManual[p.quote] > 0, r = state.rates;
    $("c-convLabel").textContent = "Kurs " + c.pair;
    if (document.activeElement !== $("c-conv")) $("c-conv").value = +convRateFor(p.quote).toFixed(c.inv ? 3 : 5);
    $("c-convAuto").hidden = !manual || !r;
    $("c-convHint").textContent = manual ? "Diisi manual." :
      r ? "Otomatis, kurs referensi " + r.source + " tanggal " + r.date + ". Cukup akurat untuk hitung lot." :
      "Kurs perkiraan karena kurs online belum didapat. Ganti dengan kurs " + c.pair + " di MT4/MT5.";
  }

  const stats = computeStats(accountTrades(), st);
  const riskBalance = st.riskBase === "current" ? stats.balance : st.startBalance;
  $("c-basis").textContent = st.name + " · risiko dihitung dari " + (st.riskBase === "current" ? "balance sekarang " : "balance awal ") + usd(riskBalance, 0) +
    " · leverage 1:" + st.leverage + (st.commission > 0 ? " · komisi " + usd(st.commission) + "/lot" : "") + " · daily loss " + st.dailyLossPct + "%. Ubah di tab Akun.";

  const pr = state.calc.prices[p.s] || {};
  const entry = num(pr.entry), sl = num(pr.sl), tp = num(pr.tp);
  const qUSD = quoteToUSD(p, entry, convRateFor(p.quote));
  const r = sizePosition({
    entry, sl, tp, contract: contractFor(p), qUSD, riskBalance, riskPct,
    comm: st.commission, step: st.lotStep > 0 ? st.lotStep : 0.01, leverage: st.leverage, balance: stats.balance,
  });

  const msgs = [];
  if (!(entry > 0) || !(sl > 0)) msgs.push(["err", "Isi harga entry dan SL."]);
  else if (entry === sl) msgs.push(["err", "SL tidak boleh sama dengan entry."]);
  else if (!r.tpValid) msgs.push(["err", r.dir === "BUY" ? "Untuk BUY (SL di bawah entry), TP harus di atas entry." : "Untuk SELL (SL di atas entry), TP harus di bawah entry."]);
  if (!(riskPct > 0)) msgs.push(["err", "Isi risiko per trade (%)."]);
  if (!(contractFor(p) > 0)) msgs.push(["err", "Contract size harus lebih dari 0."]);

  const side = $("c-side");
  side.className = "side " + (r.dir ? r.dir.toLowerCase() : "none");
  side.textContent = r.dir || "—";

  const ids = ["c-sRisk", "c-sProfit", "c-sRR", "c-sMargin", "c-sPip", "c-sMaxLot", "c-sDaily", "c-sHits"];
  if (r.ok && !msgs.length) {
    const st2 = st.lotStep > 0 ? st.lotStep : 0.01;
    if (r.belowMin) msgs.push(["warn", "SL terlalu lebar untuk risiko " + riskPct + "%. Lot minimum " + fmt(st2, 2) + " sudah berisiko " + usd(r.minLotRisk) + "."]);
    if (r.lots > r.maxLot) msgs.push(["err", "Margin tidak cukup. Lot maksimal dengan leverage 1:" + st.leverage + " adalah " + fmt(r.maxLot, 2) + "."]);
    else if (r.margin > stats.balance * 0.5) msgs.push(["warn", "Margin terpakai " + fmt(r.margin / stats.balance * 100, 0) + "% dari balance."]);
    const rem = stats.today.remaining;
    if (stats.today.limit > 0 && r.actualRisk > rem) {
      msgs.push(["err", "Kalau SL kena, kamu tembus batas daily loss. Sisa jatah hari ini " + usd(Math.max(rem, 0), 0) +
        (stats.openRisk > 0 ? " (sudah dikurangi risiko " + stats.openCount + " posisi open)" : "") + "."]);
    }
    if (r.rr !== null && r.rr < 1) msgs.push(["warn", "Reward lebih kecil dari risiko (R:R di bawah 1)."]);
    if (stats.openCount > 0) msgs.push(["warn", "Ada " + stats.openCount + " posisi open di jurnal dengan total risiko " + usd(stats.openRisk, 0) + "."]);

    $("c-lots").innerHTML = fmt(r.lots, 2) + "<small>lot</small>";
    $("c-sRisk").textContent = "-" + usd(r.actualRisk) + " (" + pct(r.actualRisk / riskBalance * 100) + ")";
    $("c-sProfit").textContent = r.profit === null ? "isi TP" : usd(r.profit, 2, true) + " (" + pct(r.profit / riskBalance * 100) + ")";
    $("c-sRR").textContent = r.rr === null ? "—" : "1 : " + fmt(r.rr, 2);
    $("c-sMargin").textContent = usd(r.margin);
    $("c-kPip").textContent = "Nilai per " + p.pipName + " / lot";
    $("c-sPip").textContent = usd(p.pip * contractFor(p) * qUSD);
    $("c-sMaxLot").textContent = fmt(r.maxLot, 2);
    $("c-sDaily").textContent = stats.today.limit > 0 ? usd(Math.max(rem, 0), 0) + " dari " + usd(stats.today.limit, 0) : "—";
    $("c-sDaily").className = "v " + (stats.today.limit > 0 && r.actualRisk > rem ? "neg" : "");
    $("c-sHits").textContent = stats.today.limit > 0 && r.actualRisk > 0 ? Math.max(0, Math.floor(rem / r.actualRisk + 1e-9)) + "× SL" : "—";
    drawLadder(p, r, entry, sl, tp);
    last = r;
  } else {
    $("c-lots").innerHTML = "0.00<small>lot</small>";
    ids.forEach(id => ($(id).textContent = "—"));
    $("c-track").innerHTML = ""; $("c-labels").innerHTML = "";
    last = null;
  }
  $("c-copy").disabled = $("c-save").disabled = !(last && last.lots > 0);
  $("c-msgs").innerHTML = msgs.map(m => '<p class="msg' + (m[0] === "err" ? " err" : "") + '">' + m[1] + "</p>").join("");
}

function drawLadder(p, r, entry, sl, tp) {
  const pips = d => fmt(d / p.pip, d / p.pip >= 100 ? 0 : 1) + " pip";
  const px = v => fmt(v, p.digits);
  const tpW = r.hasTp ? r.tpDist : r.slDist * 0.6;
  const total = tpW + r.slDist;
  const profitZ = '<div class="zone profit" style="flex-grow:' + tpW / total + '"></div>';
  const lossZ = '<div class="zone loss" style="flex-grow:' + r.slDist / total + '"></div>';
  const buy = r.dir === "BUY";
  $("c-track").innerHTML = buy ? profitZ + lossZ : lossZ + profitZ;
  const entryTop = (buy ? tpW : r.slDist) / total * 100;
  const tpTag = "<b>TP</b> " + (r.hasTp ? px(tp) + ' <span class="d">' + pips(r.tpDist) + "</span>" : '<span class="d">belum diisi</span>');
  const slTag = "<b>SL</b> " + px(sl) + ' <span class="d">' + pips(r.slDist) + "</span>";
  $("c-labels").innerHTML =
    '<div class="tag top">' + (buy ? tpTag : slTag) + "</div>" +
    '<div class="tag" style="top:' + Math.min(Math.max(entryTop, 22), 78) + '%"><b>Entry</b> ' + px(entry) + "</div>" +
    '<div class="tag bot">' + (buy ? slTag : tpTag) + "</div>";
}
