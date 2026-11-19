# Performance Report — Temel Ölçüm (optimizasyon öncesi)

Tarih: 2026-11-19 · Commit: `2fced2d` · **Kaynak kodda değişiklik yok.** Bu belge "önce" ölçümüdür. Her iyileştirme
uygulandığında aynı araçla "sonra" sütunu doldurulacak.

## Ölçüm ortamı ve sınırları

| | |
|---|---|
| Tarayıcı | Chromium 157 (Playwright 1.63), Pixel 7 emülasyonu (412×915, DPR 2.625, dokunmatik) |
| Profiller | **fast**: kısıtlama yok (referans). **mid**: Lighthouse mobil devtools kısıtlaması (istek gecikmesi 562,5 ms, 1,47 Mbps indirme, 675 kbps yükleme, 4× CPU). **low**: aynı ağ, 6× CPU |
| Sunucu | `qa-suite/perf/static-server.mjs`: GitHub Pages'e yakın (gzip, `max-age=600`, ETag). HTTP/1.1 (GitHub Pages HTTP/2 kullanır; paralel indirme sınırı farklıdır) |
| Firebase | **Mock** (`qa-suite/harness`). SDK modülleri yerelden anında geliyor; **gerçekte gstatic.com'dan indirilen SDK'nın süresi ölçülere dahil değil**. Etkisi ayrıca "SDK gecikmesi" deneyiyle ölçüldü |
| Engellenen | Google Tag Manager ve Google Fonts (indirilmedi). Gerçek ortamda biraz daha fazla yük var |
| Tekrar | Soğuk açılışlar 5, düşük profil / oturum kapalı / SDK gecikmesi 3 tekrar. Değerler **medyan** |
| Araçlar | `qa-suite/perf/measure.mjs` (zaman çizelgesi, ağ, bellek, dinleyiciler), `qa-suite/perf/cpu-profile.mjs` (dosya başına CPU), `qa-suite/perf/probe.js` (kare kare görünen katman) |

Ham veriler `qa-suite/perf/baseline-summary.json`, `baseline-cpu-startup.json` ve `baseline-cpu-idle.json` dosyalarında.
Kare görüntüleri `qa-suite/evidence/` altında.

**Bilinen ölçüm sorunları (dürüstlük notu):**
- İlk turda sonda 25 sn'de duruyordu; 25 sn'den sonraki olaylar kaydedilmedi. Etkilenen profiller (low, oturum kapalı)
  sonda 120 sn'ye çıkarıldıktan sonra yeniden ölçüldü. Tablolardaki değerler düzeltilmiş turdan.
- Uzun görev (longtask) sayıları ölçüm turları arasında tutarsız çıktı (benzer profillerde 123 ve 31). Bu yüzden TBT
  karar metriği olarak kullanılmıyor; CDP script süresi ve CPU profili kullanılıyor.
- Sondanın kendi maliyeti açılış CPU'sunun %2,5'i (profilde ayrı satır olarak ölçüldü). Boşta ölçümlerinde sonda kapalı.

## 1. Ana ekran açılışı (oturumu açık kullanıcı)

Zamanlar sayfa açılışından itibaren ms.

| Metrik | fast (n=5) | **mid soğuk** (n=5) | mid önbellekli (n=5) | low soğuk (n=3) |
|---|---|---|---|---|
| Çekirdek (`neon-xi-core.html`) indi | 24 | **5.298** | 54 | 5.327 |
| Yeni ana ekran kuruldu (`homeApproved`) | 2.095 | **15.721** | 8.666 | 20.693 |
| Guard kalktı | 2.290 | 16.677 | 9.447 | 21.668 |
| Splash kalktı | 2.494 | 17.139 | 9.865 | 22.946 |
| **Etkileşime hazır** (ana ekran görünür, örtü yok, sosyal hazır) | 2.748 | **17.538** | **10.469** | **23.875** |
| **Ana ekran görselleri tamamlandı** | 2.933 | **48.097** | 11.208 | 49.392 |
| LCP | 2.316 | 45.272 | 9.416 | 48.032 |
| Script süresi (CDP, toplam) | 2.593 | 35.287 | 8.003 | 34.157 |
| Layout / style süresi | 916 / 302 | 4.112 / 3.037 | 3.762 / 1.173 | 6.482 / 3.521 |
| JS heap (MB) | 6,1 | 12,3 | 20,8 | 7,7 |
| DOM düğümü | 17.046 | 17.378 | 18.210 | 17.683 |
| İstek / aktarılan | 59 / 7.971 KB | 59 / 7.971 KB | 59 / ~0 KB | 59 / 7.971 KB |

### Ağ dökümü (mid soğuk)

| Tür | Adet | KB |
|---|---|---|
| Görsel | 10 | **7.061** |
| Çekirdek HTML (fetch) | 1 | 759 |
| Script | 35 | 111 |
| CSS | 12 | 36 |
| Belge (`index.html`) | 1 | 4 |

En büyük 5 dosya: `assets/match-stadium-user-v6.png` **2.799 KB (maç ekranı görseli; ana ekranda kullanılmıyor)**,
`premium-home/neon-xi-background-v4.png` 2.006 KB, `premium-home/neon-xi-foreground-ice-v5.png` 1.760 KB,
`neon-xi-core.html` 759 KB, `assets/neon-xi-logo-outline.png` 386 KB.

### Kullanıcının gördüğü sıra (mid soğuk, kare kare)

Kanıt: `evidence/perf-baseline-filmstrip-mid-cold.jpg`

| Zaman | Ekranda |
|---|---|
| 0,7 sn | Sayfanın en üstünde küçük "NEON XI YÜKLENİYOR ●" |
| 5,8 sn | Ortada "NEON XI YÜKLENİYOR"; **alt yarıda eski `#bootScreen` paneli (yeşil parıltı, köşe çerçeveleri) görünüyor** |
| ~11–16 sn | **"OTURUM KONTROL EDİLİYOR"** (kullanıcı zaten giriş yapmış) |
| ~16–17 sn | "NEON XI · FOOTBALL SIMULATION · v1.0.0" splash'ı, Draft ipucuyla |
| 17,5 sn | Ana ekran; **görseller yok, koyu ve boş** |
| 17,5–48 sn | Ana ekran görselleri yukarıdan aşağı yavaşça çiziliyor |
| Önbellekli açılış | Profil çipi önce "Oyuncu", ~1,5 sn sonra kullanıcı adı |

## 2. Oturumu açık olmayan (yeni) kullanıcı

| Metrik (mid soğuk, n=3) | Değer |
|---|---|
| Giriş ekranı butonlarıyla hazır (`entryWelcome`) | **60.471 ms** |
| İstek / aktarılan | 61 / 10.083 KB (+2,16 MB giriş görseli) |

Giriş ekranı, 2,16 MB'lık `assets/entry/first-login-v1.png` yüklenene kadar "OTURUM KONTROL EDİLİYOR" gösteriyor. Bu görsel,
arka planda aynı anda inen ana ekran (3,8 MB) ve stadyum (2,8 MB) görselleriyle bant genişliği için yarışıyor.

## 3. Firebase SDK gecikmesi deneyi (gerçek üretimdeki gstatic indirmesini taklit eder)

| SDK gecikmesi | Çekirdek ayrıştırıldı | Guard kalktı | Ana ekran kuruldu | Etkileşime hazır | Aktarılan |
|---|---|---|---|---|---|
| 0 (mock, yerel) | (mid soğuk) | 16.677 | 15.721 | 17.538 | 7.971 KB |
| 4 sn | 11.407 | 20.941 | 20.193 | 22.060 | 7.971 KB |
| 8 sn | 11.754 | **21.177** | **24.847** | 26.944 | 10.083 KB |
| 12 sn | 11.705 | **21.222** | **32.169** | 33.866 | 10.083 KB |

- SDK 8 sn ve üzeri gecikince **guard, ana ekran hazır olmadan 3,7–11 sn önce kalkıyor**: çekirdek ayrıştırıldıktan
  ~9,4 sn sonra çalışan `REVEAL_SCRIPT` sayacı. Bu aralıkta eski ana ekranın görünmemesinin tek sebebi, giriş katmanının onu
  örtmesi. Hiçbir koşuda eski `#bootHome` kareye yansımadı (0 kare).
- 12 sn gecikmede kullanıcı **21 sn boyunca "OTURUM KONTROL EDİLİYOR"** görüyor ve ~23. saniyeden itibaren, zaten giriş yapmış
  olmasına rağmen **"Oturum kontrolü gecikti. Bağlantını kontrol edip sayfayı yenileyebilirsin."** uyarısı çıkıyor
  (`evidence/perf-baseline-filmstrip-sdk-delay-12s.jpg`).
- Aynı zaman aşımı, oturumu açık kullanıcı için de 2,16 MB'lık giriş görselini indirtiyor (+2.112 KB).

## 4. Ana iş parçacığı: süre nereye gidiyor?

### Açılış (mid profil, 4× CPU, sayfa açılışından etkileşime kadar; 3 koşu medyanı, örneklenen 14.347 ms)

| Dosya | ms | Pay |
|---|---|---|
| `online-mobile-navigation-fix-v1.js` | **9.521** | **%66,4** |
| `index.html` satır içi (çekirdek blokları + boot) | 1.485 | %10,4 |
| `prematch-mobile-v2.js` | 1.108 | %7,7 |
| V8 (program) / GC | 881 / 184 | %7,4 |
| QA sondası (ölçüm yükü) | 362 | %2,5 |
| Diğer 35 dosyanın toplamı | < 300 | < %2 |

Yerel çağrılar çağıran dosyaya aktarıldı. En büyüğü `getBoundingClientRect` (6.517 ms), yani zorunlu yerleşim hesabı.

### Boşta (ana ekran açık, kullanıcı bir şey yapmıyor; 20 sn pencere)

| Dosya | ms / 20 sn | Pay |
|---|---|---|
| `online-mobile-navigation-fix-v1.js` | 8.663 | %42,9 |
| `prematch-mobile-v2.js` | 8.364 | %41,4 |
| `index.html` satır içi | 1.545 | %7,7 |
| Gerçek boşta süre | 26 | %0,1 |

| Boşta metrik (120 sn) | Değer |
|---|---|
| CPU süresi | **997 ms / sn** (4× yavaşlatılmış çekirdek kesintisiz meşgul) |
| Script süresi | 915 ms / sn |
| Heap | 3–20 MB arasında salınım (yoğun ayırma ve GC); 2 dk sonunda +8,9 MB |
| JS olay dinleyicisi | 648 → 648 (artış yok) |
| Kalıcı `setInterval` sayısı | **12**: çekirdekte 150/220/250/500/650/850/1200 ms; navigation-fix 700 ms; maç motoru 70 ms; turnuva 700 ms; splash 3.200 ms (splash kalktıktan sonra da çalışıyor); ana ekran 1.500 ms |

**Kök neden zinciri (kanıtlandı):**
1. Gizli Draft ve maç ekranları boşta da DOM'u değiştiriyor. Çekirdekte `setInterval(checkAutomaticTacticsTransition, 150)`
   ve `<body>` alt ağacındaki her değişiklikte `hideOldDraftControls()` çalışıyor; aynı değerleri `setAttribute` ile tekrar
   yazıyor. 10 sn'de `#readyA` / `#readyB` / `#toTacticsBtn` / `#autoFillBtn` / `.draftBottom` için 150–203'er, maç kartı
   (`#matchVisualCard`, `#nv4PressurePanel`) için 84–168'er mutasyon ölçüldü.
2. `online-mobile-navigation-fix-v1.js` ve `prematch-mobile-v2.js`, belgenin tamamını gözleyen `MutationObserver`'lar kuruyor.
   Her değişiklikte tüm `div/section/main` (veya tüm `*`) öğelerinde `getComputedStyle` + `getBoundingClientRect` +
   `innerText` okuyorlar (~17 bin düğüm). Navigation-fix rAF çağrılarını birleştirmiyor; ayrıca her 700 ms'de bir çalışıyor.
3. Sonuç: düşük ve orta seviye mobil cihazda ana iş parçacığı sürekli dolu. Dokunmalara gecikmeli tepki, pil tüketimi ve ısınma.

Bu zincirin dört halkası da Draft, maç veya Draft-online alanında (bkz. öneriler, onay gerekiyor).

## 5. Sosyal panel ve dinleyiciler

| Metrik (ana sayfa, mid profil) | Değer |
|---|---|
| Sosyal drawer açılışı: Arkadaşlar / Lobi (10 açılış, medyan) | 529 ms / 536 ms (boşta CPU dolu iken) |
| Firebase `onValue` dinleyicisi | **20 dinleyici, 8 benzersiz yol** |
| Tekrarlanan yollar | `userParty` ×4, `profiles` ×4, `friendRequests` ×4, `partyInvites` ×3, `friends` ×2 |
| `onAuthStateChanged` dinleyicisi | 8 |
| 10 aç/kapa döngüsü sonrası Firebase dinleyicisi | 20 → 20 (**sızıntı yok**) |
| 10 aç/kapa döngüsü sonrası JS olay dinleyicisi | 649 → 656 (+7) |
| Skor tablosu | `social/leaderboards/allTime` düğümünün tamamı her çevrim içi kullanıcıya akıyor (sorgu limiti yok) |

Gerçek Firebase SDK'sı aynı yoldaki dinleyiciler için sunucuya tek abonelik açar; bu yüzden ağ trafiği katlanmıyor. Ancak her
güncellemede 2–4 ayrı geri çağrı ve yeniden çizim çalışıyor.

## 6. Yan oyun sayfaları (mid soğuk, n=3)

| Sayfa | FCP | LCP | Yükleme | Sosyal hazır | İstek | KB | Script ms |
|---|---|---|---|---|---|---|---|
| XOX | 1.888 | 3.072 | 4.293 | 3.054 | 29 | 99 | 223 |
| Career Twin | 1.404 | 1.404 | 3.204 | 2.060 | 21 | 92 | 158 |
| Football Wordle | 1.288 | 1.288 | 3.161 | 2.630 | 13 | 43 | 324 |
| Arcade | 1.344 | 1.344 | 2.573 | 2.595 | 13 | 62 | 248 |
| Futbol Imposter | 648 | 3.288 | 2.645 | 3.379 | 32 | 87 | 281 |
| RE:VERSE | 1.264 | 1.264 | 1.268 | — | 3 | 12 | 48 |
| EN11 | 1.240 | 1.936 | 1.206 | — | 3 | 16 | 63 |
| Nasıl Oynanır | 716 | 716 | 648 | — | 1 | 8 | 57 |

**Yan oyunlar sağlıklı:** hepsi Slow 4G'de 4,3 sn'nin altında açılıyor ve 100 KB'ın altında. Performans sorunu ana sayfaya
özgü. (EN11'in PeerJS bağlantısı engelli; sayfa yüklemesi ölçüldü, çevrim içi akış ölçülmedi.)

## 7. Tespit edilen problemler — durum takibi

Her satır uygulandığında "Sonra" sütunu aynı araçla doldurulacak.

| ID | Problem | Kaynak | Dosya(lar) | Önce (mid soğuk) | Sonra | Durum |
|---|---|---|---|---|---|---|
| PERF-01 | Yükleme örtüsü saydam, eski `#bootScreen` görünüyor | Guard `body::before`, çekirdeğin `mask-image` kuralını miras alıyor (hesaplanmış stil ile doğrulandı) | `index.html` (BOOT_GUARD) | Örtü 5,7–16,7 sn boyunca alta doğru saydam | — | Önerildi |
| PERF-02 | 9 sn'lik "zorla göster" sayaçları hazır olmayan ekranı açığa çıkarabiliyor; giriş yapmış kullanıcıya "kontrol ediliyor" ve yanlış "gecikti" uyarısı | REVEAL_SCRIPT 9 sn, splash 9 sn, giriş katmanı 12 sn sayaçları | `index.html`, `neon-splash-safe-v1.js`, `neon-entry-v1.js` | SDK 12 sn gecikmede: 21 sn "kontrol ediliyor" + yanlış uyarı + 2,1 MB boşa indirme | — | Önerildi |
| PERF-03 | Ana ekran görselleri 3,8 MB PNG | 853×1844 PNG | `home-approved-v1.js` + 2 görsel | Görseller 48,1 sn | — | Önerildi |
| PERF-04 | Yeni kullanıcı giriş görseli 2,16 MB PNG | PNG | `neon-entry-v1.js` + görsel | Giriş butonları 60,5 sn | — | Önerildi |
| PERF-05 | Açılış ve boşta CPU'yu tüketen tam-belge tarayıcıları | Birleştirilmemiş `MutationObserver` + rAF + 700 ms tarama | `online-mobile-navigation-fix-v1.js`, `prematch-mobile-v2.js` (**Draft'a bitişik**) | Açılış CPU'sunun %66+%8'i; boşta %84 | — | **Onay gerekiyor** |
| PERF-06 | Ana ekranda maç stadyumu görseli (2,8 MB) | CSS arka planı DOM'da hazır bekliyor | `match-stadium-user-v3.css` (**maç/Draft**) | 2,8 MB, ana ekran görselleriyle yarışıyor | — | **Onay gerekiyor** |
| PERF-07 | Gizli Draft UI'ının boşta DOM'u değiştirmesi | 150 ms aralık + gövde gözlemcisi | `neon-xi-core.html` (**Draft**) | 10 sn'de ~1.500 mutasyon | — | Kapsam dışı (raporlandı) |
| PERF-08 | Aynı yol için tekrarlanan dinleyiciler | Sosyal modüllerin her biri kendi aboneliğini kuruyor | `social/*` | 20 dinleyici / 8 yol, 8 oturum dinleyicisi | — | Önerildi (mimari adım) |
| PERF-09 | Splash sayacı splash kalktıktan sonra da çalışıyor | `bindAnimation` interval'i temizlenmiyor | `neon-splash-safe-v1.js` | 1 kalıcı 3,2 sn interval | — | Önerildi |
| PERF-10 | Monolitik çekirdek ana ekran için indiriliyor ve çalıştırılıyor | Mimari | `index.html`, `neon-xi-core.html` | 759 KB gzip, Slow 4G'de 5,3 sn indirme, tamamı inmeden ayrıştırma başlamıyor; satır içi script'ler açılışta ~1,5 sn CPU (mid) | — | Uzun vadeli (Draft QA ile) |

## 8. Mobil cihaz etkisi (özet)

- **Orta seviye telefon, Slow 4G, ilk açılış:** 17,5 sn sonra ana ekrana dokunulabiliyor; görseller 48 sn'de tamamlanıyor.
- **Düşük seviye telefon:** etkileşim 23,9 sn.
- **İkinci açılış (önbellekli):** 10,5 sn. Ağ yokken bile neredeyse tamamı CPU süresi.
- **Yeni kullanıcı:** giriş butonları 60,5 sn.
- **Ana ekranda beklerken:** CPU sürekli %100 (4× yavaşlatılmış çekirdekte). Pil ve ısı etkisi beklenir; dokunma gecikmesi
  ölçülen drawer açılışında ~0,5 sn.
- **Bellek** kontrol altında (heap 6–25 MB, artış eğilimi yok). Ama yoğun ayırma ve GC döngüsü var.
