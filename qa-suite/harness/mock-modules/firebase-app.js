// NEON XI QA — MOCK of https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js
// Served by Playwright in place of the real SDK. Not Firebase.
const S = (globalThis.__NX_MOCK_APP__ ||= { apps: new Map() });

export function initializeApp(options = {}, name = '[DEFAULT]') {
  if (typeof name === 'object') name = name?.name || '[DEFAULT]';
  if (S.apps.has(name)) {
    const err = new Error(`Firebase: Firebase App named '${name}' already exists with different options or config (app/duplicate-app).`);
    err.code = 'app/duplicate-app';
    throw err;
  }
  const app = { name, options: { ...options }, automaticDataCollectionEnabled: false, __mock: true };
  S.apps.set(name, app);
  return app;
}
export function getApp(name = '[DEFAULT]') {
  const app = S.apps.get(name);
  if (!app) {
    const err = new Error(`Firebase: No Firebase App '${name}' has been created - call initializeApp() first (app/no-app).`);
    err.code = 'app/no-app';
    throw err;
  }
  return app;
}
export function getApps() { return [...S.apps.values()]; }
export async function deleteApp(app) { S.apps.delete(app?.name); }
export const SDK_VERSION = '12.16.0-neonxi-qa-mock';
