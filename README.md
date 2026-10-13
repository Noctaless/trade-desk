# Trade Desk

Kalkulator lot, jurnal trading, dan portofolio untuk funded account. Aplikasi ini web statis tanpa server: bisa dibuka di browser, di-install ke HP sebagai aplikasi (PWA), dan dipakai sebagai Telegram Mini App dari kode yang sama.

## Fitur

**Kalkulator**
- Hitung lot dari harga entry, SL, dan TP berdasarkan risiko per trade (%). Arah BUY atau SELL terbaca otomatis dari posisi SL.
- XAUUSD, XAGUSD, 7 major, dan 21 cross. Kurs konversi untuk cross (GBPJPY, EURGBP, dll.) diambil otomatis setiap hari dari kurs referensi ECB, dan masih bisa diisi manual.
- Menampilkan rugi kalau SL kena, profit kalau TP kena, R:R, margin, nilai per pip, dan sisa jatah daily loss hari ini (sudah dikurangi risiko posisi yang masih open).
- Tombol **Catat ke jurnal** langsung mengisi form trade.

**Jurnal**
- Catat setiap trade: lot, entry/SL/TP, waktu, harga exit, dan P/L. P/L dihitung otomatis dari harga exit tapi bisa diganti dengan angka dari MT4/MT5.
- Catatan: setup, kondisi mental, sesuai rencana atau tidak, link chart TradingView, dan catatan bebas.
- Filter per bulan, instrumen, dan hasil.

**Portofolio**
- Meter aturan prop firm: profit target, daily loss hari ini, dan max loss (statis atau trailing).
- Grafik kurva balance dengan garis batas max loss dan profit target.
- Statistik: win rate, profit factor, expectancy, rata-rata R, max drawdown, loss beruntun, dan persentase trade yang sesuai rencana.
- Kalender P/L harian.
- Rincian per instrumen, setup, sesi (Asia/London/New York), hari, dan arah.

**Akun**: aturan prop firm, risiko default, komisi, backup/restore (JSON), dan export CSV.

## Data

Semua data tersimpan di `localStorage` perangkat yang dipakai. Tidak ada server dan tidak ada data yang dikirim ke mana pun (selain request kurs ke API publik). Akibatnya:
- Data di Telegram (HP) dan di browser laptop **terpisah**. Pakai **Akun → Salin backup / Pulihkan** untuk memindahkan data.
- Lakukan backup secara rutin. Kalau data browser atau Telegram dihapus, jurnal ikut hilang.

## Menjalankan di komputer

Modul JavaScript tidak bisa dibuka langsung lewat `file://`, jadi jalankan server lokal:

```bash
cd trade-desk
python -m http.server 8765
# buka http://localhost:8765
```

## Deploy ke GitHub Pages

1. Push repo ini ke GitHub. Repo harus public untuk GitHub Pages gratis. Isi repo cuma kode, data trade kamu tidak ikut ter-upload.
2. Buka **Settings → Pages**, lalu pilih **Source: Deploy from a branch**, **Branch: `main`**, dan folder **`/ (root)`**.
3. Tunggu 1–2 menit. Aplikasi bisa dibuka di `https://<username>.github.io/trade-desk/`.

Untuk install ke HP: buka link di Chrome, lalu pilih menu ⋮ → **Add to Home screen**.

## Pasang sebagai Telegram Mini App

Tidak perlu server atau kode bot, cukup BotFather:

1. Chat [@BotFather](https://t.me/BotFather), kirim `/newbot`, lalu ikuti langkahnya (nama dan username bot).
2. Kirim `/mybots` → pilih bot → **Bot Settings** → **Menu Button** → **Configure menu button**, lalu kirim URL GitHub Pages kamu (`https://<username>.github.io/trade-desk/`) dan nama tombol, misalnya `Buka`.
3. Buka chat dengan bot kamu, lalu tekan tombol menu di samping kolom chat. Aplikasinya terbuka di dalam Telegram dan otomatis mengikuti tema terang/gelap Telegram.

Opsional: kirim `/newapp` di BotFather untuk membuat link langsung seperti `t.me/<bot>/<app>`.

## Asumsi perhitungan

- Contract size: forex 100.000 unit, XAUUSD 100 oz, XAGUSD 5.000 oz. Cek di MT4/MT5 (klik kanan simbol → Specification) dan ubah di **Kalkulator → Spesifikasi kontrak** kalau broker kamu berbeda.
- Lot dibulatkan ke bawah sesuai lot step, jadi risiko tidak pernah melebihi target.
- Spread dan swap tidak dihitung di kalkulator. Komisi dihitung kalau diisi di tab Akun.
- Hari dihitung pakai jam perangkat. Prop firm biasanya reset daily loss pakai jam server (sering tengah malam CE(S)T).

## Struktur

```
index.html            semua tab dan form trade
css/style.css
js/main.js            tab, integrasi Telegram, service worker
js/core.js            rumus lot, P/L, statistik (tanpa DOM, bisa dites dengan Node)
js/instruments.js     spesifikasi instrumen dan konversi kurs
js/rates.js           ambil kurs harian
js/store.js           penyimpanan dan backup
js/calc.js, journal.js, portfolio.js, settings.js, ui.js
sw.js                 cache untuk offline
```
