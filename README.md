# weweb-notifications — Benachrichtigungs-Glocke (HRklar)

Glocke fuer den Header (neben dem User-Avatar). Zeigt ungelesene Benachrichtigungen
aus der Tabelle `user_notifications`, mit rotem Badge (Anzahl, max «9+»), Dropdown,
«als gelesen markieren» (einzeln / alle) und Live-Updates ueber Supabase Realtime.

Reines Frontend gegen Supabase — **nur** Anon-/Publishable-Key + User-JWT, **nie**
der `service_role`-Key. RLS schuetzt die Daten (SELECT/UPDATE/DELETE nur eigene
Zeilen; INSERT nur service_role).

## Dateien

- `src/wwElement.vue` — Template + Logik + scoped Styles (Design-Tokens inline)
- `ww-config.js` — Editor-Properties + Trigger-Events
- `package.json` — `@weweb/cli`, Build/Serve

## Properties

| Property          | Typ     | Default                                      | Zweck |
|-------------------|---------|----------------------------------------------|-------|
| `supabaseUrl`     | Text    | `https://ztvqsxdudzdyqgeylujr.supabase.co`   | Basis-URL des Projekts |
| `supabaseAnonKey` | Text    | `''`                                         | Anon-/Publishable-Key |
| `authToken`       | Text    | `''`                                         | User-JWT (`Auth['session'].access_token`) |
| `userId`          | Text    | `''`                                         | Optional; sonst aus dem JWT (`sub`) abgeleitet |
| `maxItems`        | Number  | `10`                                         | Wie viele Ungelesene geladen werden |
| `realtime`        | OnOff   | `true`                                       | Live-Updates via Realtime an/aus |

## Trigger-Events

| Event                  | Payload                  | Wann |
|------------------------|--------------------------|------|
| `loaded`               | `{ count }`              | Nach dem Laden der Liste |
| `unread-changed`       | `{ count }`              | Sobald sich die Anzahl ungelesen aendert |
| `notification-clicked` | `{ id, action_url }`     | Klick auf eine Benachrichtigung |
| `all-read`             | `{}`                     | «Alle als gelesen markieren» erfolgreich |
| `error`                | `{ reason }`             | Fehler (config/auth/http/network/mark-read/mark-all) |

Interne Variable fuer NoCode: `unreadCount` (Number).

## Backend

- **Laden:** `GET /rest/v1/user_notifications?user_id=eq.{uid}&is_read=eq.false&order=created_at.desc&limit={maxItems}`
- **Einzeln gelesen:** `PATCH /rest/v1/user_notifications?id=eq.{id}` → `{ is_read: true }`
- **Alle gelesen:** `PATCH /rest/v1/user_notifications?user_id=eq.{uid}&is_read=eq.false` → `{ is_read: true }`
- **Realtime:** Phoenix-WebSocket `wss://<ref>.supabase.co/realtime/v1/websocket?apikey=…&vsn=1.0.0`,
  Channel `realtime:public:user_notifications`, `postgres_changes`-Abo mit Filter `user_id=eq.{uid}`.
  Bei jedem Change wird die Liste (gebuendelt) neu geladen. Faellt der WS aus, laeuft die Glocke
  ohne Live-Updates weiter (REST beim Oeffnen).

`action_url` (falls gesetzt) wird beim Klick angesteuert; sonst schliesst das Dropdown.

## Realtime-Voraussetzung

Damit Live-Updates ankommen, muss `user_notifications` in der Supabase-Publication
`supabase_realtime` sein:

```sql
alter publication supabase_realtime add table public.user_notifications;
```

## Build

```bash
npm install
npm run build -- name=weweb-notifications type=wwobject
```

Erfolg = Exit 0 + `dist/manager.js`. (Die Form `npm run build --name=…` schlaegt still fehl.)

## Test-Checkliste

- [ ] Editor + Production-Build (keine `wwEditor`-Reste crashen).
- [ ] Happy Path: gueltiges JWT → Badge + Liste, `loaded` feuert.
- [ ] Klick auf Eintrag → als gelesen markiert, `notification-clicked`, ggf. Navigation.
- [ ] «Alle als gelesen markieren» → Liste leer, `all-read`.
- [ ] Realtime: neue Zeile (per service_role eingefuegt) erscheint live.
- [ ] Unhappy Path: kein/abgelaufenes JWT → saubere Meldung, `error`.
- [ ] Responsive (375 + 1440); kein ß; keine Secrets/PII im Log.
