# Regression Log

## Tur 1 — FIX-01 (B-01) ve FIX-02 (B-02) sonrası, 2026-11-19

Komut: `npx playwright test -c qa-suite --repeat-each 5` (26 test × 5 = 130 çalıştırma, 2 worker, mock RTDB)

| Sonuç | Sayı |
|---|---|
| PASS | 124 |
| FAIL | 6: M-07 × 5 ve M-06 × 1; ikisi de açık hata B-03, düzeltmelerden bağımsız |

FIX-01 için regresyon kapsamı (kullanıcının istediği liste):

| İşlev | Test | Sonuç |
|---|---|---|
| Parti oluşturma | P-01/02 | PASS 10/10 |
| Partiye katılma / davet kabul | P-01/02, P-06 | PASS |
| Davet gönderme | P-01/02 | PASS |
| Davet reddetme | P-03 | PASS |
| Liderlik devri | P-04, P-11, P-12 | PASS |
| Parti kapatma (son üye) | B-01 × 5 sayfa | PASS 50/50 |
| Eski davetle katılma | P-05 | PASS |
| Üye çıkarma | — | **NOT TESTED**: üye çıkarma arayüzü yalnızca ana sayfa drawer'ında var ve değişen kod onu etkilemiyor. Ayrıca test edilecek |

FIX-02 için regresyon kapsamı:

| İşlev | Test | Sonuç |
|---|---|---|
| 1v1 eşleşme (`matchQueues` yolu) | M-01 | PASS |
| 1v1 iptal + yeniden arama | M-02 | PASS |
| Imposter 3 kişilik eşleşme | M-03 | PASS |
| Kopma ve yenileme sırasında kuyruk temizliği | M-04, M-05 | PASS |

Mevcut `scripts/` testleri: değişiklikten önceki durumla aynı (yalnızca önceden de FAIL veren 2 test FAIL).
