# Architecture Audit — NEON XI (Draft XI hariç tutularak)

Tarih: 2026-11-19 · Commit tabanı: `2fced2d` · **Kaynak kodda değişiklik yapılmadı.**
Draft XI'ın mekanikleri incelenmedi. Çekirdekteki Draft kodu yalnızca boyut ve yükleme maliyeti açısından envantere alındı.
Ölçüm verileri `PERFORMANCE_REPORT.md` içinde.

> Ek kök neden (ölçümle doğrulandı): BOOT_GUARD'ın `body::before` örtüsü, çekirdeğin dekoratif `body:before` kuralındaki
> `mask-image: linear-gradient(black, transparent 88%)` değerini miras alıyor. Örtü aşağıya doğru saydamlaşıyor ve altındaki eski
> `#bootScreen` görünüyor. Bkz. PERF-01 ve `evidence/perf-guard-overlay-bleed-7625ms.jpg`.

## 1. Açılış zinciri (ana sayfa)

```
index.html (12 KB)
 ├─ <head>: Google Tag Manager (async), satır içi boot stili
 ├─ "NEON XI YÜKLENİYOR" yazısı
 └─ async IIFE
     1. fetch('./neon-xi-core.html?v=VERSION')     1,69 MB ham / 779 KB gzip — tamamı inmeden hiçbir şey ayrıştırılamaz
     2. 6 × replaceRequired(...)                     çekirdeğe metin yaması (~15 ms; 4× CPU'da ~60 ms)
     3. </head> öncesine: BOOT_GUARD + sosyal stil + Draft seçim stili + entry css
     4. </body> öncesine: 40 etiket (25 klasik script + 10 module script + CSS) + REVEAL_SCRIPT
     5. document.open(); document.write(html); document.close();
```

`document.open()`, ilk belgenin içeriğini ve **window/document üzerindeki tüm olay dinleyicilerini siler**. Ardından tarayıcı
1,69 MB'lık metni ikinci bir belge olarak baştan ayrıştırır. Sonuçları:

- **Akış yok.** Çekirdek `fetch` ile tek parça indiriliyor; tarayıcı ilk baytları gelir gelmez ayrıştırmaya ve
  görseller gibi alt kaynakları erkenden istemeye başlayamıyor. Slow 4G'de çekirdek ~5,3 sn'de tamamlanıyor ve o ana kadar
  ekranda yalnızca boot yazısı var.
- **Satır içi her şey her açılışta yeniden çalışıyor.** 24 satır içi script bloğu (~811 KB JS) ve 24 stil bloğu (~181 KB) ayrı
  dosya olarak önbelleğe alınamıyor; çekirdek değişince hepsi birlikte yeniden indiriliyor.
- **Klasik script'ler ayrıştırıcıyı bloke ediyor.** Enjekte edilen 25 klasik script sırayla çalışmak zorunda. İndirmeler paralel
  (önizleme tarayıcısı `document.write` içeriğini tarıyor), ama yürütme seri.
- **Module script'ler `DOMContentLoaded`'ı geciktiriyor.** 10 sosyal modül ve bunların gstatic'ten içe aktardığı Firebase SDK
  (`firebase-app/auth/database.js`) `DOMContentLoaded`'dan önce inmek ve çalışmak zorunda. Yeni ana ekran
  (`home-approved-v1.js`) ancak `DOMContentLoaded`'da kuruluyor.
- **Kırılganlık.** `replaceRequired`, çekirdekte birebir eşleşen 6 metin parçası arıyor. Çekirdekte tek bir satır değişirse
  uygulamanın tamamı "NEON XI yüklenemedi" hatası veriyor.

### Yükleme ekranı katmanları (sırayla görünenler)

| # | Katman | Kaynak | Ne zaman kalkıyor |
|---|---|---|---|
| 1 | "NEON XI YÜKLENİYOR ●" (sayfanın üstünde küçük yazı) | `index.html` | `document.open()` |
| 2 | BOOT_GUARD: `body::before` ile tam ekran "NEON XI YÜKLENİYOR" | `index.html` → çekirdek `<head>` | `#bootHome.nx-approved-home-v1` oluşunca **veya 9 sn'lik sayaç dolunca** (REVEAL_SCRIPT) |
| 3 | `#nxEntry`: "OTURUM KONTROL EDİLİYOR" | `side-games/neon-entry-v1.js` | Auth durumu bilinince; oturum yoksa 2,16 MB'lık giriş görseli yüklenince "welcome" aşamasına geçiyor |
| 4 | `#nxSplashOverlay`: "NEON XI · FOOTBALL SIMULATION · v1.0.0" + Draft ipucu | `side-games/neon-splash-safe-v1.js` | Ana ekran hazır olunca + 220 ms, **veya 9 sn** |
| 5 | Yeni ana ekran (SVG + iki büyük PNG katmanı) | `side-games/home-approved-v1.js` | — |

Bu katmanlar birbirinden habersiz; her biri kendi sayacı ve `MutationObserver`'ı ile çalışıyor.

### Eski ana ekran nerede?

`home-approved-v1.js`, çekirdekteki eski `#bootHome` içeriğini **silmiyor**. Hepsini `display:none` ve `inert` olan bir
`.nx-approved-legacy` kabına taşıyor ve yeni ana ekrandaki bazı butonlar, eski butonları metinle bulup programatik olarak
tıklıyor (`findAction` / `clickTarget`, ör. "nasıl oynanır", "şikayet/öneri", turnuva, ayarlar). Eski ekran, yeni ekranın
görünmez bir vekili olarak yaşıyor. İçinde 262 KB'lık (base64 olarak 341 KB) gömülü logo PNG'si de var ve bu görsel her açılışta çözülüyor.

## 2. `neon-xi-core.html` içeriği (1.692.334 bayt)

| Bileşen | Bayt | Not |
|---|---|---|
| Satır içi JS (24 blok) | 811.160 | Bkz. aşağıdaki tablo |
| Satır içi CSS (24 blok) | 186.211 | En büyüğü 46 KB `:root` teması; maç, taktik ve mobil yatay düzen katmanları |
| Gömülü base64 PNG (2 adet) | 671.320 | Eski ana ekran logosu 850×187 (262 KB) + Draft ekranı logosu 900×290 (242 KB) |
| HTML işaretlemesi (görseller hariç) | ~24.000 | Ekranlar: `bootScreen`/`bootHome`, `draftScreen`, `tacticsScreen` vb. |

| Blok | KB | Alan | Başlık (kaynaktan) |
|---|---|---|---|
| #1 | 104 | Turnuva (Draft) | `NEON_TOURNAMENT_HTML_B64`: base64 olarak gömülü ikinci bir HTML belgesi |
| #2 | 59 | Draft verisi | `const PLAYERS = [...]` |
| #4, #5, #7, #9 | 119 + 46 + 39 + 25 | Draft | KADRO v1.12, v1.13, v1.19, v1.20 (bot) |
| #6 | 171 | Maç motoru | Spiker Motoru v2 |
| #8, #10, #21 | 33 + 15 + 6 | Draft online (Firebase) | Online oda, Hard Match Sync, turnuva online |
| #3, #15, #16–#19 | 3 + 48 + 2 + 19 + 13 + 13 | Maç sunumu | 2D akış, v4 sunum, maç öncesi, olay sineması |
| #13, #14, #20 | 8 + 18 + 8 | Draft | Rastgele kadro, V3 UI, turnuva köprüsü |
| #0, #11, #12, #22 | 0 + 4 + 20 + 5 | **Hub (ana ekran)** | Giriş koruması, ekran navigasyonu, URL rotaları, ayarlar |

**Sonuç:** Çekirdeğin ~%95'i Draft, maç motoru ve turnuva kodu ile verisi. Ana ekrana (hub) ait kısım ~30 KB. Ana ekranı
göstermek için her açılışta Draft uygulamasının tamamı indiriliyor, ayrıştırılıyor ve çalıştırılıyor.

Çekirdekte 8 `setInterval`, 53 `setTimeout`, 13 `MutationObserver` ve 82 `addEventListener` var.

## 3. `index.html`'in enjekte ettiği 41 dosya

Toplam 424 KB ham / 127 KB gzip. **Boyut sorun değil; yürütme maliyeti ve bağımlılık karmaşası sorun.**

| Grup | Dosyalar | Adet | Ana ekran için gerekli mi? |
|---|---|---|---|
| Ana ekran / giriş | neon-entry-v1.css/js, neon-entry-auth-v1.js, neon-splash-safe-v1.js, home-approved-v1.js, home-art-fix-v4.js, neon-arcade-ui-v1.css/js | 8 | Evet (splash ve art-fix tartışmalı, bkz. §5) |
| Sosyal | neon-social.js, -drawer-v1, -consistency-v1, -safe-v4, -identity-sync-v1, -badge-click-v1, neon-party-membership-integrity-v2, party-match-broker-v1 (+ dinamik: neon-social-presentation.js/.css, neon-social.css) | 8 (+3) | Evet; ama aynı işlevin birden fazla sürümü var (§4) |
| Draft turnuvası / parti köprüsü | party-draft-tournament-router-v1, party-tournament-auto-entry-v1, tournament-back-safe-v2 | 3 | Hayır (Draft'a girilince) |
| Draft / maç / taktik | match-depth.*, match-stadium-user-v3.*, tactical-*, draft-mobile.css, draft-readability-v1.css, draft-mobile-ui.js, prematch-mobile-v2.*, chem-inspector-fix.js, draft-player-club-refresh, draft-pool-scoreboard-refresh, superlig-player-data-…, public-source-ui-guard-v1 (→ draft-player-integrity-v1.js), match-2d-*, match-mobile-layout-fix-v1.css, match-scoreboard-v1.* | 23 (+1 dinamik) | Hayır |
| Draft online yardımcı | online-mobile-navigation-fix-v1.js | 1 | Hayır, ama **açılışın en pahalı dosyası** (§5) |

**41 dosyadan yaklaşık 16'sı ana ekranın ilk açılışı için gerekli.** Kalan ~25 dosya Draft, maç ve turnuva katmanı. Bunlar
çekirdek fonksiyonlarını açılışta sarmaladıkları ("yama" olarak) için sırayla ve erken yüklenmeleri bugünkü tasarımın bir
gereği. Bunları geciktirmek Draft'ın yükleme sözleşmesini değiştirir; Draft kapsam dışı olduğu için **bu çalışmada önerilmiyor**.

Yan oyun sayfaları bu 41 dosyanın yalnızca 2–5'ini yüklüyor (bkz. §4.2).

## 4. Ortak servisler ve tekrarlar

### 4.1 Aynı işi yapan farklı uygulamalar (ana sayfa)

| İşlev | Uygulama sayısı | Dosyalar | Gerçekte çalışan (ana sayfa) |
|---|---|---|---|
| Partiden ayrılma | 6 | neon-social, drawer-v1, safe-v4, consistency-v1 ×2, membership-integrity-v2 | membership-integrity-v2 (capture-phase yakalama) |
| Parti kurma | 3 | neon-social, drawer-v1, consistency-v1 | consistency-v1 (yakalama) |
| Parti daveti gönderme / kabul | 3 + 3 | neon-social, drawer-v1, consistency-v1 | consistency-v1 (yakalama) |
| Arkadaşlık isteği gönderme / kabul | 3 + 3 | neon-social, drawer-v1, consistency-v1 | duruma göre drawer-v1 veya consistency-v1 |
| Eşleştirme başlat / iptal | 2 + 2 | neon-social, safe-v4 | safe-v4 (ana sayfa), neon-social (yan sayfalar) |
| `MODES` tanımı | 4 | neon-social, drawer-v1, safe-v4, party-match-broker | dördü de kendi kopyasını kullanıyor |
| Firebase yapılandırması | 11 kopya | çekirdek ×3, 4 yan oyun shim'i, 4 sosyal modül | — |
| `onAuthStateChanged` | 15 çağrı | 9 sosyal/giriş modülü + çekirdek + 4 oyun | her biri ayrı dinleyici kuruyor |
| `NEON_SOCIAL.open` override | 3 | home-approved-v1, safe-v4, drawer-v1 | yükleme sırasına göre en son yükleyen kazanıyor |

Bu desen ("eski fonksiyonu silme, üstüne capture-phase tıklama yakalayıcısı veya override ekle") B-01'in de sebebiydi:
ana sayfadaki düzeltme yan sayfalara ulaşmamıştı.

### 4.2 Sayfa → sosyal modül sürümü

| Sayfa | Yüklenen sosyal modüller |
|---|---|
| Ana sayfa | 11 modül (yukarıdaki tümü) |
| XOX, Career Twin, Imposter | party-match-broker, neon-social, arcade-ui, consistency-v1 |
| Wordle, Arcade | neon-social, arcade-ui, consistency-v1 |
| RE:VERSE, EN11, Nasıl Oynanır | Sosyal katman yok |

Aynı kullanıcı, ana sayfada drawer arayüzünü ve onun parti/eşleştirme kodunu; yan sayfada ise eski paneli ve
`neon-social.js` içindeki kodu kullanıyor.

## 5. Kullanılmayan veya etkisiz kod ve dosyalar

Her madde referans aramasıyla doğrulandı (dinamik yollar ayrıca kontrol edildi). **Hiçbiri silinmedi.**

| Öğe | Durum | Kanıt | Boyut |
|---|---|---|---|
| `side-games/assets/premium-home/neon-xi-approved-home-20260903.png` | Hiçbir yerden referans yok | `git grep` | 1,78 MB |
| `…/neon-xi-home-idle-v3.png` + `.webp` | Referans yok | `git grep` | 1,84 MB |
| `…/neon-xi-foreground-brown-v6.png` | Referans yok | `git grep` | 1,69 MB |
| `…/neon-xi-foreground-v4.png` | Yalnızca `scripts/home-visual-check.html` (QA aracı) | `git grep` | 2,18 MB |
| `match-stadium-user-v2.css/.js` | Referans yok (v3 kullanılıyor) | `git grep` | 3 KB |
| `match-player-b.svg`, `match-player-gk.svg` | Referans yok (v6 sürümleri kullanılıyor) | `git grep` | 3 KB |
| `neon-social-drawer-v1.js` `leaveParty()` | Ölü kod: ana sayfada yakalama modülü önce çalışıyor | B-01 analizi | — |
| `neon-social.js` eski panel davet/kabul/kurma | Ana sayfada etkisiz (consistency-v1 yakalıyor); yan sayfalarda **canlı** | Yükleme haritası | — |
| `home-art-fix-v4.js` + 12 `.b64` parçası | Katmanlı arka plan varsa erken çıkıyor; Tüm istek URL'lerinin kaydedildiği 15 ana sayfa koşusunun hiçbirinde `.b64` isteği yok | Ağ kaydı (`baseline-extra`, tüm istek URL'leri) | 1,4 KB + 66 KB |
| Eski ana ekran DOM'u (`.nx-approved-legacy`) | Kullanılmıyor değil: yeni ekran buradaki butonları programatik tıklıyor | Kod | 262 KB'lık gömülü logo dahil |

## 6. Önerilen hedef mimari (aşamalı, Draft'a dokunmadan)

1. **Tek açılış katmanı.** Boot yazısı, guard, entry "kontrol ediliyor" ve splash; tek bir sahibi olan tek bir yükleme
   ekranında birleşsin. Ekran ancak ana ekran gerçekten hazır olduğunda kalksın; sabit 9 sn'lik "zorla göster" sayaçları,
   hazır olmayan bir ekranı açığa çıkarmasın.
2. **Ana ekran görsellerinin hafifletilmesi.** 853×1844 PNG'ler (2,05 + 1,80 MB) WebP/AVIF ve cihaz çözünürlüğüne uygun
   boyutlarla sunulsun; ön plan katmanı `preload` ile erken istensin.
3. **Sürekli çalışan tarayıcıların kısılması.** `online-mobile-navigation-fix-v1.js` gibi her DOM değişikliğinde tüm sayfayı
   tarayan katmanlar, kare başına en fazla bir kez ve yalnızca ilgili ekran açıkken çalışsın.
4. **Tek sosyal servis.** `social/` altında tek bir `neon-social-core` (auth, profil, arkadaşlar, parti, kuyruk, presence) ve
   ona bağlanan iki görünüm (ana sayfa drawer, yan sayfa paneli). Firebase yapılandırması ve `MODES` tek yerde olsun.
   Override ve capture-phase yakalama yamaları, servis içindeki tek uygulamaya indirgensin. Geçiş, her adımda
   `qa-suite` regresyonu çalıştırılarak, bir işlev bir seferde taşınarak yapılmalı.
5. **Hub ile Draft'ın ayrılması (Draft QA'sı ile birlikte, ayrı onayla).** Ana ekran 1,7 MB'lık Draft çekirdeğini
   indirmeden açılabilsin; Draft'a girildiğinde çekirdek ve 25 Draft/maç dosyası yüklensin. En büyük kazanç burada, ama
   Draft'ın yükleme sözleşmesini değiştirdiği için bu çalışmanın kapsamı dışında.
