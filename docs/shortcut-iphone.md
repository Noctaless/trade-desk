# Shortcut "Hitung Lot" untuk iPhone

Shortcut XAUUSD untuk akun 100K. Isi entry, SL, TP, dan risiko, lalu hasilnya muncul dan lot otomatis tersalin, siap ditempel di MT5.
Bisa dipanggil lewat Siri ("Hitung lot"), ikon di Home Screen, widget, atau Action Button.

Rumus: `lot = (balance × risiko%) ÷ (jarak SL × 100)`, dibulatkan **ke bawah** ke 0,01. 1 lot XAUUSD = 100 oz, jadi pergerakan $1 = $100 per lot.

Nama action ditulis dalam bahasa Inggris, dengan nama versi iPhone berbahasa Indonesia di dalam kurung.

## Langkah

Buka aplikasi **Shortcuts (Pintasan)** → **+** → beri nama **Hitung Lot**. Tambahkan action berikut secara berurutan. Ketik nama action di kolom pencarian bawah.

**Input**

1. **Ask for Input (Minta Input)**: Input Type **Number**, Prompt `Harga entry`.
   Ketuk panah ▸, aktifkan **Allow Decimal Numbers**.
2. **Set Variable (Atur Variabel)**: nama `Entry`, isi *Provided Input*.
3. **Ask for Input**: Number, desimal, Prompt `Harga SL`.
4. **Set Variable**: `SL`.
5. **Ask for Input**: Number, desimal, Prompt `Harga TP`.
6. **Set Variable**: `TP`.
7. **Ask for Input**: Number, desimal, Prompt `Risiko %`, Default Answer `1`.
8. **Set Variable**: `Risiko`.

**Hitung**

9. **Calculate (Hitung)**: `Entry` **−** `SL`.
10. **Calculate**: pilih operasi ilmiah **Absolute Value** (ketuk tanda operasi → *Scientific*) dari hasil langkah 9.
11. **Set Variable**: `Jarak`.
12. **Calculate Expression (Hitung Ekspresi)**: `100000 × Risiko ÷ 100 ÷ (Jarak × 100)`.
    Masukkan variabel lewat tombol variabel di atas keyboard.
13. **Round Number (Bulatkan Angka)**: **Round Down**, ke **Hundredths** (0,01).
14. **Set Variable**: `Lot`.
15. **Calculate Expression**: `Lot × Jarak × 100`, lalu **Set Variable** `Rugi`.
16. **Calculate**: `TP` **−** `Entry` → **Calculate** Absolute Value → **Set Variable** `JarakTP`.
17. **Calculate Expression**: `Lot × JarakTP × 100` → **Round Number** (Normal, Hundredths) → **Set Variable** `Profit`.
18. **Calculate Expression**: `JarakTP ÷ Jarak` → **Round Number** (Hundredths) → **Set Variable** `RR`.

**Arah**

19. **If (Jika)**: `SL` **is less than** `Entry`
    - **Text (Teks)**: `BUY` → **Set Variable** `Arah`
    - **Otherwise (Jika Tidak)**: **Text** `SELL` → **Set Variable** `Arah`
    - **End If**

**Hasil**

20. **Copy to Clipboard (Salin ke Papan Klip)**: `Lot`.
21. **Show Alert (Tampilkan Peringatan)**: judul `Arah · Lot lot`, isi:

```
Entry Entry · SL SL · TP TP
Rugi kalau SL: -$Rugi
Profit kalau TP: +$Profit
R:R 1 : RR
Batas daily loss The5ers: $3.000

Lot sudah tersalin, tinggal tempel di MT5.
```

Matikan **Show Cancel Button**.

## Supaya enak dipakai

- **Siri**: nama shortcut = perintahnya. Bilang "Hey Siri, hitung lot".
- **Home Screen**: buka shortcut → ikon bagikan → **Add to Home Screen**. Pilih ikon dan warna.
- **Action Button** (iPhone 15 Pro ke atas): Settings → Action Button → Shortcut → Hitung Lot.
- **Widget**: tahan Home Screen → **+** → Shortcuts → pilih Hitung Lot.

## Contoh untuk dicek

| Entry | SL | TP | Risiko | Lot | Rugi | Profit | R:R |
|---|---|---|---|---|---|---|---|
| 4105.5 | 4095.5 | 4130.5 | 1% | 1.00 | $1.000 | $2.500 | 2.5 (BUY) |
| 4105.5 | 4095.5 | 4130.5 | 0.5% | 0.50 | $500 | $1.250 | 2.5 (BUY) |
| 4100 | 4112.35 | 4080 | 1% | 0.80 | $988 | $1.600 | 1.62 (SELL) |

Kalau hasil shortcut kamu sama dengan tabel ini, rumusnya sudah benar.

## Catatan

- Shortcut ini khusus **XAUUSD** (contract 100 oz) dan balance **100.000**. Untuk akun lain, ganti angka `100000` di langkah 12. Untuk pair forex, ganti `100` di langkah 12, 15, dan 17 dengan `100000`, karena 1 lot forex = 100.000 unit (khusus pair yang quote-nya USD, seperti EURUSD).
- Shortcut tidak tahu rugi kamu hari ini dan tidak mencatat ke jurnal. Untuk sisa jatah daily loss, jurnal, dan statistik, pakai aplikasinya: https://noctaless.github.io/trade-desk/
