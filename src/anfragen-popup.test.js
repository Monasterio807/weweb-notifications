import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Komponente from './wwElement.vue';
import { zahlAusContentRange, anzahlNeueAnfragen, popupSatz, schonGezeigt, alsGezeigtMerken, sichereUrl, sichereAktionsUrl, POPUP_SCHLUESSEL } from './anfragen-popup.js';

const FRAGE = (id, gelesen = false) => ({ id, type: 'emily', title: 'Neue Frage an dich', message: 'Erfundener Betrieb hat Emily gebeten, dir eine Frage weiterzuleiten.', is_read: gelesen, action_url: '/verwaltung?tab=cockpit', created_at: '2026-11-21T08:00:00Z' });
const ANDERE = { id: 'x', type: 'system', title: 'Willkommen', message: 'Hallo', is_read: false, action_url: '', created_at: '2026-11-21T07:00:00Z' };

describe('Logik', () => {
  it('zählt nur ungelesene «Neue Frage an dich»', () => {
    expect(anzahlNeueAnfragen([FRAGE('a'), FRAGE('b', true), ANDERE])).toBe(1);
    expect(anzahlNeueAnfragen([])).toBe(0);
    expect(anzahlNeueAnfragen(null)).toBe(0);
  });
  it('Sätze', () => {
    expect(popupSatz(0)).toBe('');
    expect(popupSatz(1)).toBe('1 Frage wartet auf dich.');
    expect(popupSatz(3)).toBe('3 Fragen warten auf dich.');
  });
  it('merkt sich je Sitzung und übersteht fehlenden Speicher', () => {
    const m = new Map();
    const sp = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
    expect(schonGezeigt(sp)).toBe(false);
    alsGezeigtMerken(sp);
    expect(schonGezeigt(sp)).toBe(true);
    expect(m.get(POPUP_SCHLUESSEL)).toBe('1');
    const kaputt = { getItem() { throw new Error('gesperrt'); }, setItem() { throw new Error('gesperrt'); } };
    expect(schonGezeigt(kaputt)).toBe(false);
    expect(() => alsGezeigtMerken(kaputt)).not.toThrow();
    expect(schonGezeigt(null)).toBe(false);
  });
  it('lässt nur eigene Adressen zu', () => {
    expect(sichereUrl('/verwaltung?tab=anfragen')).toBe('/verwaltung?tab=anfragen');
    expect(sichereUrl('https://fremd.example/x')).toBe('/verwaltung?tab=anfragen');
    expect(sichereUrl('//fremd.example')).toBe('/verwaltung?tab=anfragen');
    expect(sichereUrl('/\\fremd.example')).toBe('/verwaltung?tab=anfragen');
    expect(sichereUrl('javascript:alert(1)')).toBe('/verwaltung?tab=anfragen');
    expect(sichereUrl('')).toBe('/verwaltung?tab=anfragen');
  });
});

describe('Komponente', () => {
  let zeilen;
  beforeEach(() => {
    zeilen = [FRAGE('a'), FRAGE('b'), ANDERE];
    sessionStorage.clear();
    globalThis.wwLib = { wwVariable: { useComponentVariable: () => ({ value: { value: 0 }, setValue() {} }) }, getFrontWindow: () => window };
    globalThis.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (/select=id(&|$)/.test(u)) {
        const n = zeilen.filter((z) => z.title === 'Neue Frage an dich' && z.is_read !== true).length;
        return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Range': `0-0/${n}` } });
      }
      return new Response(JSON.stringify(zeilen), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
  });
  const bauen = () => mount(Komponente, { props: { content: { authToken: 'test-token', userId: 'u-1', supabaseAnonKey: 'test-key', supabaseUrl: 'https://example.test', realtime: false, anfragenUrl: '/verwaltung?tab=anfragen' }, uid: 'test' } });

  it('zeigt das Pop-up einmal und nennt die Zahl', async () => {
    const w = bauen(); await flushPromises();
    const dlg = w.find('[role="dialog"][aria-modal="true"]');
    expect(dlg.exists()).toBe(true);
    expect(dlg.text()).toContain('2 Fragen warten auf dich.');
    expect(sessionStorage.getItem(POPUP_SCHLUESSEL)).toBe('1');
    await w.find('button.hrk-notif__textbtn--leise').trigger('click');
    expect(w.find('[aria-modal="true"]').exists()).toBe(false);
    w.unmount();
    // zweiter Aufruf in derselben Sitzung: kein Pop-up
    const w2 = bauen(); await flushPromises();
    expect(w2.find('[aria-modal="true"]').exists()).toBe(false);
    w2.unmount();
  });
  it('zählt über eine eigene Abfrage, auch wenn die Glocke die Fragen nicht lädt', async () => {
    // Die Glocke lädt nur 10 neueste Zeilen (lauter andere), die 12 Fragen liegen weiter hinten.
    const viele = Array.from({ length: 12 }, (_, i) => FRAGE('q' + i));
    zeilen = viele;
    const orig = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url, opt) => {
      const u = String(url);
      if (u.includes('limit=10')) return new Response(JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ ...ANDERE, id: 'x' + i }))), { status: 200, headers: { 'Content-Type': 'application/json' } });
      return orig(url, opt);
    });
    const w = bauen(); await flushPromises();
    const dlg = w.find('[role="dialog"][aria-modal="true"]');
    expect(dlg.exists()).toBe(true);
    expect(dlg.text()).toContain('12 Fragen warten auf dich.');
    const zaehl = globalThis.fetch.mock.calls.map((c) => String(c[0])).find((u) => /select=id(&|$)/.test(u));
    expect(zaehl).toContain('is_read=eq.false');
    expect(zaehl).toContain(encodeURIComponent('Neue Frage an dich'));
    const hdr = globalThis.fetch.mock.calls.find((c) => /select=id(&|$)/.test(String(c[0])))[1].headers;
    expect(hdr.Prefer).toBe('count=exact');
    expect((globalThis.fetch.mock.calls.find((c) => /select=id(&|$)/.test(String(c[0])))[1].method || 'GET')).toBe('GET');
    w.unmount();
  });
  it('liest die Zahl aus Content-Range', () => {
    expect(zahlAusContentRange('0-0/12')).toBe(12);
    expect(zahlAusContentRange('*/0')).toBe(0);
    expect(zahlAusContentRange('0-0/*')).toBe(0);
    expect(zahlAusContentRange(null)).toBe(0);
  });
  it('zeigt kein Pop-up ohne neue Fragen', async () => {
    zeilen = [ANDERE];
    const w = bauen(); await flushPromises();
    expect(w.find('[aria-modal="true"]').exists()).toBe(false);
    expect(sessionStorage.getItem(POPUP_SCHLUESSEL)).toBe(null);
    w.unmount();
  });
  it('Escape schliesst, Fokus startet auf «Ansehen»', async () => {
    const w = mount(Komponente, { attachTo: document.body, props: { content: { authToken: 't', userId: 'u-1', supabaseAnonKey: 'k', supabaseUrl: 'https://example.test', realtime: false }, uid: 'test' } });
    await flushPromises(); await w.vm.$nextTick();
    expect(document.activeElement.textContent).toBe('Ansehen');
    await w.find('[role="dialog"][aria-modal="true"]').trigger('keydown', { key: 'Escape' });
    expect(w.find('[aria-modal="true"]').exists()).toBe(false);
    w.unmount();
  });
  it('Nach dem Schliessen geht der Fokus zurück auf die Glocke', async () => {
    const w = mount(Komponente, { attachTo: document.body, props: { content: { authToken: 't', userId: 'u-1', supabaseAnonKey: 'k', supabaseUrl: 'https://example.test', realtime: false }, uid: 'test' } });
    await flushPromises(); await w.vm.$nextTick();
    expect(document.activeElement.textContent).toBe('Ansehen');
    await w.find('button.hrk-notif__textbtn--leise').trigger('click');
    await w.vm.$nextTick();
    expect(document.activeElement).toBe(w.find('button.hrk-notif__bell').element);
    w.unmount();
  });
  it('Der Hintergrund des Pop-ups nutzt ein Token statt einer harten Farbe', () => {
    const quelle = readFileSync('src/wwElement.vue', 'utf8');
    expect(quelle).not.toMatch(/rgba\(43,\s*43,\s*43/);
    expect(quelle).toMatch(/\.hrk-notif__scrim[^}]*var\(--hrk-overlay\)/);
  });
  it('«Ansehen» sendet das Ereignis mit der eigenen Adresse', async () => {
    const w = bauen(); await flushPromises();
    await w.find('button.hrk-notif__textbtn:not(.hrk-notif__textbtn--leise)').trigger('click');
    const e = w.emitted('trigger-event') || [];
    const klick = e.map((x) => x[0]).find((x) => x && x.name === 'popup-clicked');
    expect(klick.event.url).toBe('/verwaltung?tab=anfragen');
    w.unmount();
  });
});

describe('Klick auf Benachrichtigung (G2-22)', () => {
  it('sichereAktionsUrl lässt nur eigene Adressen durch', () => {
    const o = 'https://app.example.test';
    expect(sichereAktionsUrl('/emily?expertenfrage=1', o)).toBe('/emily?expertenfrage=1');
    expect(sichereAktionsUrl('https://app.example.test/abo', o)).toBe('https://app.example.test/abo');
    expect(sichereAktionsUrl('javascript:alert(1)', o)).toBe('');
    expect(sichereAktionsUrl('data:text/html,x', o)).toBe('');
    expect(sichereAktionsUrl('//fremd.example', o)).toBe('');
    expect(sichereAktionsUrl('/\\fremd.example', o)).toBe('');
    expect(sichereAktionsUrl('https://fremd.example/x', o)).toBe('');
    expect(sichereAktionsUrl('http://app.example.test/abo', o)).toBe('');
    expect(sichereAktionsUrl('', o)).toBe('');
    expect(sichereAktionsUrl(null, o)).toBe('');
  });
  const ZEILE = { id: 'n1', type: 'info', title: 'Titel', message: 'Text', is_read: false, created_at: '2026-11-24T08:00:00Z' };
  const mitUrl = async (aktion) => {
    sessionStorage.setItem(POPUP_SCHLUESSEL, '1');
    const fenster = { location: { href: 'AUSGANG', origin: 'https://app.example.test' }, sessionStorage };
    globalThis.wwLib = { wwVariable: { useComponentVariable: () => ({ value: { value: 0 }, setValue() {} }) }, getFrontWindow: () => fenster };
    globalThis.fetch = vi.fn(async (url, opt) => {
      if (opt && opt.method === 'PATCH') return new Response('[]', { status: 200 });
      return new Response(JSON.stringify([{ ...ZEILE, action_url: aktion }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const w = mount(Komponente, { props: { content: { authToken: 'test-token', userId: 'u-1', supabaseAnonKey: 'test-key', supabaseUrl: 'https://example.test', realtime: false }, uid: 'test' } });
    await flushPromises();
    await w.vm.onItemClick({ ...ZEILE, action_url: aktion });
    await flushPromises();
    w.unmount();
    return fenster.location.href;
  };
  it('öffnet eine javascript:-Adresse nicht', async () => {
    expect(await mitUrl('javascript:alert(1)')).toBe('AUSGANG');
  });
  it('öffnet eine fremde Adresse nicht', async () => {
    expect(await mitUrl('https://fremd.example/x')).toBe('AUSGANG');
  });
  it('öffnet eine eigene Adresse weiterhin', async () => {
    expect(await mitUrl('/emily?expertenfrage=1')).toBe('/emily?expertenfrage=1');
  });
});
