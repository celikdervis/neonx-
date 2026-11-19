# Çok Oyunculu Senaryolar — Her Kullanıcının Ekranında Ne Görüldü

Ortam: mock RTDB. Her kullanıcı ayrı browser context'i ve ayrı uid kullanır. Aşağıdaki gözlemler son kod (FIX-01, FIX-02) içindir
ve her biri en az 10 çalıştırmada (2 tur × 5) aynı sonucu verdi. M-06 hariç.

## İki kullanıcı (A, B)

| Senaryo | A'nın ekranı | B'nin ekranı | Veritabanı |
|---|---|---|---|
| A parti kurar, B'yi davet eder, B kabul eder | "KALICI PARTİ · LİDER", listede @qa_b | "ÜYE", listede @qa_a | `members` = {A, B}, `leaderUid` = A, davet silinmiş |
| B ayrılır | @qa_b listeden kalkıyor | "YENİ PARTİ KUR" | `members` = {A}, B'nin işaretçisi null |
| A (son üye) ayrılır | "YENİ PARTİ KUR" (**düzeltme öncesi: LİDER ekranında takılı kalıyordu**) | — | Parti düğümü ve A'nın işaretçisi silinmiş |
| A (lider) ayrılır, B kalır | "YENİ PARTİ KUR" | "LİDER", @qa_a listede yok | `leaderUid` = B |
| B daveti reddeder | Parti değişmiyor | Davet kartı kayboluyor | Davet silinmiş, B parti dışında |
| A ayrılıp partiyi kapattıktan sonra B eski daveti kabul eder | — | Hata durumu (kırmızı mesaj), davet kayboluyor | Hayalet parti düğümü yok, B parti dışında |
| B sayfayı yeniler | — | Lobi aynen geri geliyor | Değişiklik yok |
| B kopar, süre dolmadan geri gelir | B listede kalıyor | Lobi aynen duruyor | B üye olarak kalıyor |
| B süreden uzun kopuk kalır | @qa_b listeden kalkıyor (A'nın istemcisi temizliyor) | Geri geldiğinde "YENİ PARTİ KUR" | B çıkarılmış, işaretçisi null |
| Lider A süreden uzun kopuk kalır | — | "LİDER" (B'nin istemcisi devralıyor) | `leaderUid` = B |
| 1v1 eşleşme (XOX) | Odaya yönlendiriliyor (host ya da guest) | Aynı oda kodu, karşı rol | Kuyruk kayıtları yönlendirmeden sonra temizleniyor |
| A iptal eder, sonra B arar | Panel "Oyna" sekmesinde açık kalıyor | Beklemede, eşleşme yok | A kuyrukta değil |
| A'nın bağlantısı yavaşken A iptal eder, aynı anda B arar | Hiçbir şey olmuyor | **Odaya yönlendiriliyor, host gelmiyor** (B-03) | A'nın kaydı sonradan siliniyor |

## Üç kullanıcı (A, B, C)

| Senaryo | Sonuç |
|---|---|
| B ve C aynı daveti aynı anda kabul eder | İkisi de üye oluyor; A'nın ekranında ikisi de görünüyor; lider A |
| B'ye iki farklı partiden (A ve D) davet gelir ve ikisi aynı anda kabul edilir | B tam olarak bir partinin üyesi oluyor; işaretçisi o partiyi gösteriyor |
| Imposter: A, B, C arar | Üçü aynı odaya gidiyor; ilk arayan (A) host |
| Imposter: A iptal eder, B ve C arar | **Düzeltme öncesi:** A host olarak gruba dahil ediliyor, B ve C ölü odaya gidiyordu. **Sonra:** B ve C bekliyor; A tekrar arayınca üçü birlikte eşleşiyor |

## Dört kullanıcı (A, B, C, D)

| Senaryo | Sonuç |
|---|---|
| A, B/C/D'yi alır; A ve C aynı anda ayrılır | `members` = {B, D}; lider B ya da D; A ve C'nin işaretçileri null; B ve D'ninki partiyi gösteriyor |
