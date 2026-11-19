# Test Results — 2026-11-19

Ortam: **Mock RTDB + Chromium 157 (Playwright 1.63)**, gerçek Firebase değil. Kullanıcılar ayrı browser context'leri.
Sayılar, gerçekten çalıştırılan çalıştırmalardır. Başarı oranı = PASS / (PASS + FAIL).

## Yeni QA paketi (`qa-suite/tests`)

| Test | Kullanıcı | Çalıştırma | PASS | FAIL | Durum |
|---|---|---|---|---|---|
| Mock ↔ gerçek SDK uygunluğu (17 durum) | — | 1 + 5 | 6 | 0 | PASS |
| B-01 × 5 yan sayfa (son durum) | 2 | 25 + 25 | 50 | 0 | PASS |
| B-01 ana sayfa kontrolü | 1 | 5 + 5 | 10 | 0 | PASS |
| B-02 Imposter iptali (son durum) | 3 | 5 + 5 | 10 | 0 | PASS |
| P-01/02 kur, davet, kabul | 2 | 1 + 5 + 5 | 11 | 0 | PASS |
| P-03 daveti reddet | 2 | 1 + 5 + 5 | 11 | 0 | PASS |
| P-04 lider ayrılır, liderlik devri | 2 | 1 + 5 + 5 | 11 | 0 | PASS |
| P-05 parti kapandıktan sonra eski davet | 2 | 1 + 5 + 5 | 11 | 0 | PASS |
| P-06 iki kullanıcı aynı anda kabul eder | 3 | 1 + 5 + 5 | 11 | 0 | PASS |
| P-07 iki parti daveti aynı anda kabul edilir | 3 | 1 + 5 + 5 | 11 | 0 | PASS |
| P-08 yenileme sonrası lobi korunur | 2 | 1 + 5 + 5 | 11 | 0 | PASS |
| P-09 üye kopup süre dolmadan geri gelir | 2 | 1 + 5 + 5 | 11 | 0 | PASS |
| P-10 üye süreden uzun çevrim dışı kalır | 2 | 1 + 5 + 5 | 11 | 0 | PASS |
| P-11 lider süreden uzun çevrim dışı kalır | 2 | 1 + 5 + 5 | 11 | 0 | PASS |
| P-12 dört kullanıcı, iki ayrılma | 4 | 1 + 5 + 5 | 11 | 0 | PASS |
| M-01 1v1 eşleşme | 2 | 1 + 5 + 5 + 8 | 19 | 0 | PASS |
| M-02 1v1 iptal ve yeniden arama | 2 | 1 + 5 + 5 | 11 | 0 | PASS |
| M-03 Imposter 3 kişilik eşleşme | 3 | 1 + 5 + 5 + 8 | 19 | 0 | PASS |
| M-04 arama sırasında bağlantı kopması | 2 | 1 + 5 + 5 | 11 | 0 | PASS |
| M-05 arama sırasında yenileme | 2 | 1 + 5 + 5 | 11 | 0 | PASS |
| M-06 iptal ve rakip araması aynı anda (doğal zamanlama) | 2 | 1 + 5 + 10 + 5 + 8 | 28 | 1 | **FAIL** (B-03) |
| M-07 aynı yarış, A'nın bağlantısı yavaş | 2 | 5 + 5 | 0 | 10 | **FAIL** (B-03) |

**Test düzeneği kaynaklı başarısızlıklar (ürün hatası değil, sayılara dahil değil):**
- B-01 düzeltmesinden sonraki ilk 5'li tur: 30 çalıştırmanın 14'ü FAIL. Sebep testin kendisiydi: B'nin parti işaretçisi,
  ikinci transaction tamamlanmadan anında kontrol ediliyordu. Test bekleme ile düzeltildi (bkz. OBS-01); sonraki turlar 30/30 PASS.
- B-02 düzeltmesinden sonraki ilk 5'li tur: 5/5 FAIL. Sebep: iptal sonrası açık kalan sosyal panel, test tarafından tıklanan
  sayfa butonunu örtüyordu. Test, gerçek kullanıcının yapacağı gibi paneldeki "RAKİP ARA" butonunu kullanacak şekilde düzeltildi.

Düzeltme öncesi yeniden üretim çalıştırmaları (B-01: 25 FAIL, B-02: 11 FAIL, orijinal koda karşı ayırt edicilik
kontrolleri) yukarıdaki sayılara dahil değildir; bunlar `BUG_TRACKER.md` içinde kayıtlı.

### Modül özeti (son kod)

| Modül | Toplam çalıştırma | PASS | FAIL | Başarı oranı | Not |
|---|---|---|---|---|---|
| Parti/lobi | 181 | 181 | 0 | %100 | B-01 (60) + P-01…P-12 (11 test × 11) |
| Eşleştirme | 120 | 109 | 11 | %90,8 | Başarısızların tamamı B-03 (açık) |
| Sosyal/arkadaşlık | 0 | — | — | — | NOT TESTED |
| Yan oyunlar | 0 | — | — | — | NOT TESTED |
| Mobil UX | 0 | — | — | — | NOT TESTED |

## Mevcut `scripts/` testleri (son kodla)

| Test | Sonuç |
|---|---|
| test_social_system, test_social_drawer_integrity, test_social_identity_sync, test_party_membership_integrity, test_social_consistency, test_runtime_hygiene, test_core_patch_contracts, test_xox_data_integrity | PASS |
| test_arcade_navigation, test_neon_entry, test_home_hotspots | PASS |
| test_imposter_realtime_render, test_xox_answer_review | FAIL (bu çalışmadan önce de FAIL; bkz. OBS-02) |


---

# Test Results — Tur 3 (RE:VERSE, mobil/performans, XOX), 2026-11-19

Ortam aynı: mock RTDB + Chromium. Görsel testler gerçek yazı tipleriyle (`QA_FONTS_DIR`) ve yedek yazı tipiyle ayrı ayrı çalıştırıldı.

| Test | Çalıştırma | PASS | FAIL | Not |
|---|---|---|---|---|
| RE:VERSE R-01…R-10, R-02b (16 test) | 5 tekrar + son regresyon | 80 + 16 | 0 | Orijinal koda karşı: 11 FAIL / 4 PASS (ayırt edici) |
| XOX X-01 (3 cihaz), X-02 (20 tahta) | 5 tekrar + yedek yazı tipi + son regresyon | 20 + 4 + 4 | 0 | Orijinal kodda X-01 oyuncu seçimi 3/3 cihazda tıklanamıyordu |
| EN11 G-01 dokunma alanı | 1 + son regresyon | 2 | 0 | |
| Tüm paket (son regresyon) | 1 | 46 | 1 | Tek FAIL: M-07 = açık B-03 |

Performans (orta seviye mobil, soğuk, n=3): ana ekran görselleri 48,1 → 21,3 sn; yeni kullanıcı giriş 60,5 → 22,0 sn;
yükleme ekranı 4 farklı ekrandan 1 ekrana; arkadan sızma 0 kare (bkz. PERFORMANCE_REPORT §9).

Gerçek cihaz (iOS Safari, Android Chrome), gerçek Firebase ve gerçek izin pencereleri: **BLOCKED** (BLOCKED_TESTS.md).

---

# Test Results — Tur 4 (Career Twin, Wordle, B-03), 2026-11-19

Ortam aynı: mock RTDB + Chromium. Sayılar bu turda gerçekten çalıştırılanlardır.

| Test | Çalıştırma | PASS | FAIL | Not |
|---|---|---|---|---|
| T-01 Career Twin menüsü, 7 profil (SE, 8, 13 Mini, Galaxy S8, Pixel 7, 14 Pro Max, masaüstü) + T-02 RAKİP ARA akışı | gerçek yazı tipi 5 tekrar + yedek yazı tipi 1 + ekran görüntüsü turu | 40 + 8 + 4 | 0 | Düzeltme öncesi: "OYUN MODU" çakışması 7/7 profilde; kart RAKİP ARA'yı ≤700 px'te (3 profil) kapatıyordu, iki profilde buton tıklanamıyordu |
| W-01/W-02 Wordle (7 cihaz + yazma) | gerçek yazı tipi 3 tekrar + yedek 1 | 24 + 8 | 0 | Yeniden doğrulama (düzeltme `df7e5d0`) |
| M-06 iptal + arama aynı anda (doğal) | düzeltmeden sonra | 14 | 0 | Sonuç: iki taraf da kuyrukta değil |
| M-07 aynı yarış, A'nın bağlantısı yavaş | düzeltmeden sonra | 14 | 0 | Sonuç: ikisi de aynı odada |
| M-08 Imposter 3 kişi, yavaş iptal (yeni) | düzeltmeden sonra | 9 | 0 | Üçü aynı odada, `nxPartySize=3` |
| M-09 ana sayfa (`safe-v4`), yavaş iptal (yeni) | düzeltmeden sonra | 9 | 0 | |
| M-10 ana sayfada normal iptal (yeni) | düzeltmeden sonra | 9 | 0 | |
| Orijinal koda karşı ayırt edicilik (M-06…M-10 × 2) | 1 | 4 | 6 | M-07, M-08, M-09 2/2 FAIL (hata yeniden üretildi); M-06, M-10 PASS. Sayılara dahil değil |
| Sosyal regresyon (matchmaking + party + B-01 + B-02) | 2 | 56 | 0 | |
| Tüm paket | 1 | 67 | 0 | 1 skipped (mock-conformance, SDK yolu verilmedi); ayrıca SDK ile 1/1 PASS |
| `scripts/` sosyal ve sözleşme testleri (10 adet) | 1 | 10 | 0 | test_imposter_realtime_render ve test_xox_answer_review bu turda çalıştırılmadı (önceden de FAIL) |

Draft modunun eşleştirme iptali: **NOT TESTED** (kapsam dışı, kod değiştirilmedi).
