# NEON XI — Kapsamlı QA, Düzeltme ve Mobil Hazırlık Raporu

**Tarih:** 2026-11-19 · **Dal:** `claude/great-heisenberg-isoibx` (main'e birleştirilmedi, yayına alınmadı, canlı sisteme dokunulmadı)
**Ortam:** Mock Firebase RTDB + Chromium (Playwright). Gerçek Firebase, gerçek iPhone/Android ve WebKit bu ortamda yok; bunlara bağlı her şey aşağıda **BLOCKED** olarak ayrıca yazıldı.

Bu rapor, dalın tamamını (Tur 1–4) özetler. Ayrıntılar: `BUG_TRACKER.md`, `FIX_LOG.md`, `TEST_RESULTS.md`, `REGRESSION_LOG.md`,
`PERFORMANCE_REPORT.md`, `MOBILE_APP_READINESS.md`, `BLOCKED_TESTS.md`, `SECURITY_BACKLOG.md`.

---

## 1. Kısa sonuç

- Öncelik sırasının altısı da ele alındı. Kod tarafında yapılabilecek her şey yapıldı ve testlendi.
  1. RE:VERSE mikrofonu gerçek cihaz testine hazır.
  2. Mobil ve performans iyileştirmeleri yapıldı.
  3. Wordle ve Career Twin düzen sorunları çözüldü.
  4. B-03 çözüldü (Draft modu hariç).
  5. XOX ve diğer oyunların görsel kalitesi iyileştirildi.
  6. Mağaza hazırlığı ilerledi.
- **Son regresyon:** `qa-suite` 84/84 PASS, `scripts/` 20/20 PASS. Şu anda **başarısız test yok.**
- **Hâlâ açık olanlar (ayrıntı §6):**
  - Gerçek cihaz testleri (BLOCKED).
  - Draft'a bitişik performans sorunları; boşta CPU'nun %82'si bu dosyalarda ve bunlar dokunulmaz listede.
  - Güvenlik kuralları.
  - Mağaza engelleri E-1…E-5, E-7, E-8: ürün ve hesap kararı gerektiriyor.
- **Dokunulmaz alanlar korundu:**
  - Draft XI, Draft Turnuvası, kimya, maç motoru, stadyum görseli, `online-mobile-navigation-fix-v1.js`, `prematch-mobile-v2.js` ve canlı Firebase.
  - Hiçbiri değişmedi; `git diff main..dal` taramasında bu dosyalardan hiçbiri yok.
  - Draft testleri yalnızca doğrulama için çalıştırıldı ve geçti.

## 2. Neler değişti

| Alan | Değişiklik | Commit |
|---|---|---|
| Sosyal / parti | Yan sayfalarda son üyenin partiden ayrılamaması düzeltildi (transaction ile ayrılma) | `60741a5` |
| Eşleştirme | Imposter iptali yanlış kuyruğu siliyordu; düzeltildi | `9eb3fc5` |
| Eşleştirme | **B-03:** yavaş bağlantıda iptal ile eşleşme çakışınca rakip boş odaya gidiyordu. İptal artık kendi kuyruk kaydında transaction; eşleşme önce geldiyse oyuncu eşleşmeye gidiyor. Yan sayfalar + ana sayfa; Draft modu hariç | `b4ff5bf` |
| RE:VERSE | Mikrofon tek yakalama hattıyla yeniden kuruldu: iOS dokunuş kuralı, örnekleme, sessiz/kısa kayıt kontrolü, arka plana geçince mikrofonu bırakma, anlaşılır hata mesajları. Tur başlığı güncellenmiyordu; düzeltildi. Seviye göstergesi ve `?micdebug=1` tanı paneli eklendi | `6287df8`, `c168ec1`, `fb81292` |
| Açılış | Tek opak yükleme ekranı (eskiden 4 farklı ekran ve arkadan sızma vardı). Ana ekran ve giriş görselleri WebP oldu (−5.161 KB) | `9254e1d` |
| Futbol XOX | Oyuncu seçme penceresi alt çubuğun üstüne alındı. Tahtada isimler okunur, kazanma çizgisi isimlerin altında, sonuç kartı görünür. Menü paneli "OYUN MODU" etiketi kırpılmıyor | `97b4dca`, `14d3b01` |
| Football Wordle | Kısa telefonlarda klavye alt çubuğun altında kalıyordu; tahta sığdırıldı. Başlık artık kesilmiyor | `df7e5d0` |
| Career Twin | "Nasıl oynanır" kartı kısa ekranlarda RAKİP ARA'yı kapatıyordu. "OYUN MODU" başlığı tüm boyutlarda ilk butonun arkasındaydı. İkisi de düzeltildi | `694da9d` |
| EN11 | Geri bağlantısı ve "EN YÜKSEK / EN DÜŞÜK" düğmeleri 44 px dokunma alanı aldı; görünüm değişmedi | `442959b`, `14d3b01` |
| Performans | Splash animasyonu ve sayacı kalktıktan sonra da çalışıyordu; durduruldu | `bea1370` |
| Mobil / uygulama hazırlığı | Yan oyunların yazı tipleri yerelde (`assets/fonts`, OFL), Google Fonts isteği 0. PeerJS yerelde (`vendor/peerjs`), unpkg isteği 0 | `32400ab`, `7d59f0e` |
| Tipografi | 21 yazı tipi tanımına genel yedek eklendi; yüklenirken serif (Times) görünmüyor | `14d3b01` |
| Testler | Önceden FAIL veren iki proje testi eski test verisi yüzünden kırıktı; düzeltildi, ürün kodu değişmedi | `9b08611` |
| QA altyapısı | `qa-suite/`: mock Firebase, çok kullanıcılı Playwright testleri, performans ölçüm araçları, belgeler | `a976181` ve sonrası |

**Kullanıcının fark edeceği davranış değişikliği (B-03):**
- İptal, rakibin eşleştirmesinden sonra sunucuya ulaşırsa oyuncu "Eşleşme zaten bulundu. Oyun açılıyor…" mesajıyla maça gider.
- Önceki davranışta oyuncu kalıyordu ve rakip boş odaya gidiyordu.
- Eşleşmeyi bozup rakibi kuyruğa geri almak da mümkün, ama daha karmaşık. Tercih farklıysa değiştirilebilir.

## 3. Çözülen sorunlar

| ID | Oyun / modül | Sorun | Doğrulama |
|---|---|---|---|
| B-01 | Parti (yan sayfalar) | Son üye partiden ayrılamıyordu | 5 sayfa × 2 kullanıcı; 60/60 PASS; orijinalde 25 FAIL |
| B-02 | Imposter eşleştirme | İptal edilen oyuncu kuyrukta kalıp eşleşiyordu | 10/10 PASS; orijinalde 11 FAIL |
| B-03 | Eşleştirme (XOX, Twin, Imposter; yan sayfa + ana sayfa) | Yavaş iptal + eşleşme → rakip boş odada | M-06…M-10 ilk 5'li turda 25/25, toplam 55/55 PASS; orijinalde M-07/M-08/M-09 6/6 FAIL |
| B-04 | RE:VERSE | Mobilde sessiz, takılan veya belirsiz hatalı kayıt | R-01…R-12, sahte mikrofonla ters çevirme doğrulandı; orijinalde 11 FAIL. **Gerçek cihaz BLOCKED** |
| B-05 | RE:VERSE | Adım başlığı hiç güncellenmiyordu | R testleri PASS |
| B-06 | XOX | Oyuncu seçme penceresi alt çubuğun altında, tıklanamıyordu | X-01, 3 cihaz; orijinalde 3/3 tıklanamıyordu |
| UX-03…05 | XOX | Tahtada isim taşması, çizgi isimlerin üstünde, sonuç kartı görünmüyor | X-01/X-02 (20 tahta) |
| UX-06 | EN11 | Geri bağlantısı 16 px yüksekliğinde | G-01 |
| UX-07 | Wordle | iPhone 8/13 mini'de klavye alt çubuğun altında, başlık kesik | W-01/W-02, 7 cihaz |
| UX-08 | Career Twin | Kart RAKİP ARA'yı kapatıyor, başlık butonun arkasında | T-01/T-02, 7 profil; orijinalde başlık çakışması 7/7, kart çakışması 3/7, RAKİP ARA 2 profilde tıklanamıyor |
| UX-09 | XOX | "OYUN MODU" panelin kesik köşesinde kırpılıyor | X-03; orijinalde 3/3 FAIL |
| UX-10 | EN11 | Yön düğmeleri 30 px yüksekliğinde | G-02; orijinalde FAIL |
| UX-11 | Nasıl Oynanır, Imposter, RE:VERSE | Yazı tipi yedeği yok, yüklenirken serif görünüyor | Kod incelemesi + ekran görüntüsü |
| PERF-01 | Açılış | Saydam yükleme örtüsü, eski ekranın sızması | Kare kare film şeridi: sızma 0 kare |
| PERF-03/04 | Ana ekran / giriş | 3,8 MB + 2,2 MB PNG | Orta mobil: görseller 48,1 → 21,3 sn; giriş 60,5 → 22,0 sn |
| PERF-09 | Splash | Kalktıktan sonra döngü sürüyor | S-01: 287 → 0 çizim / 12 sn |
| OBS-02 | Proje testleri | İki test önceden FAIL | Eski test verisi; ikisi de PASS |

## 4. Değiştirilen dosyalar

**Ürün kodu:**
- `social/neon-social.js` (B-01, B-02, B-03)
- `social/neon-social-safe-v4.js` (B-03, Draft modu hariç)
- `side-games/reverse-xi/reverse-xi.js`, `reverse-xi.css`, `index.html`
- `side-games/football-xox/xox-board-motion.js`, `xox-board-motion.css`, `xox-dark-arena.css`, `unified-menu.css`, `xox-premium-game-v2.css`, `index.html`
- `side-games/football-wordle/index.html`
- `side-games/career-twin/xox-family-ui-v1.css`, `premium-mobile.css`, `game.js` (yalnızca PeerJS yolu), `index.html`
- `side-games/en11/index.html`
- `side-games/how-to-play.html`
- `side-games/index.html`
- `side-games/imposter-xox-family-v1.css`
- `side-games/online-v2.js` (yalnızca yazı tipi yedeği)
- `side-games/futbol-imposter.html` (önbellek etiketleri)
- `side-games/parts/part01.txt` (yazı tipi), `side-games/parts/part05.txt` (PeerJS yolu)
- `side-games/home-approved-v1.js`, `side-games/neon-entry-v1.js`, `neon-entry-v1.css` (WebP)
- `side-games/neon-splash-safe-v1.js`
- `index.html`: yükleme ekranı ve `VERSION` önbellek etiketi. Yalnızca açılış katmanı; çekirdek ve Draft kodu değişmedi.

**Yeni varlıklar:**
- 3 WebP görsel.
- `assets/fonts/`: `neon-fonts.css`, 34 woff2 dosyası (546 KB, sayfa yalnızca kullandığını indirir) ve 4 OFL lisansı.
- `vendor/peerjs/`: npm paketiyle aynı dosya ve MIT lisansı.

**Araç ve test:**
- `scripts/build_self_hosted_fonts.mjs`
- `scripts/test_imposter_realtime_render.cjs`, `scripts/test_xox_answer_review.cjs`
- `package.json`, `package-lock.json` (yalnızca `@playwright/test`)
- `.gitignore`
- `qa-suite/` (~60 dosya: düzenek, 15 test dosyası, ölçüm araçları, belgeler, kanıt görüntüleri)

## 5. Çalıştırılan testler

Bu dalda gerçekten çalıştırılanlar. Sayılar `TEST_RESULTS.md` içinde tur tur kayıtlı.

| Grup | Kapsam | Sonuç |
|---|---|---|
| Parti / lobi (2–4 kullanıcı) | B-01, P-01…P-12 | 181/181 PASS (Tur 1–2), son regresyonda yine PASS |
| Eşleştirme | M-01…M-10 (1v1, Imposter 3 kişi, kopma, yenileme, iptal yarışları, ana sayfa) | Tur 4: M-06…M-10 için 55/55 PASS, sosyal regresyon 56/56 PASS |
| RE:VERSE | R-01…R-12 (sahte mikrofon: kayıt, ters çevirme, sessizlik, izin reddi, arka plan, gösterge, parti girişi) | 80 + 16 PASS |
| Düzen / görsel | X-01/02/03, W-01/02, T-01/02, G-01/02, F-01, PJ-01, S-01 | Hepsi PASS. Çoğu 3–5 tekrar ve iki yazı tipi modu (gerçek / yedek) |
| Mock ↔ gerçek SDK uygunluğu | 17 durum, `firebase@12.16.0` | PASS |
| Mobil denetim | 8 sayfa × 4 görünüm (taşma, dokunma alanı, küçük yazı, güvenli alan) | Yatay taşma 0 |
| Performans | Lighthouse benzeri mobil ölçüm (n=3), dosya başına CPU (açılış ve boşta), film şeridi | `PERFORMANCE_REPORT.md` |
| **Son regresyon** | `qa-suite` (15 dosya, 84 test, SDK uygunluğu dahil) | **84/84 PASS** |
| **Son regresyon** | `scripts/` 19 `test_*` + havuz doğrulayıcı (Draft motoru ve dengesi dahil) | **20/20 PASS** |

**Ayırt edicilik:** her hata düzeltmesinden önce aynı test orijinal koda karşı çalıştırıldı ve FAIL verdi. Bu FAIL'ler yukarıdaki PASS sayılarına dahil değildir.

## 6. Hâlâ başarısız olan testler ve açık sorunlar

**Başarısız test: yok.** (`test_side_game_pool_builders.py`, ortamda `duckdb` Python paketi eksik olduğu için önce çalışmadı; paket kurulunca PASS.)

**Test edilemeyenler (BLOCKED):**
- **Gerçek iPhone (iOS Safari / WebKit) ve Android Chrome:** RE:VERSE mikrofonu, izin pencereleri, yazı tipleri, dokunma. Cihaz test listesi `MOBILE_APP_READINESS.md` içinde hazır; `?micdebug=1` paneliyle sonuçlar okunabilir.
- **Gerçek Firebase:** kurallar, gerçek gecikme, gerçek bağlantı kopması süresi. Kuralların depoda olmaması da bu teste engel (S-01).
- **EN11 P2P oyun:** PeerJS bulut sunucusuna erişilemiyor. Kütüphanenin yüklenmesi testli; oyunun kendisi testsiz.
- **Gerçek Google girişi:** mock kullanıldı.

**Açık sorunlar (onay veya ayrı çalışma gerekiyor):**

| ID | Konu | Neden açık |
|---|---|---|
| PERF-05 | Boşta CPU'nun **%82'si** `prematch-mobile-v2.js` (%44) ve `online-mobile-navigation-fix-v1.js` (%39) dosyalarında: sürekli tam belge tarayan gözlemciler ve sayaçlar. Mobilde pil ve ısınmanın en büyük kalan sebebi | İki dosya da **dokunulmaz** listesinde |
| PERF-06 | 2,8 MB maç stadyumu görseli ana ekranda bekliyor | Stadyum görseli dokunulmaz |
| PERF-07 | Gizli Draft arayüzü boşta 10 sn'de ~1.500 DOM değişikliği yapıyor | Draft kapsam dışı |
| PERF-02 | 9 sn'lik "zorla göster" sayaçları | Önerildi; açılış zincirinde Draft'la ortak |
| PERF-08 | Sosyal modüller aynı yolu ayrı ayrı dinliyor (20 dinleyici / 8 yol) | Mimari adım; önerildi |
| B-03 (Draft) | Draft modunda iptal yarışı hâlâ var | Draft kapsam dışı, bilerek değiştirilmedi |
| S-01…S-04 | Kurallar depoda yok; skor istemciden yazılıyor; eşleştirme tüm kuyruğa yazma izni istiyor; App Check ve hız sınırı yok | Canlı kurallara dokunmak yasak; ayrı güvenlik çalışması |
| Erişilebilirlik | XOX, Wordle, Imposter ve Nasıl Oynanır'da yakınlaştırma kapalı. Nasıl Oynanır'da 10 px altı yazılar var. Wordle tuşları 27–43 px (telefon klavyesi standardı) | Tasarım kararı; bilgi olarak bırakıldı |
| Splash | `hide()` sonrası 320 ms içinde `show()` çağrılırsa eski zamanlayıcı katmanı yine siliyor | Önceden var olan, yalnızca Draft maç ön yükleyicisini ilgilendiriyor |

## 7. Commit'ler (23, hepsi bu dalda)

| Commit | Açıklama |
|---|---|
| `f8ea0f6` | Add Playwright Test dev dependency |
| `1e4e734` | Restore original .gitignore entries alongside node_modules |
| `a976181` | Add QA suite with mock Firebase harness and multi-user tests |
| `60741a5` | Fix last-member party leave on side-game pages (B-01) |
| `9eb3fc5` | Fix Imposter search cancel removing the wrong queue (B-02) |
| `2fced2d` | Record QA results for the B-01/B-02 round |
| `ab3a79d` | Add performance baseline and architecture audit (no source changes) |
| `6287df8` | Rebuild RE:VERSE microphone capture around platform rules (B-04) |
| `c168ec1` | Show RE:VERSE turn status and add font fallbacks |
| `9254e1d` | Show one opaque loading screen, then a finished home; serve art as WebP |
| `97b4dca` | Polish Futbol XOX board: tappable picker, readable names and win line |
| `ddce35b` | Record XOX picker and board legibility findings |
| `442959b` | Give the EN11 back link a 44 px tap target; record side-game layout findings |
| `61b8dcd` | Assess App Store / Google Play readiness and record round-3 results |
| `fb81292` | RE:VERSE: live input meter and ?micdebug=1 panel for device testing |
| `df7e5d0` | Football Wordle: fit board and keyboard on short phones, unclip title |
| `694da9d` | Career Twin: show the mode title and keep the help card off RAKİP ARA |
| `b4ff5bf` | Matchmaking: a late cancel follows the match instead of stranding the opponent (B-03) |
| `bea1370` | Splash: stop the animation loop and tip timer once the overlay is gone |
| `32400ab` | Side games: self-host their fonts instead of loading Google Fonts |
| `7d59f0e` | Serve PeerJS from the site instead of unpkg.com |
| `14d3b01` | Polish side games: XOX panel label, EN11 tap targets, font fallbacks |
| `9b08611` | Fix two stale project tests (Imposter transport tag, XOX corrections) |

Bu raporun kendisi ayrı bir belge commit'iyle eklendi.

## 8. Mobil uygulamaya geçiş (App Store / Google Play) ilerlemesi

Önerilen yol: **Capacitor.** Mevcut web kodu bir uygulama kabuğunda çalışır; gerekçe `MOBILE_APP_READINESS.md` içinde.

| Adım | Durum |
|---|---|
| Hazırlık değerlendirmesi, 8 mağaza engeli (E-1…E-8) | Yapıldı |
| Mobil düzen: kısa telefonlar, alt çubuk çakışmaları, dokunma alanları | Yan oyunlarda yapıldı ve 7 cihaz profilinde testli (XOX, Wordle, Twin, EN11) |
| Açılış performansı ve görsel boyutu | Yapıldı (WebP, tek yükleme ekranı) |
| Pil: kalktıktan sonra çalışan splash | Yapıldı. **Daha büyük kalem (PERF-05) dokunulmaz dosyalarda** |
| E-6 uzak koddan bağımsızlık | **Kısmen.** Yan oyun yazı tipleri ve PeerJS yerelde. Kalan: Firebase SDK (`gstatic`), Draft/çekirdek yazı tipleri, bayraklar, EN11'in PeerJS sinyal sunucusu |
| RE:VERSE mikrofonu (uygulama içinde en riskli donanım özelliği) | Kodda hazır; **gerçek cihaz testi BLOCKED** |
| E-1 yerel Google girişi, E-2 Sign in with Apple, E-3 hesap silme, E-4 engelle/şikâyet, E-5 gizlilik politikası ve veri beyanı, E-7 kurallar ve App Check, E-8 çevrim dışı ekran | **Yapılmadı.** Ürün kararı, Apple/Google geliştirici hesabı, Firebase Console erişimi ve hukuki metin gerektiriyor |
| Capacitor iskeleti (`npx cap init`, iOS/Android projeleri) | **Başlanmadı.** Xcode/Android SDK ve imzalama hesabı bu ortamda yok |

**Önerilen sıradaki adımlar:**
1. RE:VERSE'i bir iPhone ve bir Android'de `?micdebug=1` ile test etmek.
2. PERF-05 için iki Draft-bitişik dosyaya dokunma onayı (en büyük pil kazancı).
3. Firebase kurallarını depoya almak ve kural testleri yazmak (S-01…S-04).
4. Capacitor iskeleti ile yerel Google ve Apple girişi.
5. Hesap silme ile engelle/şikâyet özellikleri.
