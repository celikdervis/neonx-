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
