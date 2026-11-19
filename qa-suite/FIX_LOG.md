# Fix Log

Tek kaynak dosya değişti: `social/neon-social.js` (+5 / −4 satır). Draft XI, kimya, taktik, oyun motoru, HTML dosyaları
ve diğer sosyal modüller değiştirilmedi. Yeni modül veya yeni `<script>` eklenmedi.

## FIX-01 → B-01 (parti ayrılma)

| | |
|---|---|
| Fonksiyon | `leaveParty()` ve `[data-act="leave-party"]` buton bağlaması |
| Önce | Yerel `state.party` verisine göre çok yollu `update()`. Son üye için ata ve alt yol aynı istekte olduğu için SDK reddediyor. `onclick` hatayı yakalamıyor |
| Sonra | Parti düğümünde tek bir `runTransaction`: kullanıcıyı `members`'tan çıkar; kimse kalmazsa düğümü sil (`null`); lider ayrıldıysa ya da lider artık üye değilse liderliği kalan ilk üyeye ver. Ardından kullanıcının `social/userParty/{uid}` işaretçisini, hâlâ bu partiyi gösteriyorsa transaction ile temizle. Buton hata olursa `message(..., true)` ile kullanıcıya gösteriyor |
| Neden bu yol | Bu, ana sayfada zaten çalışan ve testten geçen `neon-party-membership-integrity-v2.js` algoritmasının aynısı. Transaction sunucudaki güncel üye listesini kullanıyor; yerel bayat veriyle bütün partiyi silip aynı anda katılan bir üyenin kaydını bozmuyor (eski atomik `update()` bu riski taşıyordu) |
| Neden yakalama modülünü yan sayfalara yüklemedik | 5 HTML dosyasına (Imposter yükleyicisi dahil) yeni bir capture-phase yama eklemek mevcut yama katmanlarını artırırdı. Hata `neon-social.js`'in kendi fonksiyonundaydı ve orada düzeltildi |
| Davranış farkı | Ayrılma artık iki ardışık transaction (önce parti, sonra işaretçi). Bkz. OBS-01 |
| Etkilenen diğer modüller | Yok. Ana sayfada bu fonksiyon çağrılmıyor (yakalama modülü öncelikli) |

## FIX-02 → B-02 (Imposter iptali)

| | |
|---|---|
| Değişiklik | Yeni yardımcı `queuePath(mode)`. `startMatch()` ve iptal işleyicisi aynı yolu kullanıyor. İptal başarısız olursa kullanıcı hata mesajı görüyor |
| Önce | İptal her zaman `social/matchQueues/${mode}/{uid}` yolunu siliyordu; Imposter kaydı ise `social/universalQueuesV2/imposter/{uid}` altındaydı |
| Etkilenen diğer modüller | Yok. 1v1 modların yolu değişmedi (M-01, M-02 ile doğrulandı) |

## Yayın notu

Yan sayfalar `neon-social.js`'i sabit `?v=` sorgu dizesiyle yüklüyor (ör. `?v=20260928-home-identical-nav-v6`).
GitHub Pages'in önbellek süresi kısa (yaklaşık 10 dk), ama düzeltmenin hemen yayılması isteniyorsa yayın sırasında
bu sürüm dizelerinin güncellenmesi önerilir. Bu çalışmada HTML dosyalarına dokunulmadı.

## FIX-03 → B-04 (RE:VERSE mikrofon)

| | |
|---|---|
| Dosyalar | `side-games/reverse-xi/reverse-xi.js` (yalnızca mikrofon bölümü), `side-games/reverse-xi/index.html` (`?v=7` → `?v=8`) |
| Oyun akışı | Değişmedi: oda, tur sırası, fazlar, tahmin doğrulama ve Firebase yolları aynı |
| Yakalama | Tüm platformlarda tek hat: AudioContext + ScriptProcessor ile ham ses, 22.050 Hz'e yeniden örnekleme, ters çevirip WAV olarak gönderme. MediaRecorder, `decodeAudioData` ve `<audio>` ile çözme yedeği kaldırıldı (platforma göre değişen biçim ve çözme hatalarının kaynağı) |
| iOS dokunuş kuralı | AudioContext oluşturma ve `resume()`, dokunuşun içinde ve izin isteğinden önce; 4 sn içinde başlamazsa anlaşılır hata |
| Mobil konuşma tanıma | Telefonlarda kayıtla eşzamanlı çalıştırılmıyor; isim alanı gösteriliyor ("Futbolcunun adını aşağıya yazıp onayla"). Masaüstünde değişmedi |
| Akış sağlığı | `ended` / `muted` izler yeniden kullanılmıyor; iz kayıt sırasında biterse kayıt iptal ediliyor |
| Arka plan | `visibilitychange: hidden`: kayıt iptal, mikrofon serbest (sistem göstergesi kapanır); dönüşte bilgi mesajı. `beforeunload` yerine `pagehide` (iOS'ta güvenilir olan) |
| Kalite kontrolleri | 0,3 sn'den kısa veya tepe seviyesi < 0,01 olan kayıt gönderilmiyor. 15 sn'de otomatik durma. Butonda geçen süre. Çift dokunma koruması. Gönderim sırasında onay butonu kilitli |
| Hata mesajları | NotAllowed/Security → platforma özel izin yolu; NotFound → mikrofon yok; NotReadable/Abort → başka uygulama kullanıyor; mediaDevices yok veya NotSupported → "Safari veya Chrome'da aç" |
| Kaldırılan ölü kod | `recognize()`, `captureName()` (hiçbir yerden çağrılmıyordu) |
| Yükleme boyutu | iPhone'da 48 kHz → 22.050 Hz (aynı süre için ~2,2 kat küçük) |

## FIX-04 → PERF-01, PERF-03, PERF-04 (yükleme ekranı ve görseller)

| | |
|---|---|
| `index.html` | Boot yazısı ortada ve guard ile aynı stilde (sıçrama yok). Guard kuralı `html body::before` + `!important`, maske ve filtre sıfır; Draft'ın `body.nx-draft-active::before` kuralı ve çekirdeğin `mask-image`'ı artık örtüyü delemiyor. Nabız animasyonu yalnızca yazı renginde (örtü her an opak). REVEAL, ana ekran görsellerinin `decode()`'unu en fazla 4 sn bekliyor; 9 sn'lik güvenlik ağı ve test sözleşmeleri aynı. `VERSION` → `20261119-qa-mobile-perf-v1` (enjekte edilen dosyalar için önbellek yenileme) |
| `side-games/home-approved-v1.js` | Arka plan ve ön plan `<picture><source type="image/webp">` + PNG yedek; `picture{display:contents}` |
| `side-games/neon-entry-v1.js/.css` | Giriş görseli aynı yöntemle WebP; PNG yolu ve sözleşme testi korunuyor |
| Yeni dosyalar | `neon-xi-background-v4.webp` (q82, 146 KB), `neon-xi-foreground-ice-v5.webp` (q90, alfa 100, 282 KB), `assets/entry/first-login-v1.webp` (q90, 287 KB) — aynı çözünürlük |
| Draft dosyaları | Dokunulmadı |

## FIX-05 → B-06, UX-03..05 (Futbol XOX sunumu)

| Dosya | Değişiklik |
|---|---|
| `side-games/football-xox/xox-dark-arena.css` | Oyuncu seçme penceresi alt çubuğun üstünde (`z-index:9600`) + alt güvenli alan |
| `side-games/football-xox/xox-board-motion.css` | Tahta `isolation:isolate`; ad/başlıkta kelime bölme kapalı; kazanan karede çizgi isimlerin altında, isim hâlesi, tek seferlik parlama; dar ekranda başlık iç boşluğu |
| `side-games/football-xox/xox-board-motion.js` | Sığdırma: metnin gerçek genişliği (Range) sabit kutuya (`.head`/`.cell`) göre, dönüşümden bağımsız; diğer katmanlar boyutu `!important` ile sabitlediği için `setProperty(...,'important')`; tahta değişince (MutationObserver, yalnızca tahta), boyut değişince (ResizeObserver) ve web yazı tipi yüklenince yeniden. Oyun bitince sonuç kartını görünür alana kaydırma |
| `side-games/football-xox/index.html` | Değişen üç dosyanın `?v=` önbellek etiketleri |
| Oyun mantığı (`game-v2.js`) | **Değişmedi** |

## FIX-06 → RE:VERSE gerçek cihaz testine hazırlık

| | |
|---|---|
| Seviye göstergesi | Kayıt sırasında butonun altında sesle dolan neon çizgi (`--nx-level`, yakalama döngüsünden). Hareket azaltma tercihine uyar |
| Tanı paneli | `?micdebug=1`: izin, AudioContext, iz (MUTED dahil), son kayıt, son yükleme, son hata, görünürlük, platform, API'ler, UA. Üstte, `pointer-events:none` (ilk sürüm alttaydı ve oyunun butonlarını kapatıyordu; R-11 bunu yakaladı) |
| Bildirim mesajı | Alttan üste taşındı; "Kayıt başladı" mesajı kayıt/durdur butonunu örtüyordu |
| Testler | R-11 (gösterge + panel), R-12 (partiden `nxAuto` ile lider/üye aynı odaya otomatik giriş) |
| Dosyalar | `side-games/reverse-xi/reverse-xi.js`, `reverse-xi.css`, `index.html` (`?v=` etiketleri) |

## FIX-07 → UX-07 (Football Wordle, kısa ekranlar)

| | |
|---|---|
| Dosya | `side-games/football-wordle/index.html` (yalnızca CSS ve sayfa sonuna küçük bir sığdırma betiği) |
| Başlık | `h1` boyutu iki başlık butonu arasındaki alana göre sınırlandı (`min(clamp(...), calc((100vw - 184px) / 12.6))`, ≤370 px'te `160px`) |
| Kısa dikey ekran (`max-height:700px`) | Üst bilgi, tahta ve klavye boşlukları sıkılaştı; tuş yüksekliği 40 px |
| Sığdırma betiği | Alt çubuk varsa `body` alt boşluğunu ayrılmış alan kabul eder; klavye bu alanın üstüne gelene kadar tahtanın `width` değerini orantılı küçültür (en fazla 5 adım, kare en az 28 px). Boyut, yön, yazı tipi yüklenmesi ve tahta değişince yeniden çalışır. `width` ayarladığı için oyunun kısa kelimeler için koyduğu `max-width` geçerli kalır |
| İlk deneme | Alt çubuğun kutusu üstte saydam olduğu için Galaxy S8'de gereksiz küçültme yaptı; geri alındı. İkinci sürüm 200 px alt sınıra dayanıyordu ve 14 Pro Max'te 3 harfli kelimede bozuldu; alt sınır kare boyutuna çevrildi |
| Oyun mantığı | **Değişmedi** |

## FIX-08 → UX-08 (Career Twin menüsü)

| | |
|---|---|
| Dosya | `side-games/career-twin/xox-family-ui-v1.css` (dosya sonuna 2 kural), `side-games/career-twin/index.html` (`?v=` etiketi) |
| Kök neden | `aeabe15` "Nasıl oynanır" kartını geri ekledi (`top:69.55%`), ama ≤700 px kuralı mod panelini %40 yüksekliğe büyütüyor (alt kenar %76,5): kart RAKİP ARA'nın üstüne biniyordu. Ayrıca mod listesi panelin %8'inden başlıyor, başlık ise %6,5'te: başlık ilk butonun arkasında kalıyordu |
| Sonra | Mod listesi `top: calc(6.5% + 3.9cqw + 9px)` (başlığın yazı boyutu `3.9cqw`), altta %3 pay (panelin köşe kesiği son butonun çerçevesini kesmesin). ≤700 px'te kart `top:78%` (640 px'lik alanın içinde, 499–607 px) |
| Değişmeyen | Tasarım, renkler, buton içerikleri, menü eylemleri, "Nasıl oynanır" metni. Butonlar en az 50 px yüksek |

## FIX-09 → B-03 (iptal ile eşleşme yarışı)

| | |
|---|---|
| Dosyalar | `social/neon-social.js` (yan sayfalar), `social/neon-social-safe-v4.js` (ana sayfa), 5 yan sayfada `neon-social.js?v=` etiketi (`20261119-qa-b03`; her sayfa modülü tek bir etiketle yüklüyor, modül iki kez yüklenmiyor) |
| Önce | İptal önce eşleşme dinleyicisini kapatıyor, sonra kaydı durumuna bakmadan siliyordu. Rakibin eşleştirme transaction'ı silmeden önce sunucuya ulaşırsa rakip yönlendiriliyor, iptal eden hiçbir şey görmüyordu |
| Sonra | `runTransaction(kuyruk/{uid}, x => x?.status==='matched' ? undefined : null)`. `waiting` ise silinir. `matched` ise transaction iptal edilir ve oyuncu, sunucudaki eşleşme kaydıyla odaya yönlendirilir. Dinleyici bu sırada açık kalıyor; çift yönlendirmeye karşı eşleşme kimliğiyle tek seferlik koruma (`followMatch`). İptal butonu işlem sürerken kilitli; hata olursa açılıyor ve oyuncu aramada kalıyor |
| Neden bu yol | Eşleştirme transaction'ı kuyruk düğümünün tamamında, iptal ise oyuncunun alt düğümünde karşılaştır-yaz yapıyor. Hangisi sunucuya önce ulaşırsa diğeri çakışma alıp güncel veriyle yeniden çalışıyor; iki taraf aynı sonucu görüyor. Eşleşmeyi bozup rakibi kuyruğa geri almak daha karmaşık ve rakip zaten yönlendirilmiş olabiliyor |
| Draft | `mode==='draft'` için iki dosyada da orijinal iptal yolu aynen korundu (Draft kapsam dışı). Draft'ta B-03 açık kalıyor |
| Etkilenen diğer akışlar | M-01…M-05, B-02, P-01…P-12 yeniden çalıştırıldı: PASS. Eşleşme dinleyicisi yan sayfada `followMatch` fonksiyonuna taşındı; URL parametreleri aynı |

## FIX-10 → PERF-09 (splash döngüsü)

| | |
|---|---|
| Dosya | `side-games/neon-splash-safe-v1.js` |
| Önce | Splash kalktıktan sonra harf animasyonu (rAF, `getPointAtLength`, kıvılcım DOM düğümleri) ~9 sn'de bir kendini yeniden başlatıyor, 3,2 sn'lik ipucu sayacı çalışmaya devam ediyordu. `show()` yeniden çağrılınca (maç ön yükleyicisi) döngüler üst üste biniyordu |
| Sonra | Her adım, kendi katmanının hâlâ `NX_SPLASH.root` olup olmadığına bakıyor; değilse duruyor. Sayaç kendini temizliyor. `show()/hide()` sözleşmesi aynı |
| Ölçüm | Kaldırılmış katmanda 12 sn'de çizim çağrısı: 287 → 0 (tekrar gösterimden sonra 500 → 0). Boşta CPU payı 28 ms → 0 ms (3 × 20 sn); küçük |
| Bilerek dokunulmayan | `hide()` sonrası 320 ms içinde `show()` çağrılırsa eski kaldırma zamanlayıcısının katmanı yine silmesi (önceden var olan, yalnızca Draft maç ön yükleyicisini ilgilendiren durum) |

## FIX-11 → Yazı tiplerini yerelleştirme (E-6, kısmen)

| | |
|---|---|
| Yeni | `assets/fonts/neon-fonts.css` + 34 woff2 (Orbitron 600–900, Rajdhani 500–700, Barlow 400–700, Barlow Condensed 500–900 ve italik 700–900; latin + latin-ext, `unicode-range` ile yalnızca kullanılan dosya iner), OFL lisans dosyaları, üretici `scripts/build_self_hosted_fonts.mjs` (@fontsource 5.3.0) |
| Değişen | 11 dosyadaki Google Fonts `@import` satırı yerel sayfaya çevrildi: career-twin `premium-mobile.css`, `xox-family-ui-v1.css`; `en11/index.html`; `football-wordle/index.html`; `football-xox/index.html`, `unified-menu.css`, `xox-premium-game-v2.css`; `how-to-play.html`; `imposter-xox-family-v1.css`; `side-games/index.html`; `reverse-xi.css`; ayrıca Imposter'ın parça dosyası `parts/part01.txt`. Değişen stil dosyalarının `?v=` etiketleri |
| Kazanç | Yan sayfalarda üçüncü taraf yazı tipi isteği yok (iki köken: fonts.googleapis.com, fonts.gstatic.com). Ağ kısıtlıyken veya uygulama paketinde yazı tipleri bozulmuyor (daha önce XOX/Imposter başlık çakışmasının ve RE:VERSE serif görünümünün sebebi yazı tipinin gelmemesiydi). Kullanıcı IP'si Google'a gitmiyor (gizlilik beyanı) |
| Ölçülmeyen | Sayfa açılış süresine etkisi ölçülmedi: önceki ölçümlerde Google Fonts istekleri test düzeneğinde engelleniyordu, karşılaştırma adil olmazdı |
| Dokunulmayan | `draft-mobile.css` ve çekirdekteki (Draft) yazı tipi içe aktarmaları |

## FIX-12 → PeerJS'i yerelden yükleme (E-6, kısmen)

| | |
|---|---|
| Yeni | `vendor/peerjs/peerjs-1.5.5.min.js` (npm `peerjs@1.5.5` paketindeki dosyanın aynısı; paket shasum kayıt defteriyle eşleşti), MIT lisansı, kaynak notu |
| Değişen | `side-games/en11/index.html`, `side-games/career-twin/game.js`, `side-games/parts/part05.txt`: `https://unpkg.com/peerjs@1.5.5/...` → yerel yol |
| Bulgu | PeerJS'i gerçekten yükleyen tek sayfa EN11. Career Twin `firebase-peer-shim-v1.js` ile `window.Peer`'i Firebase üzerinden sağlıyor; Imposter'da `online-base44-imposter.js`, `ensurePeerJS`'i boş fonksiyonla değiştiriyor. Bu iki sayfadaki satırlar yedek yol |
| Test | `peerjs-local.spec.mjs` 9/9: unpkg isteği yok; EN11'de yerel dosya 200 ve `window.Peer` tanımlı. EN11'in P2P oyunu (PeerJS bulut sinyal sunucusu gerekli) **BLOCKED** |
