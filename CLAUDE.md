# CLAUDE.md — WeWeb Coded Components (HRklar)

Diese Datei steuert, wie Claude (oder eine andere KI) eine **WeWeb Custom Coded Component** fuer
**HRklar** baut oder aendert. Sie gehoert in den **Root jedes Komponenten-Repos** (neben `package.json`,
`ww-config.js`, `src/wwElement.vue`). Vor jeder Komponenten-Arbeit zuerst diese Datei lesen und exakt befolgen.

> Sprache im Tool & in jeder sichtbaren UI: **Schweizer Hochdeutsch** — normale Umlaute (ae/oe/ue als ä/ö/ü),
> **kein scharfes s (ß)**. Ton: **Du-Form**, menschlich, vertrauenswuerdig — nie wie ein «KI-Chatbot».

---

## 0. Das Wichtigste in 30 Sekunden

- Eine Komponente = ein eigenes Repo mit **genau** dieser Struktur: `package.json`, `ww-config.js`,
  `src/wwElement.vue`, `README.md`, `.gitignore`.
- **Reines Frontend** gegen ein fertiges, verifiziertes Supabase-Backend. Die Komponente rechnet keine
  HR-/Rechtslogik selbst — sie ruft Edge Functions auf und zeigt Resultate an.
- Auth **immer** mit **Anon-/Publishable-Key + User-JWT**. **NIE** der `service_role`-Key im Frontend.
- Alle Konfigwerte kommen aus `ww-config.js`-Properties und werden im Code ueber `props.content.<name>`
  gelesen — **keine** hartcodierten Fall-IDs, Tokens oder Texte, die der Kunde sehen koennte.
- Build-Workflow: **Code → GitHub → Import in WeWeb** (Details in `WeWeb_CodedComponents_Setup_und_Import.md`).
- **Aussehen & Gefuehl:** Es gibt **ein** einheitliches Design-System fuer alle Components — `DESIGN-SYSTEM.md`
  + `design-tokens.css` (in `WeWeb-Components/Coded-Components-Vorlage/`). Neue Components bauen direkt darauf
  auf: `--hrk-*`-Tokens und `.hrk-*`-Klassen statt hartcodierter Farben/Abstaende; die 3 bestehenden werden
  nach Richards Freigabe angeglichen. Mehr in §5 und §12.

---

## 1. HRklar — Projektkontext

HRklar ist ein digitales HR-Tool fuer Schweizer KMU (Start: Gastronomie, **L-GAV**). Stack: **WeWeb** (Frontend)
+ **Supabase** (Postgres, RLS, Auth, Storage, Edge Functions). Kernfunktion ist **«Emily — HR-Assistentin»**.
Corina Seltenreich ist HR-Expertin (Inhalt/Recht), Richard ist Owner/Entwickler.

Services (jeweils eigene Wizards/Komponenten, Backend bereits ACTIVE): Vertrag, Arbeitszeugnis, Kuendigung,
Krankmeldung, Unfallmeldung, Verwarnung, Ferien & Ueberstunden, Lohnblatt, Quellensteuer, Onboarding,
Personaldossier (Vollservice), Emily-Chat, Service-Limits.

Grundsatz fuer Recht & Zahlen: **nichts erfinden.** Fristen, Tarife, Mindestloehne etc. kommen aus dem Backend
bzw. aus von Corina gepruegten Daten. Heikle Faelle werden **erkannt und an Corina eskaliert**, nicht
automatisch «entschieden».

---

## 2. Repo-Struktur einer Komponente

```
<repo-root>/
├── CLAUDE.md            # diese Datei
├── README.md           # Kurz-Doku: Dateien, Import, Properties, Events, Sicherheit, Test-Checkliste
├── .gitignore          # node_modules, dist, .DS_Store …
├── package.json        # @weweb/cli, scripts build/serve
├── ww-config.js        # Editor-Properties + triggerEvents
└── src/
    └── wwElement.vue   # Template + <script> + scoped SCSS
```

Eine Komponente bleibt **single-file im `src/wwElement.vue`** (Template, Script, Style zusammen), solange es
nicht zwingend mehr braucht.

---

## 3. Dev-Commands

```bash
npm i                         # Abhaengigkeiten installieren
npm run serve                 # lokal serven, dann im WeWeb-Editor (Dev-Popup) als Custom Element einbinden
npm run build --name=<slug>   # Release-Build; vor dem Release auf Build-Fehler pruefen
```

`package.json` (Vorlage):

```json
{
  "name": "weweb-<slug>",
  "version": "1.0.0",
  "description": "WeWeb Coded Component – <Zweck> (HR-XX, HRklar)",
  "private": true,
  "scripts": { "build": "weweb build", "serve": "weweb serve" },
  "devDependencies": { "@weweb/cli": "latest" },
  "license": "UNLICENSED"
}
```

- `name` ist `weweb-<slug>`, klein, mit Bindestrichen, **ohne** Leer- oder Sonderzeichen.
- Keine zusaetzlichen Build-Configs (kein eigenes webpack/vite/babel). Der WeWeb-CLI uebernimmt den Build.

---

## 4. `ww-config.js` — Konventionen

- `editor.label` immer zweisprachig: `{ en: '…', de: '…' }`; passendes `icon` setzen.
- **`triggerEvents`** fuer WeWeb-Workflows definieren (mind. `loaded`, `error`; je nach Fall `notfound`,
  `regenerated`, `saved` …). Jedes Event mit `label.{en,de}` und einem `event`-Payload-Schema.
- **Properties**: jede mit `label.{en,de}`, `type`, `section: 'settings'`, sinnvollem `defaultValue` und
  `bindable: true`, wenn sie an WeWeb-Variablen gebunden werden soll.
- Editor-only Hilfen (`bindingValidation`, `tooltip`) **immer** in `/* wwEditor:start */ … /* wwEditor:end */`
  einkapseln (wird im Production-Build entfernt).

**Standard-Property-Set (jede datengetriebene HRklar-Komponente):**

| Property      | Typ   | Zweck |
|---------------|-------|-------|
| `caseId`      | Text  | UUID des Falls; leer → Fallback aus URL `?id=…`. Empfehlung: an `{{ url.id }}` binden. |
| `authToken`   | Text  | Access Token des eingeloggten Users (Supabase Auth). Bearer wird im Code ergaenzt. |
| `apiKey`      | Text  | Oeffentlicher **Anon-/Publishable-Key**. **NIE** `service_role`. |
| `supabaseUrl` | Text  | Default `https://ztvqsxdudzdyqgeylujr.supabase.co`. |
| `backUrl`     | Text  | optionaler «Zurueck»-Link. |

---

## 5. `src/wwElement.vue` — Konventionen

- Props exakt so: `content: { type: Object, required: true }`, `uid`, und editor-only `wwEditorState`
  (in `wwEditor:start/end` gekapselt). `emits: ['trigger-event']`.
- WeWeb-Events feuern via `this.$emit('trigger-event', { name: '<eventName>', event: { … } })` —
  Event-Namen identisch zu `ww-config.js`.
- `baseUrl`-Pattern (trailing slashes entfernen, Default-URL):

  ```js
  baseUrl() {
    const url = (this.content && this.content.supabaseUrl) || 'https://ztvqsxdudzdyqgeylujr.supabase.co';
    return String(url).replace(/\/+$/, '');
  }
  ```

- `caseId` zuerst aus der Property, sonst Fallback aus `?id=` der URL (ueber `window.location.search`,
  **safe** gekapselt, siehe §6).
- Klare UI-Zustaende: **loading**, **error / nicht gefunden / keine Berechtigung**, **leer**, **Inhalt**.
  Status-spezifische Hinweise (z.B. `heikler_fall`, `wartet_corina`) freundlich anzeigen.
- Scoped SCSS im selben File, **mobile-first**.
- **Design-System (einheitlich):** Inhalt von `design-tokens.css` (aus `Coded-Components-Vorlage/`) zuoberst in den
  `<style>`-Block kopieren; aeusserste Huelle `class="hrk-root"`, Inhalt `class="hrk-page"`. **Nur** `--hrk-*`-Tokens
  und `.hrk-*`-Bausteine (`.hrk-btn`, `.hrk-card`, `.hrk-field`, `.hrk-badge--*`, `.hrk-stepper` …) verwenden —
  nie Farben/Groessen hart eintippen. Genau **ein** `.hrk-btn--primary` pro Seite. Volle Referenz: `DESIGN-SYSTEM.md`.

---

## 6. ABSOLUT KRITISCHE technische Regeln (WeWeb)

Diese Regeln sind **verpflichtend** — Verstoesse brechen den Editor oder den Production-Build.

1. **Editor-Code kapseln:** jeglicher nur-im-Editor-Code in `/* wwEditor:start */ … /* wwEditor:end */`.
   WeWeb entfernt diese Bloecke im Production-Build.
2. **Kein direkter `document`/`window`-Zugriff.** Immer defensiv kapseln:
   ```js
   const search = (typeof window !== 'undefined' && window.location && window.location.search) || '';
   ```
   Optional Chaining + Defaults ueberall (`props.content?.x ?? fallback`).
3. **Root-Element nie hart dimensionieren.** Keine fixen `width`/`height` auf dem Wurzel-Element —
   die Groesse steuert WeWeb. Innen mit `%`, `flex`, `grid` arbeiten.
4. **Volle Reaktivitaet:** ALLE genutzten `props.content.*` muessen reaktiv sein. Werte, die eine
   Re-Initialisierung ausloesen, explizit `watch`en (kein Lesen «einmal im mounted»).
5. **Array-Properties / Dropzones:** Array-Inhalte korrekt als (ggf. `hidden`) Array-Property anlegen;
   Dropzones nach WeWeb-Standard konfigurieren. Bindable-Properties mit `bindable: true`.
6. **Select/Input** brauchen einen `initialValue`, an den gebunden wird (sonst leerer/instabiler State).
7. **TextSelect**: verschachtelte `options`-Struktur nach WeWeb-Format verwenden.
8. **Keine Browser-Storage-Hacks** als Datenhaltung — State in Vue (`data`/`computed`) halten.
9. **Keine Secrets im Code.** Keys/Tokens ausschliesslich ueber Properties (§4).

---

## 7. Backend-Anbindung (HRklar / Supabase)

- **Projekt-URL:** `https://ztvqsxdudzdyqgeylujr.supabase.co`
- **Edge Function:** `POST {supabaseUrl}/functions/v1/<slug>`
- **REST/Tabellen:** `{supabaseUrl}/rest/v1/<table>?…` (PostgREST; RLS greift automatisch)

**Header-Pattern (immer):**

```js
const res = await fetch(`${this.baseUrl}/functions/v1/<slug>`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': this.content.apiKey,                       // Anon-/Publishable-Key
    'Authorization': `Bearer ${this.content.authToken}`, // User-JWT (Login)
  },
  body: JSON.stringify({ /* flacher Payload, exakt nach Backend-Anleitung */ }),
});
```

**Edge Functions (ACTIVE) — Auswahl nach Service:**

| Slug | Zweck | JWT noetig* |
|------|-------|-------------|
| `onboarding-start` (v3) | Mitarbeiter + Vertrag in einem Aufruf anlegen | ja |
| `fill-contract-pdf` | Arbeitsvertrag-PDF erzeugen/fuellen | ja |
| `fill-kuendigung-pdf` | Kuendigungsschreiben-PDF | ja |
| `fill-krankmeldung-pdf` | Krankmeldung (KTG) PDF | ja |
| `fill-unfallmeldung-pdf` | Unfallmeldung (UVG) PDF | ja |
| `fill-verwarnung-pdf` | Verwarnung PDF | ja |
| `fill-ferien-uebersicht-pdf` | Ferien-/Ueberstunden-Uebersicht PDF | ja |
| `fill-lohnblatt-pdf` | Lohnblatt PDF | ja |
| `generate-zeugnis` / `render-zeugnis-pdf` / `generate-leitsatz` | Arbeitszeugnis erstellen/rendern | ja / ja / nein* |
| `compute-quellensteuer` | QSt-Satz nach ESTV-Tarif (Kanton AG 2026) | ja |
| `save-to-dossier` | Resultat ins Personaldossier ablegen | ja |
| `emily-chat` | Emily HR-Assistentin (Chat) | nein* |
| `check-limit` / `increment-usage` | Abo-Limits pruefen/zaehlen (HR-67) | ja |

\* «nein» heisst nur, dass `verify_jwt` am Gateway aus ist (Funktion prueft selbst bzw. ist bewusst offen) —
der `apikey`-Header wird trotzdem gesendet. Im Zweifel die jeweilige `WeWeb_<Service>_Anleitung.md` lesen,
die den exakten Payload, die Felder und das Fehler-Handling dokumentiert.

**Case-Tabellen (alle RLS-geschuetzt, Owner + Admin):** `contract_cases`, `kuendigung_cases`,
`krankmeldung_cases`, `unfallmeldung_cases`, `verwarnung_cases`, `ferien_ueberstunden_cases`,
`lohnblatt_cases`, `service_cases`, sowie `employees`, `company_profiles`, `company_signatories`,
`user_roles`, `user_plans`, `qst_tarife`, `emily_knowledge`, `subscription_limits`, `monthly_usage`.

---

## 8. Sicherheit (nicht verhandelbar)

- Im Frontend **nur** Anon-/Publishable-Key + User-JWT. `service_role` existiert hier nicht.
- Auf RLS verlassen: Ein User sieht/aendert nur eigene Faelle; Admin (Corina) sieht alles. Die Komponente
  filtert **nicht** selbst Berechtigungen — sie behandelt nur die Faelle, die das Backend zurueckgibt.
- 403/leere Antwort → freundliche «nicht gefunden / keine Berechtigung»-Ansicht, **kein** Stacktrace.
- Keine Tokens, IDs, Keys oder Personendaten ins Log/Console im Production-Build.

---

## 9. UI-Texte & Ton

- **Schweizer Hochdeutsch**, ä/ö/ü, **kein ß**. **Du-Form**, warm und klar.
- Beispiele: «Vertrag wird geladen …», «Erneut versuchen», «PDF herunterladen»,
  «Dieser Vertrag liegt bei Corina zur Pruefung. Du wirst informiert, sobald er freigegeben ist.»
- Fehlertexte erklaeren, was zu tun ist — nie technisch/anklagend.
- Emily klingt menschlich und hilfsbereit, nie wie ein «KI-Chatbot».
- Design/Look an den HRklar-Designplaenen ausrichten (`Design_Plan_HRklar_v2.md`, `Design_Plan_HRklar_Modern.md`).

---

## 10. Test-Checkliste (vor «fertig»)

- [ ] Laeuft im **WeWeb-Editor** (Dev-Popup) **und** im **Production-Build** (`wwEditor`-Bloecke entfernt → kein Crash).
- [ ] **Happy Path:** gueltige `caseId` + JWT → Inhalt korrekt, `loaded`-Event feuert.
- [ ] **Unhappy Path:** fehlende/falsche `caseId`, fehlendes JWT, 403 → saubere Fehleransicht, `error`/`notfound`-Event.
- [ ] **Reaktiv:** Property-Aenderung im Editor aktualisiert die Komponente ohne Reload.
- [ ] **Responsive:** sieht auf Mobile und Desktop gut aus; Root-Groesse nicht hartcodiert.
- [ ] Keine Secrets/PII in Console/Network-Logs.
- [ ] Alle sichtbaren Texte in Schweizer Hochdeutsch, kein ß.

---

## 11. Haeufige Fehler & Loesungen

- **Komponente leer/grau im Editor:** meist fehlende Reaktivitaet oder Root hart dimensioniert → §6.3/§6.4.
- **Funktioniert im Editor, bricht in Produktion:** Editor-Code nicht gekapselt → alles Editor-only in
  `wwEditor:start/end` (§6.1).
- **`window is not defined` / Crash beim Import:** direkter `window`/`document`-Zugriff → defensiv kapseln (§6.2).
- **401/403 vom Backend:** falscher Key (service_role statt anon) oder fehlendes/abgelaufenes JWT → §4/§7.
- **Select bleibt leer:** kein `initialValue` gebunden → §6.6.
- **Payload abgelehnt:** Body weicht von der Service-Anleitung ab (z.B. verschachtelt statt flach) → exakte
  `WeWeb_<Service>_Anleitung.md` befolgen.

---

## 12. Referenzen (im HRklar-Workspace)

- **Setup & Import:** `WeWeb_CodedComponents_Setup_und_Import.md`
- **WeWeb-Skill-Referenz:** `weweb-skill.md` (Editor, Bindings, Workflows, Sicherheit, Abschnitt 16 = Coded Components)
- **Beispiel-Komponenten:** `Vertrag/coded-component-vertrag-anzeigen/`,
  `Kundenbereich/coded-component-meine-faelle/`, `MeinBetrieb/coded-component-mein-betrieb/`
- **Service-Backend-Anleitungen:** `WeWeb_<Service>_Anleitung.md` (exakter Payload je Edge Function)
- **Design-System (App-Innenseiten):** `Coded-Components-Vorlage/DESIGN-SYSTEM.md` + `design-tokens.css`
  (Farben, Schrift, Abstaende, fertige `.hrk-*`-Bausteine, Status-Mapping) — Quelle der Wahrheit fuers Aussehen der Components.
- **Design (Marke/Startseite):** `Design_Plan_HRklar_v2.md`, `Design_Plan_HRklar_Modern.md`

> Diese CLAUDE.md beschreibt **Konventionen & Regeln**. Den konkreten Backend-Vertrag (Felder, Payload,
> Antworten) je Service liefern die `WeWeb_<Service>_Anleitung.md`. Beide zusammen lesen, bevor du baust.
