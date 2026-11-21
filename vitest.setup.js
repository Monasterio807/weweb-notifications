// =============================================================================
// vitest.setup.js — Workaround fuer Vitest 4 + Node >= 22/26:
// Node bringt ein eigenes globales `localStorage` mit (undefined ohne
// --localstorage-file). Vitests populateGlobal kopiert nur Keys, die NICHT
// schon im Node-Global existieren bzw. in seiner KEYS-Liste stehen —
// `localStorage` steht nicht drin, also gewinnt Nodes undefined-Getter und
// verdeckt das echte jsdom-localStorage. Hier heben wir das jsdom-Storage
// explizit aufs Global (window === globalThis in der jsdom-Umgebung).
// =============================================================================
if (typeof globalThis.jsdom !== 'undefined' && globalThis.jsdom.window) {
  const real = globalThis.jsdom.window.localStorage;
  if (real && typeof globalThis.localStorage === 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => real,
    });
  }
}
