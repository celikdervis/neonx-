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
