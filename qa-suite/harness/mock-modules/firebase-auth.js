// NEON XI QA — MOCK of https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js
// Not Firebase. Each Playwright browser context is one independent identity:
// the signed-in user persists in that context's localStorage (the real SDK
// uses IndexedDB), so a reload restores the session and other contexts never
// see it. `window.__NX_MOCK__.google` is the account a Google popup returns.
const CFG = globalThis.__NX_MOCK__ || {};
const KEY = 'nxmock:auth:user';
const S = (globalThis.__NX_MOCK_AUTH__ ||= { auth: null });

const readStored = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
const writeStored = (u) => { try { u ? localStorage.setItem(KEY, JSON.stringify(u)) : localStorage.removeItem(KEY); } catch {} };

function makeUser(data) {
  if (!data) return null;
  return {
    uid: data.uid,
    isAnonymous: !!data.isAnonymous,
    email: data.email ?? null,
    displayName: data.displayName ?? null,
    photoURL: null,
    emailVerified: !data.isAnonymous,
    providerData: data.isAnonymous ? [] : [{ providerId: 'google.com', uid: data.uid, email: data.email ?? null, displayName: data.displayName ?? null }],
    providerId: 'firebase',
    async getIdToken() { return 'mock-token-' + data.uid; },
    toJSON() { return { ...data }; },
  };
}

function authError(code, message) { const e = new Error(`Firebase: ${message} (${code}).`); e.code = code; return e; }

class MockAuth {
  constructor(app) {
    this.app = app;
    this.currentUser = null;
    this._listeners = new Set();
    this._ready = false;
    this.name = app?.name;
    // Real SDK: currentUser is null until persistence has been read.
    this._init = new Promise(resolve => setTimeout(() => {
      this.currentUser = makeUser(readStored());
      this._ready = true;
      resolve();
      this._emit();
    }, Number(CFG.authInitDelayMs ?? 30)));
  }
  _emit() { for (const l of [...this._listeners]) { try { l.next(this.currentUser); } catch (e) { console.error(e); } } }
  _set(data) { writeStored(data); this.currentUser = makeUser(data); this._emit(); return this.currentUser; }
  authStateReady() { return this._init; }
}

export function getAuth(app) { return (S.auth ||= new MockAuth(app)); }
export const initializeAuth = getAuth;

export function onAuthStateChanged(auth, next, error) {
  const l = { next: typeof next === 'function' ? next : (next?.next || (() => {})), error };
  auth._listeners.add(l);
  if (auth._ready) Promise.resolve().then(() => auth._listeners.has(l) && l.next(auth.currentUser));
  return () => auth._listeners.delete(l);
}
export const onIdTokenChanged = onAuthStateChanged;

export async function signInAnonymously(auth) {
  await auth._init;
  if (auth.currentUser?.isAnonymous) return { user: auth.currentUser, providerId: null, operationType: 'signIn' };
  const uid = 'anon_' + (crypto.randomUUID?.() || String(Math.random()).slice(2)).replace(/-/g, '').slice(0, 20);
  return { user: auth._set({ uid, isAnonymous: true }), providerId: null, operationType: 'signIn' };
}

function googleAccount() {
  const g = CFG.google;
  if (!g) throw authError('auth/popup-closed-by-user', 'The popup has been closed by the user before finalizing the operation');
  return { uid: g.uid, isAnonymous: false, email: g.email ?? null, displayName: g.displayName ?? null };
}

export async function signInWithPopup(auth) {
  await auth._init;
  return { user: auth._set(googleAccount()), providerId: 'google.com', operationType: 'signIn' };
}
export const signInWithRedirect = signInWithPopup;

export async function linkWithPopup(user) {
  const auth = S.auth;
  await auth._init;
  if (!user || auth.currentUser?.uid !== user.uid) throw authError('auth/no-current-user', 'No user currently signed in');
  const g = googleAccount();
  if (CFG.googleAlreadyLinked) throw authError('auth/credential-already-in-use', 'This credential is already associated with a different user account');
  const data = { uid: user.uid, isAnonymous: false, email: g.email, displayName: g.displayName };
  writeStored(data);
  auth.currentUser = makeUser(data); // linking keeps the uid and does not fire onAuthStateChanged
  return { user: auth.currentUser, providerId: 'google.com', operationType: 'link' };
}

export async function signOut(auth) { await auth._init; auth._set(null); }

export class GoogleAuthProvider {
  constructor() { this.providerId = 'google.com'; this._scopes = []; this._params = {}; }
  addScope(s) { this._scopes.push(s); return this; }
  setCustomParameters(p) { this._params = { ...p }; return this; }
  static credentialFromResult() { return null; }
  static credentialFromError() { return null; }
}
export const browserLocalPersistence = { type: 'LOCAL' };
export async function setPersistence() {}
