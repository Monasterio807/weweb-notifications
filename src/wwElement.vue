<template>
  <div class="hrk-root hrk-notif">
    <!-- Glocke + Badge -->
    <button
      type="button"
      class="hrk-notif__bell"
      :class="{ 'hrk-notif__bell--active': open }"
      :aria-label="bellLabel"
      :aria-expanded="open ? 'true' : 'false'"
      aria-haspopup="true"
      @click="toggle"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
        <path
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M13.7 21a2 2 0 0 1-3.4 0"
        />
      </svg>
      <span
        v-if="unreadCount > 0"
        class="hrk-notif__badge"
        :aria-hidden="true"
      >{{ badgeText }}</span>
    </button>

    <!-- Dropdown -->
    <div v-if="open" class="hrk-notif__panel" role="dialog" :aria-label="bellLabel">
      <header class="hrk-notif__head">
        <span class="hrk-notif__title">Benachrichtigungen</span>
        <button
          v-if="items.length"
          type="button"
          class="hrk-btn hrk-btn--ghost hrk-notif__markall"
          :disabled="markingAll"
          @click="markAllRead"
        >{{ markingAll ? 'Wird erledigt …' : 'Alle als gelesen markieren' }}</button>
      </header>

      <!-- Laden -->
      <div v-if="loading" class="hrk-state hrk-state--mini">
        <div class="hrk-spinner" aria-hidden="true"></div>
        <p class="hrk-muted">Wird geladen …</p>
      </div>

      <!-- Fehler -->
      <div v-else-if="errorMessage" class="hrk-state hrk-state--mini" role="alert">
        <p class="hrk-state__title">{{ errorMessage }}</p>
        <button class="hrk-btn hrk-btn--secondary" @click="load">Erneut versuchen</button>
      </div>

      <!-- Leer -->
      <div v-else-if="!items.length" class="hrk-notif__empty">
        <div class="hrk-notif__empty-icon" aria-hidden="true">🔔</div>
        <p class="hrk-state__title">Alles erledigt</p>
        <p class="hrk-muted hrk-small">Du hast gerade keine neuen Benachrichtigungen.</p>
      </div>

      <!-- Liste -->
      <ul v-else class="hrk-notif__list">
        <li v-for="n in items" :key="n.id">
          <button
            type="button"
            class="hrk-notif__item"
            :class="{ 'hrk-notif__item--unread': !n.is_read }"
            @click="onItemClick(n)"
          >
            <span class="hrk-notif__icon" aria-hidden="true"><svg
                v-if="isEmilyProaktiv(n.type)"
                class="hrk-icon hrk-icon--emily"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
                stroke-linecap="round" stroke-linejoin="round"
              ><circle cx="12" cy="11" r="8"/><polygon points="6,21 7.5,16.5 11,18.5"/><line x1="9" y1="10.5" x2="9" y2="10.5"/><line x1="15" y1="10.5" x2="15" y2="10.5"/><polyline points="8.5,13.5 10,15 14,15 15.5,13.5"/></svg><template v-else>{{ iconFor(n.type) }}</template></span>
            <span class="hrk-notif__body">
              <span class="hrk-notif__item-title">{{ n.title || 'Benachrichtigung' }}</span>
              <span v-if="n.message" class="hrk-notif__msg">{{ n.message }}</span>
              <span class="hrk-notif__time">{{ relativeTime(n.created_at) }}</span>
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
/**
 * WeWeb Coded Component — Benachrichtigungs-Bell (HRklar)
 * Glocke mit rotem Badge (Anzahl ungelesen, max "9+"), Dropdown mit den
 * neuesten ungelesenen Benachrichtigungen, "als gelesen markieren" (einzeln /
 * alle) und Live-Updates ueber Supabase Realtime.
 *
 * Reines Frontend gegen Supabase. Es wird NIE der service_role-Key verwendet —
 * nur Anon-/Publishable-Key + User-JWT. RLS schuetzt die Daten; die Komponente
 * filtert keine Berechtigungen selbst.
 *
 * Realtime ohne supabase-js: roher Phoenix-WebSocket gegen /realtime/v1/websocket.
 * Faellt der WS aus, laedt die Glocke trotzdem normal (graceful degrade).
 */
export default {
  props: {
    content: { type: Object, required: true },
    uid: { type: String, required: false, default: '' },
    /* wwEditor:start */
    wwEditorState: { type: Object, required: false, default: () => ({}) },
    /* wwEditor:end */
  },
  emits: ['trigger-event'],
  setup(props) {
    // Interne Variable fuer NoCode-User (Badge-Anzahl im WeWeb-Editor nutzbar).
    let setUnreadVar = () => {};
    try {
      if (typeof wwLib !== 'undefined' && wwLib.wwVariable && wwLib.wwVariable.useComponentVariable) {
        const v = wwLib.wwVariable.useComponentVariable({
          uid: props.uid,
          name: 'unreadCount',
          type: 'number',
          defaultValue: 0,
        });
        if (v && typeof v.setValue === 'function') setUnreadVar = v.setValue;
      }
    } catch (e) { /* degrade — Glocke funktioniert auch ohne interne Variable */ }
    return { setUnreadVar };
  },
  data() {
    return {
      open: false,
      loading: false,
      items: [],
      errorMessage: '',
      markingAll: false,
      // Realtime
      ws: null,
      wsRef: 0,
      heartbeatTimer: null,
      reloadTimer: null,
      // Klick-ausserhalb
      docClickHandler: null,
    };
  },
  computed: {
    baseUrl() {
      let url = (this.content && this.content.supabaseUrl) || '';
      if (/nemxnflngcfrpamkuesm/.test(String(url))) url = '';
      return String(url).replace(/\/+$/, '');
    },
    apiKey() {
      // Prop (heisst in ww-config.js "supabaseAnonKey"); Default kommt aus ww-config.js
      return (this.content && this.content.supabaseAnonKey) || '';
    },
    // Token live lesen: zuerst Property, sonst globalContext (WeWeb-Auth), sonst localStorage.
    // Deckt den Prop-Hydration-Race ab und liefert nach einem Session-Refresh den frischen JWT.
    token() {
      const t = ((this.content && this.content.authToken) || '').toString().trim();
      if (t) return t.replace(/^Bearer\s+/i, '');
      try {
        const auth = (typeof wwLib !== 'undefined' && wwLib.globalContext && wwLib.globalContext.auth) ? wwLib.globalContext.auth : null;
        const at = auth && auth.session && auth.session.access_token;
        if (at) return String(at).trim();
      } catch (e) { /* ignore */ }
      try {
        const win = this.frontWindow();
        const ls = win && win.localStorage;
        if (ls) {
          const raw = ls.getItem('sb-ztvqsxdudzdyqgeylujr-auth-token');
          if (raw) {
            const o = JSON.parse(raw);
            const at = (o && o.access_token) || (o && o.currentSession && o.currentSession.access_token);
            if (at) return String(at).trim();
          }
        }
      } catch (e) { /* ignore */ }
      return '';
    },
    authHeaders() {
      return { apikey: this.apiKey, Authorization: `Bearer ${this.token}` };
    },
    maxItems() {
      const n = Number(this.content && this.content.maxItems);
      return isFinite(n) && n > 0 ? Math.floor(n) : 10;
    },
    realtimeEnabled() {
      return !this.content || this.content.realtime !== false;
    },
    resolvedUserId() {
      const fromProp = ((this.content && this.content.userId) || '').toString().trim();
      if (fromProp) return fromProp;
      return this.decodeUserId(this.token);
    },
    unreadCount() {
      return this.items.length;
    },
    badgeText() {
      return this.unreadCount > 9 ? '9+' : String(this.unreadCount);
    },
    bellLabel() {
      if (this.unreadCount > 0) return `Benachrichtigungen — ${this.unreadCount} ungelesen`;
      return 'Benachrichtigungen';
    },
  },
  watch: {
    'content.authToken'() {
      this.restart();
    },
    'content.userId'() {
      this.restart();
    },
    'content.supabaseUrl'() {
      this.restart();
    },
    'content.maxItems'() {
      if (this.resolvedUserId) this.load();
    },
    'content.realtime'() {
      this.restart();
    },
    unreadCount(n) {
      try { this.setUnreadVar(n); } catch (e) { /* ignore */ }
      this.emitEvent('unread-changed', { count: n });
    },
  },
  mounted() {
    this.restart();
  },
  beforeUnmount() {
    this.teardown();
  },
  methods: {
    // ---- fetch mit Timeout (AbortController, 10s) ----
    async fetchWithTimeout(url, options, ms) {
      const timeout = ms || 10000;
      const ac = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const timer = ac ? setTimeout(() => ac.abort(), timeout) : null;
      try {
        return await fetch(url, ac ? Object.assign({}, options, { signal: ac.signal }) : options);
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
    // Bei 401 das Supabase-Token via GoTrue (refresh_token) erneuern — die WeWeb-Session
    // laeuft nach 60 Min ab; ohne Refresh bleibt die Glocke sonst still auf «Sitzung abgelaufen».
    async _refreshAuthToken() {
      try {
        const auth = (typeof wwLib !== 'undefined' && wwLib.globalContext && wwLib.globalContext.auth) ? wwLib.globalContext.auth : null;
        const rt = auth && auth.session && auth.session.refresh_token;
        if (!rt || !this.apiKey) return '';
        const res = await this.fetchWithTimeout(`${this.baseUrl}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST', headers: { apikey: this.apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: rt }),
        });
        if (!res.ok) return '';
        const ns = await res.json();
        if (!ns || !ns.access_token) return '';
        try {
          const win = this.frontWindow();
          const ls = win && win.localStorage;
          const wwSess = { access_token: ns.access_token, token_type: ns.token_type, expires_in: ns.expires_in, expires_at: ns.expires_at, refresh_token: ns.refresh_token };
          if (ls) {
            ls.setItem('ww-auth-session', JSON.stringify(wwSess));
            const ref = ((String(this.baseUrl || '').match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1]) || 'ztvqsxdudzdyqgeylujr';
            const k = `sb-${ref}-auth-token`; const cur = JSON.parse(ls.getItem(k) || '{}');
            ls.setItem(k, JSON.stringify(Object.assign(cur, wwSess, { user: ns.user || cur.user })));
          }
          if (auth && auth.session) Object.assign(auth.session, wwSess);
        } catch (e) { /* Writeback best-effort */ }
        return ns.access_token;
      } catch (e) { return ''; }
    },
    // fetch + bei 401 EINMAL Token erneuern und mit frischem Bearer wiederholen.
    async fetchWithAuthRetry(url, options, ms) {
      let res = await this.fetchWithTimeout(url, options, ms);
      if (res && res.status === 401) {
        const fresh = await this._refreshAuthToken();
        if (fresh) {
          const headers = Object.assign({}, (options && options.headers) || {}, { Authorization: `Bearer ${fresh}` });
          res = await this.fetchWithTimeout(url, Object.assign({}, options || {}, { headers }), ms);
        }
      }
      return res;
    },
    emitEvent(name, payload) {
      this.$emit('trigger-event', { name, event: payload || {} });
    },
    // ---- User-ID aus dem JWT (sub) ableiten ----
    decodeUserId(token) {
      try {
        const part = String(token || '').split('.')[1];
        if (!part) return '';
        const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
        const dec = (typeof atob !== 'undefined') ? atob(b64) : '';
        if (!dec) return '';
        const json = decodeURIComponent(
          dec.split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        );
        const obj = JSON.parse(json);
        return (obj && obj.sub) ? String(obj.sub) : '';
      } catch (e) {
        return '';
      }
    },
    restart() {
      this.teardown();
      if (!this.apiKey || !this.token || !this.resolvedUserId) {
        this.items = [];
        return;
      }
      this.load();
      if (this.realtimeEnabled) this.connectRealtime();
    },
    teardown() {
      this.closeRealtime();
      this.detachOutsideClick();
    },
    // ---- Laden (REST) ----
    async load() {
      const uid = this.resolvedUserId;
      if (!uid) { this.items = []; return; }
      if (!this.apiKey || !this.token) {
        this.errorMessage = 'Bitte melde dich an, damit wir deine Benachrichtigungen laden können.';
        this.emitEvent('error', { reason: 'config' });
        return;
      }
      this.loading = true;
      this.errorMessage = '';
      try {
        const fields = 'id,type,title,message,is_read,action_url,created_at';
        const url = `${this.baseUrl}/rest/v1/user_notifications`
          + `?user_id=eq.${encodeURIComponent(uid)}`
          + `&is_read=eq.false`
          + `&select=${fields}`
          + `&order=created_at.desc`
          + `&limit=${this.maxItems}`;
        const res = await this.fetchWithAuthRetry(url, {
          headers: { ...this.authHeaders, Accept: 'application/json' },
        });
        if (res.status === 401) {
          this.items = [];
          this.errorMessage = 'Sitzung abgelaufen — bitte neu anmelden.';
          this.emitEvent('error', { reason: 'auth' });
          return;
        }
        if (!res.ok) {
          this.errorMessage = 'Benachrichtigungen konnten nicht geladen werden.';
          this.emitEvent('error', { reason: 'http' });
          return;
        }
        const rows = await res.json().catch(() => []);
        this.items = Array.isArray(rows) ? rows : [];
        this.emitEvent('loaded', { count: this.items.length });
      } catch (e) {
        this.errorMessage = 'Netzwerkfehler beim Laden.';
        this.emitEvent('error', { reason: 'network' });
      } finally {
        this.loading = false;
      }
    },
    // ---- Dropdown auf/zu ----
    toggle() {
      this.open = !this.open;
      if (this.open) {
        // Beim Oeffnen frisch laden, falls noch keine Daten / nach Fehler.
        if (this.resolvedUserId && (this.errorMessage || (!this.items.length && !this.loading))) {
          this.load();
        }
        this.$nextTick(() => this.attachOutsideClick());
      } else {
        this.detachOutsideClick();
      }
    },
    close() {
      this.open = false;
      this.detachOutsideClick();
    },
    attachOutsideClick() {
      const doc = this.frontDocument();
      if (!doc || this.docClickHandler) return;
      this.docClickHandler = (ev) => {
        const root = this.$el;
        if (root && ev && ev.target && !root.contains(ev.target)) this.close();
      };
      doc.addEventListener('click', this.docClickHandler, true);
    },
    detachOutsideClick() {
      const doc = this.frontDocument();
      if (doc && this.docClickHandler) doc.removeEventListener('click', this.docClickHandler, true);
      this.docClickHandler = null;
    },
    frontDocument() {
      try {
        if (typeof wwLib !== 'undefined' && wwLib.getFrontDocument) return wwLib.getFrontDocument();
      } catch (e) { /* fallthrough */ }
      return (typeof document !== 'undefined') ? document : null;
    },
    frontWindow() {
      try {
        if (typeof wwLib !== 'undefined' && wwLib.getFrontWindow) return wwLib.getFrontWindow();
      } catch (e) { /* fallthrough */ }
      return (typeof window !== 'undefined') ? window : null;
    },
    // ---- Klick auf Benachrichtigung ----
    async onItemClick(n) {
      if (!n || !n.id) return;
      const actionUrl = n.action_url || '';
      this.emitEvent('notification-clicked', { id: n.id, action_url: actionUrl });
      await this.markRead(n.id);
      if (actionUrl) {
        const win = this.frontWindow();
        if (win && win.location) {
          try { win.location.href = actionUrl; } catch (e) { /* ignore */ }
        }
      } else {
        this.close();
      }
    },
    // ---- Als gelesen markieren (einzeln) ----
    async markRead(id) {
      // Optimistisch aus der Liste nehmen (wir zeigen nur Ungelesene).
      const before = this.items.slice();
      this.items = this.items.filter((x) => x.id !== id);
      try {
        const url = `${this.baseUrl}/rest/v1/user_notifications?id=eq.${encodeURIComponent(id)}`;
        const res = await this.fetchWithAuthRetry(url, {
          method: 'PATCH',
          headers: { ...this.authHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ is_read: true }),
        });
        if (!res.ok && res.status !== 204) {
          this.items = before; // zuruecksetzen bei Fehler
          this.emitEvent('error', { reason: 'mark-read' });
        }
      } catch (e) {
        this.items = before;
        this.emitEvent('error', { reason: 'network' });
      }
    },
    // ---- Alle als gelesen markieren ----
    async markAllRead() {
      const uid = this.resolvedUserId;
      if (!uid || !this.items.length) return;
      const before = this.items.slice();
      this.markingAll = true;
      this.items = [];
      try {
        const url = `${this.baseUrl}/rest/v1/user_notifications`
          + `?user_id=eq.${encodeURIComponent(uid)}&is_read=eq.false`;
        const res = await this.fetchWithAuthRetry(url, {
          method: 'PATCH',
          headers: { ...this.authHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ is_read: true }),
        });
        if (!res.ok && res.status !== 204) {
          this.items = before;
          this.emitEvent('error', { reason: 'mark-all' });
          return;
        }
        this.emitEvent('all-read', {});
        this.close();
      } catch (e) {
        this.items = before;
        this.emitEvent('error', { reason: 'network' });
      } finally {
        this.markingAll = false;
      }
    },
    // ---- Realtime (Phoenix WebSocket) ----
    connectRealtime() {
      try {
        const win = this.frontWindow();
        const WS = win && win.WebSocket ? win.WebSocket : (typeof WebSocket !== 'undefined' ? WebSocket : null);
        if (!WS || !this.apiKey) return;
        const wsBase = this.baseUrl.replace(/^http/i, 'ws');
        const url = `${wsBase}/realtime/v1/websocket?apikey=${encodeURIComponent(this.apiKey)}&vsn=1.0.0`;
        const ws = new WS(url);
        this.ws = ws;
        const topic = 'realtime:public:user_notifications';

        ws.onopen = () => {
          // postgres_changes-Abo mit Filter auf eigene user_id.
          this.wsSend({
            topic,
            event: 'phx_join',
            payload: {
              config: {
                postgres_changes: [
                  { event: '*', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${this.resolvedUserId}` },
                ],
              },
              access_token: this.token,
            },
            ref: String(++this.wsRef),
          });
          // Token separat setzen (RLS-Auth fuer den Channel).
          this.wsSend({ topic, event: 'access_token', payload: { access_token: this.token }, ref: String(++this.wsRef) });
          this.startHeartbeat();
        };

        ws.onmessage = (msg) => {
          let data = null;
          try { data = JSON.parse(msg.data); } catch (e) { return; }
          if (!data) return;
          const ev = data.event;
          if (ev === 'postgres_changes' || ev === 'INSERT' || ev === 'UPDATE' || ev === 'DELETE') {
            this.scheduleReload();
          }
        };

        ws.onerror = () => { /* still degrade — Glocke laedt weiterhin per REST */ };
        ws.onclose = () => { this.stopHeartbeat(); };
      } catch (e) {
        // Realtime ist optional — bei jedem Fehler einfach ohne Live-Updates weiter.
        this.closeRealtime();
      }
    },
    wsSend(obj) {
      try {
        if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
      } catch (e) { /* ignore */ }
    },
    startHeartbeat() {
      this.stopHeartbeat();
      this.heartbeatTimer = setInterval(() => {
        this.wsSend({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++this.wsRef) });
      }, 25000);
    },
    stopHeartbeat() {
      if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    },
    scheduleReload() {
      // Mehrere Events in kurzer Folge zu einem Reload buendeln.
      if (this.reloadTimer) clearTimeout(this.reloadTimer);
      this.reloadTimer = setTimeout(() => { this.load(); }, 400);
    },
    closeRealtime() {
      this.stopHeartbeat();
      if (this.reloadTimer) { clearTimeout(this.reloadTimer); this.reloadTimer = null; }
      try { if (this.ws) this.ws.close(); } catch (e) { /* ignore */ }
      this.ws = null;
    },
    // ---- Darstellung ----
    /** Emily-proaktiv-Notifications erhalten die Emily-Sprechblase (SVG statt Emoji). */
    isEmilyProaktiv(type) {
      return (type || '').toString().toLowerCase() === 'emily_proaktiv';
    },
    iconFor(type) {
      const map = {
        frist: '⏰', deadline: '⏰', erinnerung: '⏰',
        vertrag: '📄', dokument: '📄', zeugnis: '📄',
        warnung: '⚠️', heikel: '⚠️', eskalation: '⚠️',
        erfolg: '✅', freigegeben: '✅', erledigt: '✅',
        emily: '💬', nachricht: '💬',
        info: 'ℹ️',
      };
      return map[(type || '').toString().toLowerCase()] || '🔔';
    },
    relativeTime(value) {
      if (!value) return '';
      let then;
      try { then = new Date(value).getTime(); } catch (e) { return ''; }
      if (!isFinite(then)) return '';
      const diff = Date.now() - then;
      if (diff < 0) return 'gerade eben';
      const min = Math.floor(diff / 60000);
      if (min < 1) return 'gerade eben';
      if (min < 60) return `vor ${min} Min`;
      const std = Math.floor(min / 60);
      if (std < 24) return `vor ${std} Std`;
      const tage = Math.floor(std / 24);
      if (tage < 7) return tage === 1 ? 'vor 1 Tag' : `vor ${tage} Tagen`;
      try { return new Date(value).toLocaleDateString('de-CH'); } catch (e) { return ''; }
    },
  },
};
</script>

<!--
  Styles = einheitliches Design-System. Der folgende Token-Block ist eine 1:1-Kopie von
  WeWeb-Components/Coded-Components-Vorlage/design-tokens.css (Quelle der Wahrheit).
  Die .hrk-notif-* Klassen sind komponenten-eigene Bausteine (Glocke/Dropdown),
  ausschliesslich aus --hrk-* Tokens gebaut — keine harten Farben/Masse.
-->
<style scoped>
/* ============================================================
   HR am Tisch — Design-Tokens (einheitliches App-Design)
   1:1-Kopie aus Coded-Components-Vorlage/design-tokens.css.
   Stand: 2026-06-17 · Variante A.
   ============================================================ */
:root, .hrk-root {
  --hrk-bordeaux:        #7B2D3B;
  --hrk-bordeaux-dark:   #5E2129;
  --hrk-bordeaux-soft:   #F3E7E9;
  --hrk-creme:           #FBF8F3;
  --hrk-anthrazit:       #2B2B2B;
  --hrk-gold:            #C9A24B;
  --hrk-on-primary:      #FFFFFF;  /* Text/Icons auf primaer/kraeftig gefaerbten Flaechen (z.B. Badge) */

  --hrk-surface:         #FFFFFF;
  --hrk-surface-muted:   #F5F1EB;
  --hrk-border:          #ECE5D9;
  --hrk-border-strong:   #DAD2C6;
  --hrk-text:            #2B2B2B;
  --hrk-text-muted:      #6B6357;

  --hrk-success:         #2E7D5B;  --hrk-success-bg: #E5F1EB;
  --hrk-warning:         #B7791F;  --hrk-warning-bg: #FBF1DD;
  --hrk-danger:          #B23A48;  --hrk-danger-bg:  #F8E7E9;
  --hrk-info:            #2F6F9F;  --hrk-info-bg:    #E6F0F7;
  --hrk-neutral:         #6B6357;  --hrk-neutral-bg: #EFEAE2;

  --hrk-font-head: "Fraunces", "Lora", Georgia, serif;
  --hrk-font-body: "Inter", "Source Sans 3", system-ui, sans-serif;
  --hrk-fs-h1: 1.9375rem;
  --hrk-fs-h2: 1.375rem;
  --hrk-fs-h3: 1.125rem;
  --hrk-fs-body: 1.0625rem;
  --hrk-fs-small: 0.9375rem;
  --hrk-lh-body: 1.55;
  --hrk-fw-regular: 400; --hrk-fw-medium: 500; --hrk-fw-semibold: 600;

  --hrk-space-1: 4px;  --hrk-space-2: 8px;  --hrk-space-3: 12px;
  --hrk-space-4: 16px; --hrk-space-5: 24px; --hrk-space-6: 32px;
  --hrk-space-7: 48px;

  --hrk-radius-sm: 8px; --hrk-radius-md: 12px; --hrk-radius-lg: 14px;
  --hrk-radius-pill: 999px;
  --hrk-shadow-card: 0 1px 2px rgba(40,35,30,.05);
  --hrk-shadow-pop:  0 8px 28px rgba(40,35,30,.12);
  --hrk-focus-ring:  0 0 0 3px rgba(123,45,59,.30);

  --hrk-tap-min: 44px;
  --hrk-page-max: 880px;
}

.hrk-root, .hrk-root * { box-sizing: border-box; }
/* Design-Lint-Ausnahme: BEWUSST kein width:100% auf .hrk-root — die Glocke ist ein
   Inline-Widget im Header (.hrk-notif = inline-flex), width:100% wuerde sie strecken. */
.hrk-root {
  font-family: var(--hrk-font-body);
  font-size: var(--hrk-fs-body);
  line-height: var(--hrk-lh-body);
  color: var(--hrk-text);
  -webkit-font-smoothing: antialiased;
}
.hrk-muted { color: var(--hrk-text-muted); }
.hrk-small { font-size: var(--hrk-fs-small); }

/* ---------------- Knoepfe (aus Design-System) ---------------- */
.hrk-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--hrk-space-2);
  min-height: var(--hrk-tap-min); padding: 0 var(--hrk-space-5);
  font: inherit; font-weight: var(--hrk-fw-semibold);
  border-radius: var(--hrk-radius-md); border: 1px solid transparent;
  cursor: pointer; text-decoration: none; transition: background .15s, border-color .15s, transform .05s;
}
.hrk-btn:active { transform: translateY(1px); }
.hrk-btn:focus-visible { outline: none; box-shadow: var(--hrk-focus-ring); }
.hrk-btn--secondary { background: var(--hrk-surface); color: var(--hrk-bordeaux); border-color: var(--hrk-border-strong); }
.hrk-btn--secondary:hover { background: var(--hrk-bordeaux-soft); }
.hrk-btn--ghost     { background: transparent; color: var(--hrk-bordeaux); }
.hrk-btn--ghost:hover { background: var(--hrk-bordeaux-soft); }
.hrk-btn[disabled] { opacity: .5; cursor: not-allowed; }

/* ---------------- Zustaende (aus Design-System) ---------------- */
.hrk-state { display: flex; flex-direction: column; align-items: center; gap: var(--hrk-space-3);
  padding: var(--hrk-space-7) var(--hrk-space-4); color: var(--hrk-text-muted); text-align: center; }
.hrk-state--mini { padding: var(--hrk-space-6) var(--hrk-space-3); }
.hrk-state__title { color: var(--hrk-text); font-weight: var(--hrk-fw-semibold); margin: 0; }
.hrk-spinner { width: 28px; height: 28px; border: 3px solid var(--hrk-border);
  border-top-color: var(--hrk-bordeaux); border-radius: 50%; animation: hrk-spin .8s linear infinite; }
@keyframes hrk-spin { to { transform: rotate(360deg); } }

/* ============================================================
   Komponenten-eigene Bausteine: Glocke + Dropdown (.hrk-notif-*)
   Nur aus --hrk-* Tokens — keine harten Farben/Masse.
   ============================================================ */
.hrk-notif { position: relative; display: inline-flex; }

/* Glocke */
.hrk-notif__bell {
  position: relative;
  display: inline-flex; align-items: center; justify-content: center;
  width: var(--hrk-tap-min); height: var(--hrk-tap-min);
  padding: 0; border: 1px solid transparent; border-radius: var(--hrk-radius-pill);
  background: transparent; color: var(--hrk-anthrazit);
  cursor: pointer; transition: background .15s, color .15s;
}
.hrk-notif__bell:hover { background: var(--hrk-bordeaux-soft); color: var(--hrk-bordeaux); }
.hrk-notif__bell:focus-visible { outline: none; box-shadow: var(--hrk-focus-ring); }
.hrk-notif__bell--active { background: var(--hrk-bordeaux-soft); color: var(--hrk-bordeaux); }

/* Badge */
.hrk-notif__badge {
  position: absolute; top: 4px; right: 4px;
  min-width: 18px; height: 18px; padding: 0 5px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--hrk-danger); color: var(--hrk-on-primary);
  font-size: 11px; font-weight: var(--hrk-fw-semibold); line-height: 1;
  border-radius: var(--hrk-radius-pill); border: 2px solid var(--hrk-surface);
  font-variant-numeric: tabular-nums;
}

/* Dropdown-Panel */
.hrk-notif__panel {
  position: absolute; top: calc(100% + var(--hrk-space-2)); right: 0; z-index: 1000;
  width: 320px; max-width: calc(100vw - var(--hrk-space-5));
  background: var(--hrk-surface);
  border: 1px solid var(--hrk-border); border-radius: var(--hrk-radius-lg);
  box-shadow: var(--hrk-shadow-pop);
  overflow: hidden;
}
.hrk-notif__head {
  display: flex; align-items: center; justify-content: space-between; gap: var(--hrk-space-2);
  padding: var(--hrk-space-3) var(--hrk-space-4);
  border-bottom: 1px solid var(--hrk-border); background: var(--hrk-surface-muted);
}
.hrk-notif__title { font-weight: var(--hrk-fw-semibold); color: var(--hrk-text); }
.hrk-notif__markall {
  min-height: auto; padding: var(--hrk-space-1) var(--hrk-space-2);
  font-size: var(--hrk-fs-small); border-radius: var(--hrk-radius-sm);
}

/* Liste */
.hrk-notif__list { list-style: none; margin: 0; padding: 0; max-height: 400px; overflow-y: auto; }
.hrk-notif__item {
  display: flex; align-items: flex-start; gap: var(--hrk-space-3); width: 100%;
  padding: var(--hrk-space-3) var(--hrk-space-4); text-align: left;
  background: transparent; border: 0; border-bottom: 1px solid var(--hrk-border);
  cursor: pointer; font: inherit; color: var(--hrk-text); transition: background .15s;
}
.hrk-notif__item:hover { background: var(--hrk-surface-muted); }
.hrk-notif__item:focus-visible { outline: none; box-shadow: var(--hrk-focus-ring); }
.hrk-notif__item:last-child { border-bottom: 0; }
.hrk-notif__item--unread { background: var(--hrk-bordeaux-soft); }
.hrk-notif__item--unread:hover { background: var(--hrk-bordeaux-soft); }
.hrk-notif__icon { flex: none; font-size: 1.2rem; line-height: 1.4; }
.hrk-icon { width: var(--hrk-icon-size-md, 20px); height: var(--hrk-icon-size-md, 20px); flex: none; }
.hrk-icon--emily { color: var(--hrk-bordeaux, #7B2D3B); margin-top: 2px; }
.hrk-notif__body { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.hrk-notif__item-title { font-weight: var(--hrk-fw-semibold); }
.hrk-notif__msg {
  color: var(--hrk-text-muted); font-size: var(--hrk-fs-small);
  overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.hrk-notif__time { color: var(--hrk-text-muted); font-size: 0.8125rem; margin-top: 2px; }

/* Leerzustand */
.hrk-notif__empty { text-align: center; color: var(--hrk-text-muted); padding: var(--hrk-space-6) var(--hrk-space-4); }
.hrk-notif__empty-icon { font-size: 1.75rem; line-height: 1; margin-bottom: var(--hrk-space-2); }

/* Handy: Panel etwas breiter, am rechten Rand verankert */
@media (max-width: 600px) {
  .hrk-notif__panel { width: 300px; }
}
</style>
