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

## B-03 — Bağlantı yavaşken iptal ile eşleşme çakışırsa rakip tek başına odaya gönderiliyor (OPEN)

| Alan | Değer |
|---|---|
| Modül | Eşleştirme, eski panel (1v1 ve Imposter; aynı kod yolu) |
| Öncelik | P2 |
| Durum | **OPEN**. Önceden var olan hata, B-02 düzeltmesinden bağımsız; orijinal kodda da 2/2 oluştu |

**Tekrar üretme adımları:** A XOX'ta RAKİP ARA'ya basar. A'nın yazma istekleri 1,5 sn gecikmeli gider
(yavaş mobil bağlantıyı simüle eder). A İPTAL'e basar ve hemen ardından B RAKİP ARA'ya basar.

**Beklenen:** İki oyuncu aynı sonuca varır: ya ikisi de eşleşir ya da hiçbiri.

**Gerçekleşen:** `{"A":"stayed","B":"sent-to-room"}`. B, host'u (A) hiç gelmeyecek bir odaya gidiyor.
Zorlanmış senaryoda (M-07) 10/10. Doğal zamanlamada (M-06) 29 çalıştırmanın 1'inde kendiliğinden oluştu (paralel yük altında);
o çalıştırmanın ayrıntılı çıktısı kaydedilemedi.

**Kök neden (kod incelemesi):** İptal işleyicisi önce aboneliği kapatıyor (`state.queueOff()`), sonra kaydı **durumuna
bakmadan** siliyor. B'nin eşleştirme transaction'ı, A'nın silme isteğinden önce sunucuya ulaşırsa A'yı `matched`
olarak işaretliyor. B yönlendiriliyor, A ise artık dinlemediği için hiçbir şey görmüyor.

**Önerilen yaklaşım (henüz uygulanmadı):** İptal, kendi kaydı üzerinde bir transaction olsun: kayıt `waiting` ise silinsin;
`matched` ise iptal geç kalmış demektir, kullanıcı ya eşleşmeye yönlendirilsin ya da eşleşme açıkça bozulup karşı taraf
kuyruğa geri alınsın. Aynı yapının ana sayfadaki `safe-v4` kopyası da ayrıca test edilmeli.

**Test:** `tests/matchmaking-regression.spec.mjs` → M-06, M-07 (açık hatayı gösterdikleri için şu an FAIL veriyorlar).

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
