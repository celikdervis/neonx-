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
