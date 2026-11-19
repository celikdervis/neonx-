# Bug Tracker

Durumlar: PASS · FAIL · BLOCKED · NOT TESTED · FIXED, UNVERIFIED. Hata durumu: OPEN / FIXED (mock'ta doğrulandı).
"Mock'ta doğrulandı" ifadesi, gerçek Firebase'de değil, `qa-suite` mock RTDB'sinde doğrulandığı anlamına gelir.

---

## B-01 — Yan oyun sayfalarında partideki son üye partiden ayrılamıyor

| Alan | Değer |
|---|---|
| Modül | Parti/lobi, yan sayfaların eski paneli |
| Öncelik | P2 (kullanıcı partide kilitli kalıyor, hiçbir geri bildirim yok) |
| Sayfalar | XOX, Career Twin, Football Wordle, Arcade (`side-games/index.html`), Futbol Imposter. Ana sayfada oluşmuyor |
| Durum | **FIXED (mock'ta doğrulandı)** |

**Tekrar üretme adımları:** A ve B arkadaş olsun, ikisi de XOX sayfasında. A → Sosyal → Parti → YENİ PARTİ KUR.
A, B'yi davet eder; B kabul eder. B → PARTİDEN AYRIL. Ardından A → PARTİDEN AYRIL.

**Beklenen:** Parti kaydı silinir, A'nın parti işaretçisi temizlenir ve A "YENİ PARTİ KUR" ekranını görür.

**Gerçekleşen:** A "KALICI PARTİ · LİDER" ekranında kalıyor; durum satırında eski bir mesaj duruyor.
Konsolda yakalanmamış hata:
`update failed: values argument contains a path /social/parties/<id> that is ancestor of another path /social/parties/<id>/members/<uid>`.
Veritabanında `social/parties/<id>` ve `social/userParty/<uid>` olduğu gibi kalıyor.

**Kök neden:** `social/neon-social.js` içindeki `leaveParty()`, son üye için aynı çok yollu `update()` içine hem
`social/parties/{id}` hem de onun alt yolu `.../members/{uid}` yazıyor. Firebase SDK bu isteği **senkron olarak** reddediyor.
Bu, gerçek `firebase@12.16.0` ile doğrulandı. Buton `onclick=leaveParty` ile bağlı ve `.catch` yok, bu yüzden hata sessizce kayboluyor.
Ana sayfada sorun çıkmamasının sebebi `neon-party-membership-integrity-v2.js`'in tıklamayı capture aşamasında yakalayıp
transaction tabanlı ayrılmayı kullanması. Bu modül yan sayfalara yüklenmiyor.
Aynı bozuk desen `neon-social-drawer-v1.js` içinde de var, ancak orada çalışmıyor (ölü kod; ana sayfada yakalama modülü her zaman önce devreye giriyor).

**Değişen dosya:** `social/neon-social.js` (`leaveParty` ve buton bağlaması). Ayrıntılar `FIX_LOG.md` içinde.

**Testler:** `tests/b01-party-leave.spec.mjs`

| Aşama | Sonuç |
|---|---|
| Düzeltme öncesi (5 yan sayfa × 5 tekrar) | 25/25 FAIL (yeniden üretildi) |
| Ana sayfa kontrolü, düzeltme öncesi (×5) | 5/5 PASS |
| Düzeltme sonrası (6 test × 5) | 30/30 PASS |
| Ayırt edicilik (orijinal koda karşı) | 5/5 yan sayfa FAIL, kontrol PASS |
| Regresyon | Bkz. `REGRESSION_LOG.md` (parti 110/110) |

---

## B-02 — Yan sayfalarda Imposter araması iptal edilince oyuncu kuyrukta kalıyor ve başkalarıyla eşleşiyor

| Alan | Değer |
|---|---|
| Modül | Eşleştirme, eski panel |
| Öncelik | P1 (iptal eden oyuncu en eski kayıt olduğu için **host** seçiliyor; diğer iki oyuncu host'u hiç gelmeyecek bir odaya gönderiliyor) |
| Sayfalar | Eski paneli kullanan tüm yan sayfalar (Imposter modu). Ana sayfa `safe-v4` kullanıyor, orası ayrıca test edilmedi |
| Durum | **FIXED (mock'ta doğrulandı)** |

**Tekrar üretme adımları (3 kullanıcı):** A, B, C Imposter sayfasında. A → RAKİP ARA → ARAMAYI İPTAL ET.
Ardından 60 sn içinde B → RAKİP ARA, C → RAKİP ARA.

**Beklenen:** A'nın kuyruk kaydı silinir; B ve C yalnızca iki kişi oldukları için beklemeye devam eder.

**Gerçekleşen:** A'nın kaydı `social/universalQueuesV2/imposter/uid_A` altında `waiting` olarak kalıyor. C aramaya
başlayınca grup A+B+C olarak kuruluyor: A `role:"host"`, B ve C `nxRole=guest&nxCode=8BXPR` ile odaya yönlendiriliyor.
A'nın aboneliği iptal sırasında kapatıldığı için A hiçbir yere gitmiyor.

**Kök neden:** `startMatch()` Imposter için `social/universalQueuesV2/imposter` yolunu kullanıyor, ama `renderSearching()`
içindeki iptal her mod için sabit kodlanmış `social/matchQueues/${mode}` yolunu siliyor. Kuyruk yolu iki ayrı yerde,
birbirinden farklı biçimde hesaplanıyor.

**Değişen dosya:** `social/neon-social.js` (`queuePath` yardımcı fonksiyonu, `startMatch`, iptal işleyicisi).

**Testler:** `tests/b02-imposter-cancel.spec.mjs`

| Aşama | Sonuç |
|---|---|
| Düzeltme öncesi | 11/11 FAIL (1 + 5 + 5); A her seferinde host olarak gruba dahil edildi |
| Düzeltme sonrası | 5/5 PASS (+5/5 tam regresyon turunda) |
| Ayırt edicilik (orijinal koda karşı) | FAIL |
| Regresyon | 1v1 kuyruk ve iptal, 3 kişilik eşleşme, kopma, yenileme: PASS (bkz. `REGRESSION_LOG.md`) |

---

## B-03 — Bağlantı yavaşken iptal ile eşleşme çakışırsa rakip tek başına odaya gönderiliyor (FIXED, Draft modu hariç)

| Alan | Değer |
|---|---|
| Modül | Eşleştirme, eski panel (1v1 ve Imposter; aynı kod yolu) |
| Öncelik | P2 |
| Durum | **FIXED** (XOX, Career Twin, Imposter; yan sayfalar ve ana sayfa). **Draft modu için OPEN**: Draft kapsam dışı olduğu için Draft aramasının iptal yolu bilerek değiştirilmedi. Önceden var olan hata, B-02 düzeltmesinden bağımsız |

**Tekrar üretme adımları:** A XOX'ta RAKİP ARA'ya basar. A'nın yazma istekleri 1,5 sn gecikmeli gider
(yavaş mobil bağlantıyı simüle eder). A İPTAL'e basar ve hemen ardından B RAKİP ARA'ya basar.

**Beklenen:** İki oyuncu aynı sonuca varır: ya ikisi de eşleşir ya da hiçbiri.

**Gerçekleşen:** `{"A":"stayed","B":"sent-to-room"}`. B, host'u (A) hiç gelmeyecek bir odaya gidiyor.
Zorlanmış senaryoda (M-07) 10/10. Doğal zamanlamada (M-06) 29 çalıştırmanın 1'inde kendiliğinden oluştu (paralel yük altında);
o çalıştırmanın ayrıntılı çıktısı kaydedilemedi.

**Kök neden (kod incelemesi):** İptal işleyicisi önce aboneliği kapatıyor (`state.queueOff()`), sonra kaydı **durumuna
bakmadan** siliyor. B'nin eşleştirme transaction'ı, A'nın silme isteğinden önce sunucuya ulaşırsa A'yı `matched`
olarak işaretliyor. B yönlendiriliyor, A ise artık dinlemediği için hiçbir şey görmüyor.

**Ana sayfa:** `neon-social-safe-v4.js` içindeki `cancelSearch` aynı yapıdaydı; M-09 ile orijinal kodda 2/2 yeniden üretildi.
Imposter (3 kişi) için M-08: orijinal kodda 2/2 `{"A":"stayed","B":"sent-to-room","C":"sent-to-room"}`.

**Düzeltme (FIX-09):** İptal, oyuncunun kendi kuyruk kaydında bir transaction: kayıt hâlâ `waiting` ise siliniyor;
`matched` ise iptal geç kalmış demektir, transaction iptal ediliyor ve oyuncu eşleşmeye yönlendiriliyor
("Eşleşme zaten bulundu. Oyun açılıyor…"). Eşleşme dinleyicisi işlem bitene kadar açık kalıyor. İki taraf her zaman
aynı sonuca varıyor: ya ikisi de aynı odada ya da ikisi de kuyrukta değil.

**Test:** `tests/matchmaking-regression.spec.mjs` → M-06, M-07 (yan sayfa 1v1), M-08 (Imposter 3 kişi), M-09 (ana sayfa),
M-10 (ana sayfada normal iptal). Orijinal koda karşı M-07, M-08 ve M-09 2/2 FAIL; düzeltmeyle 5/5 PASS.
Not: M-07 artık A'nın transaction (`/cas`) isteklerini de geciktiriyor; düzeltme iptali transaction ile yaptığı için
yalnızca `/write` geciktirmek yavaş bağlantıyı simüle etmezdi. Orijinal kod iptalde `/write` kullandığı için bu değişiklik
orijinal sonuç üzerinde etkisiz (yine 2/2 FAIL).

---

## Gözlemler (henüz hata olarak doğrulanmadı veya düşük öncelikli)

| ID | Modül | Gözlem | Öncelik | Durum |
|---|---|---|---|---|
| UX-01 | XOX menü (390×844) | "OYUN MODU" başlığının ilk harfi kartın sol kenarında kırpılıyor (`explore-xox` ekran görüntüsü) | P4 | NOT TESTED (sistematik mobil tur yapılmadı) |
| OBS-01 | Parti ayrılma | Ayrılma iki transaction'dan oluşuyor (önce parti düğümü, sonra kullanıcının işaretçisi). Arada kopma olursa bayat işaretçi kalabilir; bu durum `currentPartyMembership`/`validPartyFor` ile kendiliğinden düzeliyor. Ana sayfadaki yöntemle aynı | — | Bilgi |
| OBS-02 | Mevcut testler | `scripts/test_imposter_realtime_render.cjs` ve `scripts/test_xox_answer_review.cjs` bu çalışmadan önce de FAIL veriyordu | P3 | Bu çalışmada incelenmedi |
| OBS-03 | Mevcut testler | `scripts/` testlerinin çoğu "kaynakta şu metin var mı" kontrolü yapıyor; B-01 ve B-02'yi yakalamadılar | — | Bilgi |

---

## B-04 — RE:VERSE mikrofon: mobilde sessiz kayıt, takılan kayıt, belirsiz hatalar

| Alan | Değer |
|---|---|
| Modül | RE:VERSE (`side-games/reverse-xi/reverse-xi.js`) |
| Öncelik | P1 (oyunun temel mekaniği mikrofon; kayıt sessiz giderse karşı taraf oynayamıyor) |
| Durum | **FIXED (Chromium'da doğrulandı)**. Gerçek iOS/Android cihaz doğrulaması **BLOCKED** |

Geçmiş: 1 Kasım'da iOS için 7 ardışık yama yapılmış (PCM yakalama, AudioContext'i yeniden kullanma, Safari çözme yedeği).
Bu yamalar belirtileri hedef almış; aşağıdaki nedenler yerinde kalmıştı.

| # | Kök neden | Kanıt | Kullanıcıya etkisi |
|---|---|---|---|
| 1 | AudioContext, izin isteği **bitince** (`await getUserMedia` sonrası) başlatılıyordu. iOS ses başlatmayı yalnızca dokunuş sırasında kabul eder | R-06: sıra `getUserMedia → resume` | İlk kayıtta "DURDUR" yazar ama hiçbir şey kaydedilmez, durdurma da çalışmaz (iOS) |
| 2 | İsim kaydında kayıt ve `SpeechRecognition` **aynı anda** mikrofonu açıyordu | R-07: mobil UA'da tanıma kayıtla birlikte başlıyordu | Android Chrome ve iOS'ta iki yakalama mikrofonu paylaşamaz; bilinen sonuç sessiz kayıt veya tanıma hatası. **Cihazda doğrulanamadı** (platform davranışı) |
| 3 | Mikrofon akışı maç boyunca açık tutuluyor, yalnızca `readyState` kontrol ediliyordu; arka plan için işlem yoktu | R-04: arka plana alınınca iz açık kaldı | iOS'ta arama veya arka plan sonrası iz "live ama muted" kalır, sonraki turlar sessiz kaydedilir; mikrofon göstergesi sürekli açık |
| 4 | Sessiz kayıt fark edilmeden karşıya gönderiliyordu | R-03 | "Ses karşı tarafa ulaşmıyor": aslında sessizlik ulaşıyor |
| 5 | İzin hataları ham İngilizce mesajla veya JS hatasıyla gösteriliyordu; `mediaDevices` yoksa (uygulama içi tarayıcılar) hata çıkıyordu | R-02, R-02b | Oyuncu ne yapacağını bilmiyor |
| 6 | Kayıt süresi sınırsızdı; çift dokunma iki mikrofon isteği açıyordu; iPhone 48 kHz yüklüyordu (diğerleri 22 kHz) | R-08, R-09, R-01 iPhone | Büyük ve yavaş yükleme; çift kayıt |

Testler (`tests/reverse-mic*.spec.mjs`, iki bağımsız kullanıcı, Chromium sahte mikrofonu bilinen WAV ile besleniyor; karşı tarafa
giden WAV çözülüp sesli olduğu ve **ters çevrildiği** (yükselen tarama → düşen) kontrol ediliyor):

| Aşama | Sonuç |
|---|---|
| Düzeltme öncesi (13 test) | 9 FAIL, 4 PASS (masaüstü ve Android'de tam iki tur, iz kesilmesi ve masaüstü tanıma geçiyordu) |
| Düzeltme sonrası (15 test × 5 tekrar) | **75/75 PASS** |
| Ayırt edicilik (orijinal koda karşı, 15 test) | 11 FAIL, 4 PASS |

## B-05 — RE:VERSE adım başlığı oyun boyunca hiç güncellenmiyor

| Alan | Değer |
|---|---|
| Modül | RE:VERSE · P3 · **FIXED (Chromium'da doğrulandı)** |
| Gerçekleşen | A tüm oyun boyunca "Arkadaşını bekliyoruz · Oda kodunu paylaş", B ise "Rakip bekleniyor" görüyordu |
| Kök neden | `updateStage()` her faz için başlık ve açıklama metnini hesaplıyor ama ekrana yalnızca "B henüz yok" dalında yazıyordu |
| Düzeltme | Hesaplanan başlık ve açıklama her güncellemede `#step-title` / `#step-desc` alanlarına yazılıyor |
| Test | R-10: düzeltme öncesi FAIL, sonrası PASS (×5) |

## UX-02 — RE:VERSE başlıklarında yazı tipi yedeği yok

`reverse-xi.css` içinde 17 adet `font: … Orbitron` tanımında yedek yazı tipi yoktu. Orbitron yüklenene kadar ya da hiç
yüklenemezse başlıklar Times benzeri serif yazı tipiyle görünüyordu. Yedek olarak `system-ui, sans-serif` eklendi.
Çevrim dışı çalışacak mobil uygulama için yazı tiplerinin yerel olarak paketlenmesi ayrıca öneriliyor (bkz. `MOBILE_APP_READINESS.md`).

## B-06 — XOX oyuncu seçme penceresi alt gezinme çubuğunun altında kalıyor

| Alan | Değer |
|---|---|
| Modül | Futbol XOX · P2 · **FIXED (Chromium'da doğrulandı)** |
| Gerçekleşen | Pencere `z-index:30`, ortak alt çubuk (`#nx-arcade-footer`) `z-index:9000`. Sonuç listesinin alt kısmı çubuğun arkasında kalıyor ve dokunuş çubuğa gidiyor. Test, orijinal kodda 3 ekran boyutunun 3'ünde de (masaüstü dahil) doğru cevaba tıklayamadı. Kanıt: `evidence/xox-picker-under-bottom-bar-before.png` |
| Düzeltme | `xox-dark-arena.css`: pencere `z-index:9600` ve alt güvenli alan payı |
| Test | X-01: görünür sonuçların hiçbiri başka bir katmanın altında değil (×5, 3 cihaz) |

## UX-03..05 — XOX tahta okunabilirliği (oyun kuralları değişmedi)

| ID | Sorun | Düzeltme | Doğrulama |
|---|---|---|---|
| UX-03 | Kulüp/ülke/oyuncu adları kelime ortasından bölünüyordu ("Beşikta/ş", "Juvent/us", "Leverkuse/n"): 5 stil katmanında `overflow-wrap:anywhere` | Kelime bölme kapatıldı; sığmayan kelime 0,5 px adımlarla küçültülüyor (en az 9 px), yalnızca o da yetmezse bölünüyor. Dar telefonlarda başlık kutusu yan boşluğu 8 → 4 px | X-02: 20 rastgele tahtada taşma 0; iPhone SE en küçük 9 px, Galaxy S8 11 px, Pixel 7 10,5 px; bölünmeye düşen 0 |
| UX-04 | Kazanan çizgi isimlerin üstünden geçip onları üstü çizili gösteriyordu | Çizgi kare dolgusunun üstünde, isimlerin altında; isimlere koyu hale; çizgi tamamlanınca kazanan kareler bir kez parlıyor (`prefers-reduced-motion`'a uyar) | X-01 (z-sırası ve `isolation`) + görsel (`evidence/xox-before-after-iphone-se.png`) |
| UX-05 | Maç bitince "OYUNCU 1 KAZANDI" kartı alt çubuğun arkasında kalıyordu | Oyun bitince (kazanma veya beraberlik) kart, alt çubuğun üstünde görünecek şekilde kaydırılıyor | X-01 |
| — | Menüde "FUTBOL XOX" başlığının amblemle çakışması | **Hata değil:** test ortamında Google Fonts engelli olduğu için yedek yazı tipinden kaynaklanıyordu; gerçek yazı tipiyle çakışma yok. Yavaş ağda yazı tipi gelene kadar (`display=swap`) görülebilir → yazı tiplerinin uygulamaya paketlenmesi önerisi | Gerçek yazı tipiyle ölçüm |

## Diğer oyunlar — mobil düzen değerlendirmesi (gerçek yazı tipleriyle)

| ID | Oyun | Bulgu | Etki | Durum |
|---|---|---|---|---|
| UX-06 | EN11 | "← YAN OYUNLAR" geri bağlantısının dokunma alanı 121×16 px (WCAG 24 px altı) | Parmakla isabet zor | **FIXED**: görünüm aynı, dokunma alanı 109×44 px (`games-touch.spec.mjs`) |
| UX-07 | Football Wordle | 375×667 (iPhone 8/SE 2-3) ve 375×812 (13 mini) ekranlarda klavye açılışta alt çubuğun altında: iPhone 8'de 8 tuş, 13 mini'de 27 tuşun 27'si. Kaydırınca erişilebiliyor. Galaxy S8 / Pixel 7 / 14 Pro Max'te sorun yok. Başlık "FOOTBALL WORDLE" iki boyutta kesiliyor | Her tahminde kaydırma | **FIXED** (`df7e5d0`): başlık iki buton arasındaki alana göre sınırlandı; kısa dikey ekranlarda boşluklar sıkılaştı, tuş yüksekliği 40 px; küçük bir sığdırma betiği tahtayı (kare en az 28 px) klavye alt çubuğun ayırdığı alanın üstüne gelene kadar daraltıyor. Pixel 7 sınıfı ekranlar değişmedi. `wordle-layout.spec.mjs`: 7 cihaz + yazma testi |
| UX-08 | Career Twin | Yüksekliği ≤700 px ekranlarda (iPhone 8, 13 mini, SE) "NASIL OYNANIR?" kartı "RAKİP ARA" butonunun üstüne biniyor ve buton tıklanamıyor (`elementFromPoint` kartı veriyor). "OYUN MODU" etiketi **tüm** boyutlarda (masaüstü dahil 7/7) ilk mod butonunun arkasında kalıyor | Üçüncü mod tıklanamıyor; panel başlığı görünmüyor | **FIXED**: mod listesi başlığın altından başlıyor; kısa ekranlarda kart panelin altına alındı (`top:78%`). `twin-layout.spec.mjs` |
| — | Imposter, XOX menüsü | Başlık/amblem çakışması | — | **Hata değil** (yazı tipi yüklenmeyince oluşuyor) |
| UX-09 | Futbol XOX | Menü panelindeki "OYUN MODU" etiketi panelin sol üst köşesinde (0,0); panelin kesik köşesi ilk harfi kırpıyor, yazı üst kenara yapışık. Tüm boyutlarda | Görsel kusur | **FIXED**: etiket panelin içinde (üst 6 px, sol %5), mod listesi etiketin altından başlıyor. X-03 (3 cihaz), orijinal CSS'te FAIL |
| UX-10 | EN11 | "EN YÜKSEK / EN DÜŞÜK" yön düğmeleri 30 px yüksekliğinde | Parmakla isabet zor | **FIXED**: görünüm aynı, görünmez dokunma alanı 44 px; altındaki kaynak notu dokunmayı artık yutmuyor. G-02, orijinal kodda FAIL |
| UX-11 | Nasıl Oynanır, Imposter çevrim içi ekranı, RE:VERSE | Bazı yazı tipi tanımlarında genel yedek yok (`font:900 16px 'Orbitron'`); yazı tipi gelene kadar veya gelmezse oyun adları tarayıcının serif yazı tipiyle (Times) görünüyor | Yükleme sırasında tasarım dışı görünüm | **FIXED**: 21 tanıma `system-ui,sans-serif` eklendi |
| — | Tüm sayfalar | Yatay taşma yok; güvenli alan (çentik) destekli; XOX, Wordle, Imposter ve Nasıl Oynanır'da yakınlaştırma kapalı (`user-scalable=no`) | Erişilebilirlik notu | Bilgi |

Kanıt: `evidence/layout-twin-wordle-375x667-360x740.png` (önce), `evidence/twin-menu-375x667-after.jpg` (Career Twin sonrası). Denetim aracı: `perf/mobile-audit.mjs`.
