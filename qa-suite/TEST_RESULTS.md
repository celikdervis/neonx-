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
