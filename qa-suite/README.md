# NEON XI QA Suite

Release öncesi sosyal / parti / eşleştirme QA çalışmasının test düzeneği ve kayıtları.
**Draft XI, Draft Turnuvası, kimya, taktik ve oyun motoru kapsam dışıdır.** Bu klasördeki
hiçbir test bu modülleri çalıştırmaz.

## Önemli: Bu testler gerçek Firebase'e karşı değil, MOCK'a karşı çalışır

Canlı Firebase'e bağlanmak, Firebase CLI veya Emulator kurmak bu çalışmada yasak. Bu nedenle:

- Sayfaların yüklediği `https://www.gstatic.com/firebasejs/12.16.0/firebase-{app,auth,database}.js`
  modülleri, Playwright tarafından `harness/mock-modules/` altındaki **mock** ile değiştirilir.
  Uygulama kodu değiştirilmez.
- Mock veritabanı (`harness/mock-rtdb-server.mjs`) tek bir bellek içi ağaçtır ve yalnızca 127.0.0.1'de
  çalışır. **Güvenlik kuralı yoktur.** Bu yüzden yetki ve kural testleri bu düzenekte yapılamaz.
- `127.0.0.1` dışındaki her istek iptal edilir ve kaydedilir. Canlı Firebase'e hiçbir istek çıkamaz.
- Mock'un senkron doğrulama davranışı gerçek `firebase@12.16.0` SDK'sı ile karşılaştırılır
  (`tests/mock-conformance.spec.mjs`, 17/17 durum aynı).

Mock'un bilinen farkları: sorgu API'si (`query`, `orderByChild`) yok; transaction'lar her zaman
`applyLocally:false` gibi davranır; bağlantı kopması gerçekteki soket zaman aşımı yerine anında algılanır;
güvenlik kuralı yoktur. Bu yüzden buradaki PASS, **"mock RTDB üzerinde PASS"** anlamına gelir.

## Çalıştırma (depo kökünden)

```bash
npm install                                        # yalnızca @playwright/test
npx playwright test -c qa-suite                    # tüm senaryolar bir kez
npx playwright test -c qa-suite --repeat-each 5    # 5 bağımsız tekrar
npx playwright test -c qa-suite b01                # tek dosya
# Mock-gerçek SDK karşılaştırması (isteğe bağlı, ağ gerektirmez):
FIREBASE_SDK_DIR=<firebase@12.16.0 kurulu klasör> npx playwright test -c qa-suite mock-conformance
```

`FIREBASE_SDK_DIR` verilmezse karşılaştırma testi **skipped** olarak raporlanır, PASS sayılmaz.
Ham çıktılar `qa-suite/.artifacts/` altına yazılır ve git'e eklenmez.

## Kullanıcı modeli

Her kullanıcı (A, B, C, D) ayrı bir Playwright **browser context**'idir: ayrı localStorage,
ayrı oturum ve ayrı uid. Aynı sekmede kullanıcı adı değiştirilerek test yapılmaz.
Ağ kopması, `window.__NX_MOCK_NET__.drop()/restore()` ile yalnızca o kullanıcının sayfasında simüle edilir.

## Bilinen açık test

`M-07` (ve zamanlamaya bağlı olarak `M-06`) şu anda **FAIL** veriyor. Bu açık hata B-03'tür, bkz. `BUG_TRACKER.md`.

## Belgeler

| Dosya | İçerik |
|---|---|
| `TEST_PLAN.md` | Kapsam, ortam, yöntem, öncelikler |
| `TEST_RESULTS.md` | Çalıştırılan testler ve sayılar |
| `BUG_TRACKER.md` | Hatalar (B-xx) ve gözlemler |
| `FIX_LOG.md` | Kod değişiklikleri ve gerekçeleri |
| `REGRESSION_LOG.md` | Düzeltme sonrası regresyon |
| `MULTIPLAYER_SCENARIOS.md` | 2/3/4 kullanıcılı senaryolar ve her ekranda görülen |
| `BLOCKED_TESTS.md` | Ortam nedeniyle yapılamayanlar |
| `SECURITY_BACKLOG.md` | Bu çalışmaya dahil edilmeyen güvenlik riskleri |
