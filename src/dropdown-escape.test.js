// A-016 G2-23: Escape schliesst das Dropdown der Glocke, der Fokus kehrt auf die Glocke zurück.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Komponente from './wwElement.vue';

describe('Dropdown mit Escape', () => {
  beforeEach(() => {
    sessionStorage.clear();
    globalThis.wwLib = { wwVariable: { useComponentVariable: () => ({ value: { value: 0 }, setValue() {} }) }, getFrontWindow: () => window };
    globalThis.fetch = vi.fn(async () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/0' } }));
  });
  const bauen = () => mount(Komponente, { attachTo: document.body, props: { content: { authToken: 't', userId: 'u-1', supabaseAnonKey: 'k', supabaseUrl: 'https://example.test', realtime: false }, uid: 'test' } });

  it('Escape schliesst das offene Dropdown und fokussiert die Glocke', async () => {
    const w = bauen(); await flushPromises();
    await w.find('button.hrk-notif__bell').trigger('click');
    expect(w.find('.hrk-notif__panel').exists()).toBe(true);
    await w.find('.hrk-notif__panel').trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect(w.find('.hrk-notif__panel').exists()).toBe(false);
    expect(document.activeElement).toBe(w.find('button.hrk-notif__bell').element);
    w.unmount();
  });

  it('Escape bei geschlossenem Dropdown tut nichts', async () => {
    const w = bauen(); await flushPromises();
    await w.find('button.hrk-notif__bell').trigger('keydown', { key: 'Escape' });
    expect(w.find('.hrk-notif__panel').exists()).toBe(false);
    w.unmount();
  });
});
