export default {
  editor: {
    label: { en: 'Notifications Bell', de: 'Benachrichtigungs-Glocke' },
    icon: 'bell',
  },
  properties: {
    supabaseUrl: {
      label: { en: 'Supabase URL', de: 'Supabase URL' },
      type: 'Text',
      section: 'settings',
      defaultValue: 'https://ztvqsxdudzdyqgeylujr.supabase.co',
      bindable: true,
      /* wwEditor:start */
      bindingValidation: {
        type: 'string',
        tooltip: 'Basis-URL des Supabase-Projekts (ohne Slash am Ende).',
      },
      /* wwEditor:end */
    },
    supabaseAnonKey: {
      label: { en: 'Supabase Anon Key', de: 'Supabase Anon-Key' },
      type: 'Text',
      section: 'settings',
      defaultValue: '',
      bindable: true,
      /* wwEditor:start */
      bindingValidation: {
        type: 'string',
        tooltip: 'Oeffentlicher Anon-/Publishable-Key. NIE der service_role-Key.',
      },
      /* wwEditor:end */
    },
    authToken: {
      label: { en: 'Auth Token (JWT)', de: 'Auth-Token (JWT)' },
      type: 'Text',
      section: 'settings',
      defaultValue: '',
      bindable: true,
      /* wwEditor:start */
      bindingValidation: {
        type: 'string',
        tooltip: 'Access Token des eingeloggten Users. Empfehlung: an Auth["session"].access_token binden.',
      },
      /* wwEditor:end */
    },
    userId: {
      label: { en: 'User ID (optional)', de: 'User-ID (optional)' },
      type: 'Text',
      section: 'settings',
      defaultValue: '',
      bindable: true,
      /* wwEditor:start */
      bindingValidation: {
        type: 'string',
        tooltip: 'Optional. Leer lassen — wird sonst aus dem JWT abgeleitet. RLS bleibt der echte Schutz.',
      },
      /* wwEditor:end */
    },
    maxItems: {
      label: { en: 'Max items', de: 'Max. Eintraege' },
      type: 'Number',
      section: 'settings',
      min: 1,
      max: 50,
      step: 1,
      defaultValue: 10,
      bindable: true,
      /* wwEditor:start */
      bindingValidation: {
        type: 'number',
        tooltip: 'Wie viele ungelesene Benachrichtigungen maximal geladen werden.',
      },
      /* wwEditor:end */
    },
    realtime: {
      label: { en: 'Realtime updates', de: 'Live-Updates' },
      type: 'OnOff',
      section: 'settings',
      defaultValue: true,
      bindable: true,
      /* wwEditor:start */
      bindingValidation: {
        type: 'boolean',
        tooltip: 'Live-Aktualisierung via Supabase Realtime. Bei Problemen laedt die Glocke trotzdem normal.',
      },
      /* wwEditor:end */
    },
  },
  triggerEvents: [
    { name: 'loaded', label: { en: 'On loaded', de: 'Geladen' }, event: { count: 0 } },
    { name: 'unread-changed', label: { en: 'On unread count change', de: 'Anzahl ungelesen geaendert' }, event: { count: 0 } },
    { name: 'notification-clicked', label: { en: 'On notification clicked', de: 'Benachrichtigung geklickt' }, event: { id: '', action_url: '' } },
    { name: 'all-read', label: { en: 'On all marked read', de: 'Alle gelesen' }, event: {} },
    { name: 'error', label: { en: 'On error', de: 'Fehler' }, event: { reason: '' } },
  ],
};
