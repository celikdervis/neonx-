# Blocked Tests

| Test alanı | Neden | Ne gerekir |
|---|---|---|
| Gerçek Firebase davranışı (kurallar, gecikme, gerçek bağlantı kopması algılama süresi) | Canlı Firebase'e bağlanmak ve Emulator kurmak bu çalışmada yasak; ağ da engelli | Ayrı bir staging projesi veya izin verilirse Emulator |
| Güvenlik kuralları / yetkisiz yazma | Kurallar depoda yok; mock'ta kural yok | Firebase Console'dan alınan kurallar + kural test ortamı (ayrı güvenlik aşaması) |
| Gerçek Google OAuth popup'ı | Ağ yok; mock popup kullanılıyor | Gerçek cihazda manuel test |
| Gerçek iOS Safari / WebKit | Ortamda yalnızca Chromium var; bulut konteyneri iPhone'a erişemiyor | Gerçek iPhone'da manuel test veya WebKit kurulu bir ortam |
| EN11 çevrim içi (PeerJS) | `unpkg.com` ve `0.peerjs.com` engelli | PeerJS sunucusuna erişim veya yerel PeerServer (ayrı onay gerekir) |
| Ana sayfa (`index.html`) tam arayüz akışları | BLOCKED değil, **NOT TESTED**: sayfa mock ile açılıyor ve ayrılma API'si test edildi; drawer arayüzü üzerinden tıklamalı testler henüz yazılmadı | Sıradaki tur |
| Performans (gerçek ağ) | Mock yerel ve anında yanıt veriyor; gerçek gecikme ölçülemiyor | Staging ortamı |
