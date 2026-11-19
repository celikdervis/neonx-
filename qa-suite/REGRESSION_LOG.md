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


---

## Tur 4 regresyonu (2026-11-19)

| Değişiklik | Etkilenebilecek akışlar | Yeniden çalıştırılan | Sonuç |
|---|---|---|---|
| FIX-08 Career Twin menüsü | Menü eylemleri, RAKİP ARA → sosyal panel | T-01 (7 profil), T-02, `test_runtime_hygiene`, `test_social_system`, `test_arcade_navigation` | PASS |
| FIX-09 B-03 iptal transaction'ı | 1v1/Imposter eşleşme, iptal, kopma, yenileme, parti | M-01…M-10, B-01, B-02, P-01…P-12 (× 2), sosyal `scripts/` testleri | PASS |
| FIX-10 splash | Ana ekran açılışı, Draft maç ön yükleyicisinin `show()` çağrısı | S-01 (tekrar gösterim dahil), tüm paket | PASS |
| FIX-11 yerel yazı tipleri | Tüm yan sayfaların tipografisi, düzen testleri | F-01, X-01/02/03, W-01/02, T-01, G-01/02, R-01…R-12 | PASS |
| FIX-12 PeerJS | EN11 oda kurma (kütüphane yükleme) | PJ-01 | PASS (P2P oyun BLOCKED) |
| FIX-13 görsel/dokunma | XOX menüsü, EN11 parametre seçimi | X-03, G-02, xox-visual tamamı | PASS |
| Son durum | — | Tüm paket 84/84, `scripts/` 20/20 | PASS |
