// Test-Harness mit erfundenen Daten, kein Netz. Szenario per ?s=zwei|eine|keine
import { createApp, ref } from 'vue';
import wwElement from '../src/wwElement.vue';
const s = new URLSearchParams(location.search).get('s') || 'zwei';
const n = (id, title) => ({ id, type: 'emily', title, message: 'Gasthof Quittenhalde (erfunden) hat Emily gebeten, dir eine Frage weiterzuleiten. Du findest sie im Cockpit unter «Expertenfragen».', is_read: false, action_url: '/verwaltung?tab=cockpit', created_at: new Date().toISOString() });
const daten = s === 'keine' ? [] : s === 'eine' ? [n('1', 'Neue Frage an dich')] : [n('1', 'Neue Frage an dich'), n('2', 'Neue Frage an dich')];
window.wwLib = { wwVariable: { useComponentVariable: () => ({ value: ref(0), setValue() {} }) }, getFrontWindow: () => window };
const echt = window.fetch.bind(window);
window.fetch = async (url) => String(url).startsWith('https://example.test') ? new Response(JSON.stringify(daten), { status: 200, headers: { 'Content-Type': 'application/json' } }) : echt(url);
document.body.insertAdjacentHTML('afterbegin', '<header style="display:flex;justify-content:flex-end;padding:12px 16px;border-bottom:1px solid #ECE5D9"><div id="app"></div></header><main style="padding:16px"><p style="color:#6B6357">Seiteninhalt (Platzhalter)</p></main>');
createApp(wwElement, { content: { authToken: 'test-token', userId: 'u-1', supabaseAnonKey: 'test-key', supabaseUrl: 'https://example.test', realtime: false }, uid: 'harness' }).mount('#app');
