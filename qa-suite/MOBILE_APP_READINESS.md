# App Store / Google Play Hazırlık Değerlendirmesi

Tarih: 2026-11-19 · Kapsam: NEON XI web uygulamasının (Draft XI dahil, değiştirilmeden) yerel uygulama kabuğuna
paketlenmesi. **Bu belge bir değerlendirmedir; hiçbir kod değişikliği yapılmadı.**
Mağaza kurallarına yapılan atıflar bilgi amaçlıdır; başvurudan önce Apple App Review Guidelines ve Google Play Developer
Policy'nin güncel metinleriyle doğrulanmalıdır.

## Kısa sonuç

NEON XI, statik HTML/CSS/JS yapısı sayesinde **Capacitor ile teknik olarak paketlenebilir**. Ancak bugünkü haliyle mağazaya
gönderilirse büyük olasılıkla reddedilir veya bazı akışlar uygulama içinde çalışmaz. Gönderimden önce kapatılması gereken
**8 engel** var (aşağıda E-1…E-8). Bunların çoğu kod değil, ürün ve altyapı işi.

## Neden Capacitor?

| Seçenek | Uygunluk | Not |
|---|---|---|
| **Capacitor** (önerilen) | Yüksek | Mevcut web kodunu olduğu gibi WebView'da çalıştırır; yerel eklentiler (Google/Apple girişi, push, mikrofon izni, uygulama yaşam döngüsü, geri tuşu) web koduna köprülenir. Statik site yapısıyla uyumlu |
| TWA (Android) / PWA | Kısmi | Yalnızca Android için; iOS'ta PWA mağazaya giremez. Google girişi tarayıcıda çalıştığı için hızlı bir Android başlangıcı olabilir |
| React Native / Flutter | Düşük | Arayüzün yeniden yazılması gerekir; mevcut oyunlar ve Draft motoru yeniden yazılmadan taşınamaz |

## Engeller (mağaza gönderiminden önce)

| ID | Konu | Bugünkü durum (kanıt) | Uygulama içinde ne olur | Gereken iş |
|---|---|---|---|---|
| E-1 | **Google ile giriş** | `social/neon-social.js`: `signInWithPopup` / `linkWithPopup` | Google, gömülü WebView'larda OAuth'u engeller ("disallowed_useragent"); açılır pencere WKWebView/Android WebView'da çalışmaz | Yerel Google Sign-In eklentisi → kimlik jetonu → JS SDK'da `signInWithCredential`. Misafirden Google'a bağlama (`linkWithCredential`) korunmalı |
| E-2 | **Sign in with Apple** | Yok | Apple, üçüncü taraf girişi (Google) sunan uygulamalarda eşdeğer bir gizlilik dostu giriş seçeneği bekliyor (Kılavuz 4.8) | Apple girişi (yerel eklenti + Firebase Apple sağlayıcısı) |
| E-3 | **Uygulama içinden hesap silme** | Kodda hesap/veri silme yok (`deleteUser` 0 eşleşme) | Hesap oluşturulabilen uygulamalarda Apple (5.1.1(v)) ve Google Play hesap silme yolu ister | Profil, kullanıcı adı, arkadaşlık, parti, istatistik ve skor kayıtlarını temizleyen akış. Güvenilir olması için sunucu tarafında (Cloud Functions) yapılmalı |
| E-4 | **Kullanıcı içeriği denetimi** | Kullanıcı adları ve arkadaşlık sistemi var; engelleme veya şikâyet yok | Sosyal özellikli uygulamalarda içerik filtreleme, kullanıcı engelleme ve şikâyet mekanizması beklenir (Kılavuz 1.2) | Kullanıcı adı filtresi, "engelle", "şikâyet et" ve bunların veritabanı kuralları |
| E-5 | **Gizlilik politikası ve veri beyanları** | Uygulamada gizlilik politikası bağlantısı yok; Google Tag Manager (`G-GC90PB01KV`) yükleniyor | Her iki mağaza gizlilik politikası URL'si ve uygulama içi erişim ister; App Privacy etiketleri ve Play Data Safety formu doldurulmalı | Politika metni ve bağlantısı; analitik kapsamının beyanı; iOS Privacy Manifest |
| E-6 | **Uzak koddan bağımsızlık** | Firebase SDK `www.gstatic.com`'dan (53 referans), PeerJS `unpkg.com`'dan, yazı tipleri Google Fonts'tan, bayraklar `flagcdn.com`'dan çalışma anında yükleniyor | Çalıştırılabilir kodun uzaktan yüklenmesi Apple kurallarıyla (2.5.2) çatışabilir; çevrim dışı veya kısıtlı ağda uygulama açılmaz ya da yazı tipleri bozulur (XOX/Imposter başlık çakışması, RE:VERSE serif görünümü yazı tipi gelmeyince görülüyor) | SDK, PeerJS, yazı tipleri ve bayrakları uygulama paketine almak; içe aktarmaları yerel yollara çevirmek |
| E-7 | **Veritabanı güvenliği** | Kurallar depoda yok (S-01); istemci kendi skorunu yazıyor (S-02); eşleştirme tüm kuyruğa yazma izni gerektiriyor (S-03); App Check yok (S-04) | Mağazada görünürlük arttıkça kötüye kullanım riski artar | Kuralların gözden geçirilmesi; yerel uygulamada App Check (iOS App Attest / Android Play Integrity) |
| E-8 | **Çevrim dışı durum** | Ağ yoksa `index.html` "NEON XI yüklenemedi" gösteriyor (çekirdek `fetch` edilemezse) | Apple, ağ yokken boş veya bozuk ekran gösteren uygulamaları reddedebilir | Yerel paketle çekirdek her zaman yerelden gelir; Firebase bağlantısı yokken anlamlı "çevrim dışı" ekranı |

## Uygulama içinde çalışmayacak veya değişmesi gereken diğer noktalar

| Konu | Bugün | Uygulamada | Öneri |
|---|---|---|---|
| Firebase Auth başlatma | 16 ayrı `getAuth`/`getDatabase` çağrısı, 11 yapılandırma kopyası | WKWebView'da `getAuth()`'un varsayılan açılır pencere çözümleyicisi takılabiliyor; `initializeAuth(..., {persistence: indexedDBLocalPersistence})` ile tek noktadan başlatmak gerekir | Tek Firebase servisi (ARCHITECTURE_AUDIT §6.4) |
| Sayfalar arası geçiş | 10 adet `location.href = …`; her geçişte tam sayfa yükleme. Ana sayfaya dönüş 1,7 MB'lık çekirdeği yeniden ayrıştırıyor (önbellekli açılış: orta seviye cihazda 10,5 sn) | Yerelde indirme yok ama CPU maliyeti aynı | Kısa vadede hub/Draft ayrımı (PERF-10); uzun vadede tek sayfa yönlendirme |
| Android geri tuşu | Sayfalar tarayıcı geçmişine dayanıyor | Geri tuşu uygulamadan çıkabilir | Capacitor `App.addListener('backButton')` ile oyun içi geri davranışı |
| Uygulama yaşam döngüsü | Parti, eşleştirme ve presence `visibilitychange` ve `onDisconnect` ile çalışıyor (QA'da doğrulandı); RE:VERSE arka planda kaydı iptal ediyor (B-04) | Arka plana alınınca WebView duraklar, Firebase bağlantısı kopar | `appStateChange` ile dönüşte yeniden bağlanma ve ekranı tazeleme; uzun arka plan sonrası parti/kuyruk durumunun doğrulanması |
| Bildirimler | Push yok; davet ve istekler yalnızca uygulama açıkken rozet olarak görünüyor | Kapalı uygulamaya davet ulaşmaz | FCM + APNs (`@capacitor/push-notifications`) ve bildirimi gönderecek bir sunucu tarafı (Cloud Functions). Bugün sunucu tarafı yok |
| Davet bağlantıları | `?room=`, `nxCode=` parametreleri | Bağlantı uygulamayı açmaz | Universal Links (iOS) / App Links (Android) |
| Mikrofon (RE:VERSE) | `getUserMedia` + AudioContext (B-04 sonrası tek hat); masaüstünde `SpeechRecognition` | iOS: Info.plist'te `NSMicrophoneUsageDescription`; WKWebView iOS 14.3+ `getUserMedia` destekler. Android: `RECORD_AUDIO` izni ve WebView izin köprüsü. `SpeechRecognition` WebView'larda yok; B-04 sonrası mobilde zaten kullanılmıyor | Eklenti tarafında izin metinleri ve izin akışının cihazda testi (aşağıdaki liste) |
| EN11 (PeerJS / WebRTC) | PeerJS bulut sunucusuna bağımlı | WKWebView iOS 14.3+ WebRTC destekler; ama `0.peerjs.com` erişimi ve NAT arkası bağlantı güvencesiz | Kendi PeerServer'ı veya Firebase üzerinden sinyalleşme (XOX/Imposter'da kullanılan yöntem) |
| Güvenli alanlar | `viewport-fit=cover` ve `env(safe-area-inset-*)` tüm sayfalarda var (mobil denetim) | Uyumlu | Durum çubuğu ayarı (Capacitor StatusBar) |
| Yakınlaştırma | XOX, Wordle, Imposter ve Nasıl Oynanır'da `user-scalable=no` | Uygulamada beklenen davranış | — |
| Performans / pil | Ana ekran boştayken 4× yavaş CPU'da ana iş parçacığı %100 meşgul (PERF-05/07) | Uygulamada pil tüketimi ve ısınma daha görünür olur | PERF-05/06/07 (Draft alanı, onay bekliyor) |
| Görseller | Ana ekran ve giriş WebP (FIX-04); Draft/maç stadyumu 2,8 MB PNG | Paket boyutunu da etkiler | Draft varlıklarının WebP'ye çevrilmesi (onay ile) |

## Yeniden yazılması gerekecek bölümler

1. **Kimlik doğrulama:** Google açılır penceresi → yerel Google + Apple girişi; misafir → hesap bağlama; tek noktadan Firebase başlatma.
2. **Hesap yaşam döngüsü (yeni):** hesap silme, veri dışa aktarma isteği, engelleme ve şikâyet. Sunucu tarafı (Cloud Functions) gerektirir.
3. **Açılış ve yükleme:** `document.write` ile çekirdek yükleme ve metin yamaları → yerel paket. En azından hub (ana ekran + sosyal) ile Draft çekirdeğinin ayrılması.
4. **Sosyal servis:** 6 parti ayrılma ve 3'er kurma/davet uygulaması → tek servis (ARCHITECTURE_AUDIT §6.4).
5. **Gezinme:** çoklu HTML sayfası ve tam yeniden yükleme → uygulama içi yönlendirme ve Android geri tuşu.
6. **Bildirimler (yeni):** davet, arkadaşlık isteği ve maç başlangıcı için push.
7. **Uzak bağımlılıklar:** Firebase SDK, PeerJS, yazı tipleri ve bayrak SVG'leri pakete.

## Önerilen aşamalar

| Aşama | İçerik | Ön koşul |
|---|---|---|
| A | Yazı tiplerini ve Firebase SDK'yı yerelleştirmek; tek Firebase servisi | — |
| B | Capacitor iskeleti (iOS + Android), yerel Google + Apple girişi, mikrofon izinleri, geri tuşu, yaşam döngüsü | A |
| C | Hesap silme, engelleme, şikâyet, gizlilik politikası (sunucu tarafı dahil) | Ürün kararı |
| D | Push bildirimleri, Universal/App Links | B, C |
| E | Güvenlik kuralları ve App Check incelemesi; kapalı test (TestFlight / Play iç test) | Güvenlik aşaması |

## RE:VERSE — gerçek cihazda yapılması gereken testler

Chromium'da otomatik testlerle doğrulananlar: B-04 düzeltmesi, 16 test × 5 tekrar. Aşağıdakiler ise yalnızca gerçek
cihazda doğrulanabilir; **hiçbiri test edilmedi**.

| # | Cihaz / tarayıcı | Adım | Beklenen |
|---|---|---|---|
| 1 | iPhone (Safari) | İlk kayıt: izin penceresinde "İzin Ver" | Kayıt başlar, buton "DURDUR · n sn" sayar; durdurunca "Ses kaydedildi" |
| 2 | iPhone | İzin penceresinde "İzin Verme" | Türkçe yönlendirme ("aA › Web Sitesi Ayarları › Mikrofon"); buton takılı kalmaz |
| 3 | iPhone | Kayıt sırasında uygulamadan çık, geri dön | Kayıt iptal mesajı; turuncu mikrofon göstergesi kapanmış; yeni kayıt çalışır |
| 4 | iPhone | Kayıt sırasında arama gelsin veya Siri açılsın | Kayıt iptal edilir veya sessizlik uyarısı çıkar; sessiz ses gönderilmez |
| 5 | iPhone | 3 tur arka arkaya (iki cihazla) | Her turda karşı taraf sesi duyar (1 Kasım'daki "tekrarlanan turda bozulma" şikâyeti) |
| 6 | Android (Chrome) | İsim kaydı | Konuşma tanıma başlamaz; kayıt sesli gider; isim elle yazılır |
| 7 | Android | Bluetooth kulaklık bağlıyken kayıt | Ses gider (mikrofon kulaklıktan) |
| 8 | Instagram/WhatsApp uygulama içi tarayıcı | Davet bağlantısını aç, kayıt dene | "Safari veya Chrome'da aç" mesajı (mikrofon API'si yoksa) |
| 9 | Her iki platform | Zayıf ağda (3G) kayıt gönder | "Ses gönderiliyor…" sonrası karşı tarafta oynatılır; 15 sn'lik kayıt ~880 KB base64 |
