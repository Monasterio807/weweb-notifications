// Pop-up «Neue Anfragen»: hängt an denselben Daten wie die Glocke (user_notifications).
// Kein zweites System: gezählt werden die ungelesenen Glocken-Einträge «Neue Frage an dich»,
// die notify-corina für Admin und hr_experte anlegt.

export const ANFRAGE_TITEL = 'Neue Frage an dich';
export const POPUP_SCHLUESSEL = 'hrk_neue_anfragen_popup';
export const ANFRAGEN_URL_STANDARD = '/verwaltung?tab=anfragen';

export function anzahlNeueAnfragen(items) {
  if (!Array.isArray(items)) return 0;
  return items.filter((n) => n && n.title === ANFRAGE_TITEL && n.is_read !== true).length;
}

export function popupSatz(n) {
  if (!(n > 0)) return '';
  return n === 1 ? '1 Frage wartet auf dich.' : `${n} Fragen warten auf dich.`;
}

// Einmal je Anmeldung: Der Marker liegt in sessionStorage und verschwindet mit der Sitzung.
export function schonGezeigt(speicher) {
  try { return !!speicher && speicher.getItem(POPUP_SCHLUESSEL) === '1'; } catch (e) { return false; }
}
export function alsGezeigtMerken(speicher) {
  try { if (speicher) speicher.setItem(POPUP_SCHLUESSEL, '1'); } catch (e) { /* ohne Speicher zeigt das Pop-up nur einmal je Seitenaufruf */ }
}

// Nur relative Adressen der eigenen App sind erlaubt (kein Weiterleiten an fremde Seiten).
export function sichereUrl(url) {
  const u = String(url || '').trim();
  return /^\/(?!\/)[^\s]*$/.test(u) ? u : ANFRAGEN_URL_STANDARD;
}
