# Security Backlog (bu çalışmaya dahil değil)

Aşama 1 raporunda statik incelemeyle bulunan riskler. Hiçbiri bu çalışmada düzeltilmedi veya canlı ortamda test edilmedi.
Kesin hüküm için canlı RTDB kuralları gerekiyor.

| ID | Risk | Öncelik (aday) | Kanıt |
|---|---|---|---|
| S-01 | Güvenlik kuralları depoda yok (`database.rules.json`, `firebase.json` bulunmuyor) | — (BLOCKED) | Depo taraması |
| S-02 | Maç sonuçlarını istemci kendisi bildiriyor; `recordResult()` farklı `matchId`'lerle tekrar çağrılarak skor tablosu şişirilebilir | P1 | `social/neon-social.js` `recordResult` |
| S-03 | Eşleştirme tüm kuyruk düğümünü tek transaction'da yeniden yazıyor. Bu, her kullanıcıya kuyruğun tamamına yazma izni gerektiriyor ve başkalarının kayıtları değiştirilebilir. 60 sn'lik pencere istemci saatine göre hesaplanıyor | P1 | `startMatch` |
| S-04 | Anonim giriş açık, App Check yok, istek ve davetlerde hız sınırı yok; `acceptFriend` karşı tarafın arkadaş listesine yazıyor | P2 | Kod taraması (`appcheck` 0 eşleşme) |
| P-01 | Her çevrim içi kullanıcı `social/leaderboards/allTime` düğümünün tamamını dinliyor; sorgu limiti yok | P2 (performans) | `bindUser` |
