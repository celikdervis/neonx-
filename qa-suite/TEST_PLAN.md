# Test Planı — Sosyal, Parti, Eşleştirme (Draft XI hariç)

## Ortam (doğrulanmış, 2026-11-19)

| Yetenek | Durum | Kanıt |
|---|---|---|
| Repo okuma/yazma, QA dalı | Var | Dal `claude/great-heisenberg-isoibx` (main değil) |
| Node / npm | Var | Node v22.23.5, npm 10.9.9 |
| Playwright + Chromium | Çalışıyor | @playwright/test 1.63.0, Chromium 157 |
| Ayrı tarayıcı oturumları | Çalışıyor | Her kullanıcı ayrı context; 4 eş zamanlı kullanıcı test edildi |
| Canlı Firebase / gstatic / GitHub Pages | **Erişim yok** | Proxy reddi (`connect_rejected`) |
| Firebase Emulator / CLI | **Kullanılmıyor** | Proje kuralı gereği kurulmadı |
| PeerJS bulut sunucusu, unpkg | **Erişim yok** | Proxy reddi |
| Gerçek iOS Safari | **Yok** | Bulut Linux konteyneri; yalnızca Chromium mobil emülasyonu mümkün |
| WebKit motoru | **Yok** | Yalnızca Chromium kurulu |

Çalışma iPhone'daki Claude uygulamasından yönetilse de komutlar bulut konteynerinde çalışıyor.
iPhone'un kendi tarayıcısına erişim yok.

## Yöntem

Uygulama kodu olduğu gibi sunulur (`scripts/preview-server.cjs`). Yalnızca Firebase SDK modülleri, Playwright
tarafından mock ile değiştirilir (bkz. `README.md`). Her senaryo için:

1. **Oracle:** test, mock veritabanının içeriğini doğrudan okur ("veritabanında ne oldu?").
2. **Kullanıcı ekranı:** her kullanıcının kendi sayfasında görmesi gereken metin ve butonlar kontrol edilir.
3. **Konsol:** `pageerror` kayıtları toplanır; beklenmeyen hata testi düşürür.
4. **Tekrar:** düzeltme sonrası `--repeat-each 5`; beşi de geçmeden PASS denmez.
5. **Ayırt edicilik:** düzeltme testleri, orijinal koda karşı da çalıştırılır ve FAIL vermeleri gerekir.

## Sayfa → çalışan kod haritası

| Sayfa | Parti/eşleştirme işlemlerini yürüten kod |
|---|---|
| `index.html` (ana sayfa) | `neon-social-drawer-v1.js` (arayüz). Ayrılma: `neon-party-membership-integrity-v2.js` (capture-phase yakalama). Eşleştirme: `neon-social-safe-v4.js`. Kurma/davet/kabul: `neon-social-consistency-v1.js` |
| XOX, Career Twin, Wordle, Arcade, Imposter | Eski panel `neon-social.js`. Ayrılma ve eşleştirme/iptal **buradaki** fonksiyonlarla çalışır. Kurma/davet/kabul/çıkış: `neon-social-consistency-v1.js` (capture-phase yakalama) |

`neon-party-membership-integrity-v2.js`, `drawer-v1` ve `safe-v4` yalnızca ana sayfada yüklenir. Bu nedenle
ana sayfadaki bir düzeltme, yan sayfalara otomatik olarak yansımaz.

## Öncelik sırası ve durum

| # | Alan | Durum |
|---|---|---|
| 1 | Parti/lobi (yan sayfalar) | B-01 düzeltildi; P-01…P-12 çalıştı |
| 2 | Sosyal/arkadaşlık | NOT TESTED (sıradaki) |
| 3 | Eşleştirme | B-02 düzeltildi; M-01…M-07 çalıştı; B-03 açık |
| 4 | Yan oyun çok oyunculu akışları | NOT TESTED |
| 5 | Kopma/yeniden bağlanma | Parti (P-09…P-11) ve kuyruk (M-04, M-05) için yapıldı; oyunlar için NOT TESTED |
| 6 | Mobil UX | NOT TESTED (yalnızca bir gözlem: UX-01) |
| 7 | Genel regresyon | Bu tur için yapıldı (`REGRESSION_LOG.md`) |
| 8 | Performans | NOT TESTED |
| — | Ana sayfa drawer arayüzü (tıklama ile) | NOT TESTED; yalnızca ayrılma API'si kontrol edildi |

## Sıradaki senaryolar (henüz çalıştırılmadı)

- **Arkadaşlık:** arama, istek gönderme/kabul/ret/iptal, çift yönlü eş zamanlı istek, arkadaşlıktan
  çıkarma (iki ekran), çevrim içi/dışı göstergesi, tekrar istek.
- **Parti:** lider oyunu başlatırken üyenin ayrılması (senaryo 5); ana sayfa drawer'ında üye atma
  ve hazır olma; ana sayfa ile yan sayfa arasında karışık kullanım.
- **Eşleştirme:** ana sayfadaki `safe-v4` yolunda B-02/B-03 eşdeğerleri; oda kodu ile özel oda.
- **Oyunlar:** XOX, Career Twin, Imposter, RE:VERSE odaları (Firebase `rooms/`, `reverseXI/rooms`);
  EN11 → BLOCKED (PeerJS); Wordle → tek oyunculu akış ve mobil görünüm.
