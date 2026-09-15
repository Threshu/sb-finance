/**
 * Sprawdza, czy w publicznym buildzie (`out/`) nie ma danych z planu.
 *
 * Firebase Hosting serwuje `out/` bez żadnej autoryzacji, więc każdy ciąg
 * z planu, który tam trafi, jest publiczny. Skrypt bierze wszystkie teksty
 * z planu i szuka ich w zbudowanych plikach.
 *
 * Plan pobierany jest z Firestore, bo tam mieszka — lokalnego pliku z planem
 * już nie ma i celowo: kopia na dysku rozjeżdżała się z bazą.
 *
 * Skrypt chodzi też sam przed każdym `firebase deploy` (`predeploy`
 * w `firebase.json`), więc kod wyjścia musi coś znaczyć: 1 = wyciekło coś
 * NOWEGO i deploy ma stanąć. Dlatego niżej jest lista etykiet raz uznanych
 * za ogólne — bez niej każde wdrożenie stawałoby na tych samych nagłówkach.
 *
 * Użycie:  npm run build && npm run sprawdz-wyciek
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const OUT = fileURLToPath(new URL('./out', import.meta.url));

/**
 * Teksty, które trafiają do buildu z komponentów jako ich własne nagłówki
 * i nazwy techniczne, a w planie stoją przypadkiem tak samo.
 *
 * Wolno tu dopisać WYŁĄCZNIE ciąg, który nie mówi nic o nikim: nazwę karty,
 * ogólne słowo, identyfikator kroku. Nigdy nazwy własnej — firmy, banku,
 * konta, klienta, miejscowości. Wpis tutaj wyłącza alarm na stałe, więc
 * każdy nowy dopisuj po przeczytaniu, skąd naprawdę się wziął.
 */
const ETYKIETY_OGOLNE = new Set([
  'Poduszka bezpieczeństwa',
  'Fundusz nieregularny',
  'Budżet bieżący',
  // Wartości pola `kwotaZ` w krokach rozdysponowania: mówią, skąd krok bierze
  // kwotę, a nie czyja ona jest. Muszą stać i w planie, i w kodzie, bo to one
  // łączą jedno z drugim.
  'budzet',
  'fundusz',
  'obciazenie',
  // Wartości pola `podstawa` w kamieniach milowych — nazwy pól planu,
  // z tego samego powodu co wyżej.
  'kosztyTwarde',
  'celMinimum',
  'od ręki',
  'srednia',
  'wysoka',
  'niska',
]);

if (!existsSync(OUT)) {
  console.error('Brak katalogu out/ — najpierw uruchom `npm run build`.');
  process.exit(2);
}

const DOMYSLNY_KLUCZ = join(homedir(), '.sekrety', 'sb-finance-firestore.json');
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(DOMYSLNY_KLUCZ)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = DOMYSLNY_KLUCZ;
}

const sciezkaProjektu = new URL('./.firebaserc', import.meta.url);
const projectId = JSON.parse(readFileSync(sciezkaProjektu, 'utf8')).projects.default;

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const uzytkownicy = await db.collection('uzytkownicy').get();
if (uzytkownicy.empty) {
  console.error('Kolekcja `uzytkownicy` jest pusta — nie ma czyjego planu sprawdzać.');
  process.exit(2);
}
const dokPlanu = await db.doc(`plany/${uzytkownicy.docs[0].id}`).get();
if (!dokPlanu.exists) {
  console.error('Brak planu w bazie — nie ma czego szukać.');
  process.exit(2);
}

/**
 * Zbiera z planu teksty, których warto szukać w buildzie.
 *
 * Same liczby są pominięte celowo. Sprawdzone: „1000", „10000", „40000"
 * i podobne trafiają w zminifikowany kod bibliotek za każdym razem, więc
 * dawały wyłącznie fałszywe alarmy i zagłuszały prawdziwe trafienia.
 * Wyciek kwot i tak przyszedłby razem z nazwami — nie ma jak wstawić do
 * buildu liczb z planu, nie wstawiając przy okazji jego tekstów.
 */
function zbierz(wezel, wynik = new Set()) {
  if (typeof wezel === 'string') {
    // Krótkie ciągi ('id', 'PLN') dają fałszywe trafienia w zminifikowanym kodzie.
    if (wezel.trim().length >= 5) wynik.add(wezel.trim());
  } else if (Array.isArray(wezel)) {
    wezel.forEach((w) => zbierz(w, wynik));
  } else if (wezel && typeof wezel === 'object') {
    Object.values(wezel).forEach((w) => zbierz(w, wynik));
  }
  return wynik;
}

function pliki(katalog) {
  return readdirSync(katalog, { withFileTypes: true }).flatMap((w) => {
    const p = join(katalog, w.name);
    return w.isDirectory() ? pliki(p) : [p];
  });
}

const szukane = [...zbierz(dokPlanu.data()?.plan)];
const doPrzeszukania = pliki(OUT).filter((p) => /\.(js|html|json|txt|css)$/i.test(p));

const trafienia = [];
for (const plik of doPrzeszukania) {
  const tresc = readFileSync(plik, 'utf8');
  for (const igla of szukane) {
    if (tresc.includes(igla)) {
      trafienia.push({ plik: relative(OUT, plik), igla });
    }
  }
}

const nowe = trafienia.filter((t) => !ETYKIETY_OGOLNE.has(t.igla));
const znane = new Set(trafienia.filter((t) => ETYKIETY_OGOLNE.has(t.igla)).map((t) => t.igla));

const podsumowanie = `sprawdzono ${szukane.length} ciągów z planu w ${doPrzeszukania.length} plikach`;

if (nowe.length === 0) {
  console.log(`OK — ${podsumowanie}. Nic nowego nie wyciekło.`);
  if (znane.size > 0) {
    console.log(`Znane ogólne etykiety (${znane.size}): ${[...znane].join(', ')}.`);
  }
  process.exit(0);
}

// Skrypt nie odróżni nazwy firmy od nagłówka — ostatnie słowo należy do ciebie.
console.error(`WYCIEK — ${nowe.length} trafień spoza listy znanych etykiet.\n`);
console.error('Sprawdź każde. Jeśli to nazwa własna — firmy, banku, konta, klienta —');
console.error('wyrzuć ją z komponentu i weź z planu. Jeśli to twój własny nagłówek,');
console.error('dopisz go do ETYKIETY_OGOLNE na górze tego pliku.\n');

const wgIgly = new Map();
for (const t of nowe) {
  if (!wgIgly.has(t.igla)) wgIgly.set(t.igla, []);
  wgIgly.get(t.igla).push(t.plik);
}
for (const [igla, lista] of [...wgIgly].sort((a, b) => b[0].length - a[0].length)) {
  console.error(`  ${JSON.stringify(igla)}`);
  console.error(`    w: ${lista.join(', ')}`);
}
process.exit(1);
