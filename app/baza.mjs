#!/usr/bin/env node
/**
 * Dostęp do Firestore z wiersza poleceń.
 *
 * Struktura bazy:
 *   uzytkownicy/{uid}                  profil
 *   uzytkownicy/{uid}/wydatki/{id}     jeden wydatek = jeden dokument
 *   uzytkownicy/{uid}/wplaty/{id}
 *   uzytkownicy/{uid}/kroki/{RRRR-MM}
 *   plany/{uid}                        plan
 *
 * Poświadczenia to klucz konta serwisowego. Klucz OMIJA firestore.rules —
 * trzymaj go poza repozytorium i nie wysyłaj nigdzie.
 *
 * Dwie warstwy komend.
 *
 * 1. Komendy dziedzinowe — znają kształt danych i sprawdzają go przed zapisem
 *    (kategoria z `kategorie.ts`, kwota dodatnia, data RRRR-MM-DD). Na co dzień
 *    używa się wyłącznie ich.
 *
 *      npm run baza stan
 *      npm run baza wydatki [RRRR-MM]
 *      npm run baza wplaty [RRRR-MM]
 *      npm run baza kroki [RRRR-MM]
 *      npm run baza profil
 *      npm run baza plan
 *      npm run baza dodaj '{"kwota":3.47,"opis":"Prowizja","kategoria":"oplaty"}'
 *      npm run baza popraw <id> '{"kategoria":"wyjazdy"}'
 *      npm run baza usun <id>
 *      npm run baza wplata '{"kwota":100,"opis":"Nagroda z banku","zrodlo":"dodatkowy"}'
 *      npm run baza wplata-popraw <id> '{"kwota":120}'
 *      npm run baza wplata-usun <id>
 *      npm run baza krok 2026-09 '{"r-przelewy":true}'
 *      npm run baza kroki-usun 2026-09
 *      npm run baza profil-ustaw '{"zwinieteKarty":{"fundusz":true}}'
 *      npm run baza plan-zapisz <plik.json>
 *      npm run baza plan-popraw '{"budzetBiezacy":7800}'
 *
 * 2. Komendy surowe — dowolny dokument, dowolne pole, **bez żadnej walidacji**.
 *    Są po to, żeby nie trzeba było dopisywać komendy za każdym razem, gdy
 *    w bazie pojawi się nowe miejsce. Cena: zły JSON wchodzi bez ostrzeżenia,
 *    a apka pokaże to dopiero jako błąd wczytania.
 *
 *      npm run baza pokaz  <sciezka>
 *      npm run baza zapisz <sciezka> '<json>'    nadpisuje cały dokument
 *      npm run baza scal   <sciezka> '<json>'    podmienia tylko podane pola
 *      npm run baza skasuj <sciezka>
 *
 *    W ścieżce `@` oznacza uid, więc nie trzeba go przepisywać:
 *      @                    → uzytkownicy/{uid}          (profil)
 *      @wydatki             → cała podkolekcja
 *      @wydatki/<id>        → jeden wydatek
 *      @kroki/2026-09       → odhaczone kroki miesiąca
 *      plany/@              → plan
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/* ── Poświadczenia ──────────────────────────────────────────
   Klucz szukany w zmiennej GOOGLE_APPLICATION_CREDENTIALS, a gdy jej nie ma —
   w domyślnej ścieżce w katalogu domowym. Powód drugiego: Git Bash przerabia
   ścieżki uniksowe (z "/klucz.json" robi się "C:/Program Files/Git/klucz.json"),
   więc ręczne ustawianie zmiennej daje mylący błąd o braku pliku. */

const DOMYSLNY_KLUCZ = join(homedir(), '.sekrety', 'sb-finance-firestore.json');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(DOMYSLNY_KLUCZ)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = DOMYSLNY_KLUCZ;
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    'Nie znalazłem klucza konta serwisowego.\n\nZapisz go tutaj:\n  ' +
      DOMYSLNY_KLUCZ +
      '\n\nalbo wskaż własną ścieżkę zmienną GOOGLE_APPLICATION_CREDENTIALS.',
  );
  process.exit(1);
}

/* Projekt bierzemy z .firebaserc, żeby nie było drugiego miejsca do zmiany.
   Ten plik jest poza gitem — po świeżym klonie repo trzeba go odtworzyć,
   więc brak lepiej powiedzieć wprost niż surowym ENOENT. */
const sciezkaProjektu = new URL('./.firebaserc', import.meta.url);
if (!existsSync(sciezkaProjektu)) {
  console.error(
    'Brak .firebaserc — nie wiem, do którego projektu się łączyć.\n' +
      'Odtwórz go: firebase use --add',
  );
  process.exit(1);
}
const projectId = JSON.parse(readFileSync(sciezkaProjektu, 'utf8')).projects.default;

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

/* ── Czytanie z kategorie.ts ────────────────────────────────
   Wiersz poleceń nie ma buildu, więc nie zaimportuje modułu TypeScriptu —
   czyta go jako tekst. Plik wczytujemy raz, a każdy wzorzec, który nic nie
   znajdzie, przerywa pracę z komunikatem. Cicha pusta lista byłaby gorsza
   niż błąd: `slowaFirmowe()` pilnuje, żeby ZUS nie wpadł do budżetu, więc
   po zmianie nazwy stałej zapis przechodziłby bez ostrzeżenia. */

let zrodloKategorii;
function kategorieTS() {
  zrodloKategorii ??= readFileSync(new URL('./src/lib/kategorie.ts', import.meta.url), 'utf8');
  return zrodloKategorii;
}

function wymagaj(wartosc, co) {
  if (!wartosc || wartosc.length === 0) {
    throw new Error(`Nie udało się odczytać ${co} z src/lib/kategorie.ts — zmieniła się nazwa albo kształt zapisu.`);
  }
  return wartosc;
}

/** Identyfikatory kategorii wydatków. */
function znaneKategorie() {
  return wymagaj(
    [...kategorieTS().matchAll(/\{\s*id:\s*'([a-z-]+)'/g)].map((m) => m[1]),
    'listy kategorii',
  );
}

/**
 * Kategorie poza budżetem bieżącym. W tablicy stoją nazwy stałych
 * (`KATEGORIA_FUNDUSZ`), więc trzeba je jeszcze rozwinąć w wartości.
 */
function pozaBudzetem() {
  const zrodlo = kategorieTS();
  const stale = Object.fromEntries(
    [...zrodlo.matchAll(/const (KATEGORIA_[A-Z_]+) = '([a-z-]+)'/g)].map((m) => [m[1], m[2]]),
  );
  const blok = wymagaj(zrodlo.match(/POZA_BUDZETEM: string\[] = \[([^\]]*)\]/), 'listy POZA_BUDZETEM');
  return blok[1]
    .split(',')
    .map((cz) => cz.trim())
    .filter(Boolean)
    .map((cz) => stale[cz] ?? cz.replace(/'/g, ''));
}

/** Słowa, po których wpis wygląda na obciążenie firmowe. */
function slowaFirmowe() {
  const blok = wymagaj(kategorieTS().match(/SLOWA_FIRMOWE = \[([^\]]*)\]/), 'listy SLOWA_FIRMOWE');
  return wymagaj(
    [...blok[1].matchAll(/'([^']+)'/g)].map((m) => m[1]),
    'słów w SLOWA_FIRMOWE',
  );
}

/** Apka jest jednoosobowa, więc w kolekcji stoi dokładnie jeden dokument. */
async function uid() {
  const snap = await db.collection('uzytkownicy').get();
  if (snap.empty) throw new Error('Kolekcja `uzytkownicy` jest pusta — zaloguj się raz w apce.');
  if (snap.size > 1) {
    throw new Error(`W kolekcji jest ${snap.size} dokumentów. Trzeba wskazać uid wprost.`);
  }
  return snap.docs[0].id;
}

const pod = (id, nazwa) => db.collection(`uzytkownicy/${id}/${nazwa}`);

async function pozycje(id, nazwa) {
  const snap = await pod(id, nazwa).get();
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

/* ── Odczyt ─────────────────────────────────────────────── */

async function stan() {
  const id = await uid();
  const [w, wp, kr] = await Promise.all([
    pozycje(id, 'wydatki'),
    pozycje(id, 'wplaty'),
    pozycje(id, 'kroki'),
  ]);

  const miesiace = [...new Set(w.map((x) => x.data.slice(0, 7)))].sort();
  const reczne = w.filter((x) => x.zrodlo === 'reczny').length;

  console.log(`uid:      ${id}`);
  console.log('');
  console.log(`wydatki: ${w.length}  (${miesiace.join(', ') || 'brak'})`);
  console.log(`  ręcznych: ${reczne}, z importu: ${w.length - reczne}`);
  console.log(`wpłaty:  ${wp.length}`);
  console.log(`kroki:   ${kr.length} miesięcy`);
}

async function wydatki(klucz) {
  const id = await uid();
  /* Filtrowanie po stronie bazy, nie po pobraniu wszystkiego — to jest ta
     możliwość, której stary układ nie dawał. */
  const zapytanie = klucz
    ? pod(id, 'wydatki').where('data', '>=', `${klucz}-01`).where('data', '<=', `${klucz}-31`)
    : pod(id, 'wydatki');

  const snap = await zapytanie.orderBy('data').get();
  for (const d of snap.docs) {
    const w = d.data();
    const kwota = w.kwota.toFixed(2).padStart(8);
    const kat = (w.kategoria ?? '—').padEnd(20);
    const sklep = (w.sklep ?? '').padEnd(16);
    console.log(`${w.data}  ${kwota} zł  ${kat} ${sklep} ${w.opis.padEnd(42)} ${d.id}`);
  }

  const suma = snap.docs.reduce((s, d) => s + d.data().kwota, 0);
  console.log(`\n${snap.size} pozycji, razem ${suma.toFixed(2)} zł`);

  /* Apka liczy budżet bez `fundusz` i `firma`. Gdyby wiersz poleceń pokazywał
     samą sumę wszystkiego, obie strony podawałyby inną liczbę za ten sam
     miesiąc — a to jest dokładnie ten rodzaj rozjazdu, przez który przestało
     się ufać plikom lokalnym. */
  const poza = snap.docs
    .map((d) => d.data())
    .filter((w) => pozaBudzetem().includes(w.kategoria));
  if (poza.length) {
    const ile = poza.reduce((s, w) => s + w.kwota, 0);
    console.log(
      `w tym poza budżetem (${poza.map((w) => w.kategoria).filter((k, i, t) => t.indexOf(k) === i).join(', ')}): ` +
        `${ile.toFixed(2)} zł — z budżetu bieżącego ${(suma - ile).toFixed(2)} zł`,
    );
  }
}

async function wplaty(klucz) {
  const id = await uid();
  const zapytanie = klucz
    ? pod(id, 'wplaty').where('data', '>=', `${klucz}-01`).where('data', '<=', `${klucz}-31`)
    : pod(id, 'wplaty');

  const snap = await zapytanie.orderBy('data').get();
  for (const d of snap.docs) {
    const w = d.data();
    const kwota = w.kwota.toFixed(2).padStart(9);
    console.log(`${w.data}  ${kwota} zł  ${(w.zrodlo ?? '—').padEnd(10)} ${w.opis.padEnd(42)} ${d.id}`);
  }

  /* Rozbicie na źródła, bo to dwie różne rzeczy: „plan" to składka
     z rozdysponowania, „dodatkowy" to nadwyżka ponad plan. Zlane w jedną sumę
     przestają cokolwiek mówić o tym, czy plan jest dotrzymywany. */
  const suma = (z) =>
    snap.docs.filter((d) => !z || d.data().zrodlo === z).reduce((s, d) => s + d.data().kwota, 0);
  console.log(
    `\n${snap.size} wpłat, razem ${suma().toFixed(2)} zł ` +
      `(z planu ${suma('plan').toFixed(2)}, dodatkowe ${suma('dodatkowy').toFixed(2)})`,
  );
}

/** Odhaczone kroki miesiąca: jeden dokument `kroki/{RRRR-MM}`, pola to id kroków. */
async function kroki(klucz) {
  const id = await uid();
  const snap = klucz
    ? await pod(id, 'kroki').doc(klucz).get().then((d) => (d.exists ? { docs: [d] } : { docs: [] }))
    : await pod(id, 'kroki').orderBy('__name__').get();

  if (!snap.docs.length) return console.log(klucz ? `Brak kroków dla ${klucz}.` : 'Brak kroków.');

  for (const d of snap.docs) {
    const dane = d.data();
    const odhaczone = Object.entries(dane).filter(([, v]) => v === true).map(([k]) => k);
    console.log(`${d.id}  (${odhaczone.length} odhaczonych)`);
    for (const k of odhaczone) console.log(`    ✔ ${k}`);
    const inne = Object.entries(dane).filter(([, v]) => v !== true);
    for (const [k, v] of inne) console.log(`    · ${k}: ${JSON.stringify(v)}`);
  }
}

async function profil() {
  const id = await uid();
  const dok = await db.doc(`uzytkownicy/${id}`).get();
  if (!dok.exists) return console.log('Brak dokumentu profilu.');
  console.log(JSON.stringify(dok.data(), null, 2));
}

async function plan() {
  const id = await uid();
  const dok = await db.doc(`plany/${id}`).get();
  if (!dok.exists) return console.log('Brak planu w bazie.');
  console.log(JSON.stringify(dok.data()?.plan, null, 2));
}

/**
 * Podmiana planu. To jedyna droga zmiany planu — apka go wyłącznie czyta.
 *
 * Obieg przy poprawce: `node baza.mjs plan > plan.json`, edycja, zapis.
 * Bez sprawdzania kształtu tutaj: walidacja siedzi w `sprawdzPlan` po stronie
 * apki i chodzi przy każdym wczytaniu, więc zły plan zobaczysz jako komunikat,
 * a nie jako pustą stronę.
 *
 * Zapis nadpisuje dokument w całości, a plan jest jedynym źródłem prawdy
 * i nie ma go nigdzie indziej. Dlatego stary ląduje najpierw w pliku obok —
 * bez tego jeden zły JSON kasuje plan bezpowrotnie. Kopię kasujesz po
 * sprawdzeniu, że nowy plan wstał w apce.
 */
async function kopiaPlanu(id) {
  const stary = await db.doc(`plany/${id}`).get();
  if (!stary.exists) return null;
  const znacznik = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const kopia = `plan-kopia-${znacznik}.json`;
  writeFileSync(kopia, JSON.stringify(stary.data()?.plan ?? null, null, 2), 'utf8');
  console.log(`Kopia poprzedniego planu: ${kopia}`);
  return stary.data()?.plan ?? null;
}

function podsumujPlan(p) {
  console.log(`Zapisano plan: ${Object.keys(p).length} pól.`);
  console.log(
    `budżet ${p.budzetBiezacy}, cel ${p.cel}, kroków miesiąca ${p.krokiMiesiaca?.length ?? 0}`,
  );
}

async function planZapisz(sciezka) {
  if (!sciezka) throw new Error('Podaj ścieżkę do pliku JSON z planem.');
  const nowy = JSON.parse(readFileSync(sciezka, 'utf8'));
  const id = await uid();

  await kopiaPlanu(id);
  await db.doc(`plany/${id}`).set({ plan: nowy, zaktualizowano: FieldValue.serverTimestamp() });
  podsumujPlan(nowy);
}

/**
 * Poprawka pojedynczych pól planu, bez przepisywania całości.
 *
 * Po to, żeby zmiana jednej kwoty nie wymagała zrzutu planu na dysk — a zrzut
 * planu to cały plan finansowy leżący w pliku, którego potem trzeba pamiętać
 * skasować. Scalanie liczymy tutaj i zapisujemy gotowy obiekt zamiast używać
 * `merge: true`: Firestore scala mapy rekurencyjnie, więc usunięcie pola
 * zagnieżdżonego byłoby niewykonalne, a tablice i tak podmienia w całości.
 */
async function planPopraw(surowy) {
  if (!surowy) throw new Error('Podaj zmiany jako JSON, np. {"budzetBiezacy":7800}');
  const zmiany = JSON.parse(surowy);
  const id = await uid();

  const stary = await kopiaPlanu(id);
  if (!stary) throw new Error('Nie ma planu w bazie — użyj `plan-zapisz`.');

  const nowy = { ...stary, ...zmiany };
  await db.doc(`plany/${id}`).set({ plan: nowy, zaktualizowano: FieldValue.serverTimestamp() });

  console.log(`Podmienione pola: ${Object.keys(zmiany).join(', ')}`);
  podsumujPlan(nowy);
}

/* ── Zapis ──────────────────────────────────────────────── */

/** Ten sam kształt id co w store.ts. */
function noweId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function sprawdzWydatek(wpis, kategorie, gdzie = 'wpis') {
  const kwota = Number(wpis.kwota);
  if (!Number.isFinite(kwota) || kwota <= 0) {
    throw new Error(`${gdzie}: kwota "${wpis.kwota}" musi być liczbą większą od zera.`);
  }
  if (!wpis.opis || !wpis.opis.trim()) throw new Error(`${gdzie}: opis jest wymagany.`);
  if (wpis.kategoria && !kategorie.includes(wpis.kategoria)) {
    throw new Error(`${gdzie}: nieznana kategoria "${wpis.kategoria}".\nDostępne: ${kategorie.join(', ')}`);
  }
  const data = wpis.data ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new Error(`${gdzie}: data "${data}" — oczekiwano RRRR-MM-DD.`);
  }

  /* Podatki, ZUS i koszty JDG schodzą z konta firmowego, zanim powstanie
     budżet. Wpisane jako wydatek liczą się drugi raz. Blokada jest miękka —
     koszt firmy potrafi pójść z prywatnej karty — ale wymaga powiedzenia
     tego wprost, bo inaczej wpada tu z rozpędu. */
  const slowa = slowaFirmowe();
  const trafienie = slowa.length
    ? new RegExp(`\\b(${slowa.join('|')})\\b`, 'i').exec(`${wpis.opis} ${wpis.sklep ?? ''}`)
    : null;
  if (trafienie && wpis.kategoria !== 'firma' && !wpis.mimoOstrzezenia) {
    throw new Error(
      [
        `${gdzie}: „${trafienie[0]}” wygląda na obciążenie firmowe.`,
        'Budżet bieżący nie obejmuje podatków, ZUS-u ani kosztów JDG — schodzą wcześniej z konta firmowego.',
        'Jeśli to naprawdę poszło z konta osobistego, dopisz "kategoria":"firma" — wtedy wpis stoi poza budżetem.',
        'Jeśli wiesz, co robisz, dopisz "mimoOstrzezenia":true.',
      ].join('\n'),
    );
  }

  const w = {
    data,
    kwota: Math.round(kwota * 100) / 100,
    opis: wpis.opis.trim(),
    kategoria: wpis.kategoria ?? 'inne',
  };
  if (wpis.sklep && wpis.sklep.trim()) w.sklep = wpis.sklep.trim();
  return w;
}

async function dodaj(surowy) {
  if (!surowy) throw new Error('Podaj wydatek jako JSON.');
  const wpis = JSON.parse(surowy);
  /* `dodano` to chwila zapisu, nie dzień wydatku — apka układa po nim wpisy
     z tego samego dnia w kolejności dopisywania. */
  const w = {
    ...sprawdzWydatek(wpis, znaneKategorie()),
    zrodlo: 'reczny',
    dodano: new Date().toISOString(),
  };

  const id = await uid();
  /* Jeden dokument, więc nie ma jak nadpisać niczego innego — to jest sens
     podkolekcji. W starym układzie ten zapis podmieniał cały stan. */
  await pod(id, 'wydatki').doc(noweId()).set(w);

  console.log(`Dopisano: ${w.data}  ${w.kwota.toFixed(2)} zł  ${w.opis}`);
  console.log('Apka zobaczy to od razu — nasłuchuje zmian.');
}

/**
 * Wpłata na poduszkę.
 *
 * Poduszką jest to, co faktycznie leży na koncie oszczędnościowym, więc wpłata
 * dopisana tutaj ma odpowiadać przelewowi, który naprawdę tam poszedł — inaczej
 * apka pokaże inne saldo niż bank.
 *
 * `zrodlo` rozdziela dwie rzeczy, które inaczej zlałyby się w jedną liczbę:
 * „plan" to comiesięczna składka z rozdysponowania, „dodatkowy" to wszystko,
 * czego w planie nie było — nagroda bankowa, turniej, zwrot. Domyślnie
 * „dodatkowy", bo składkę planową odhacza się w apce przy rozdysponowaniu.
 */
async function wplata(surowy) {
  if (!surowy) throw new Error('Podaj wpłatę jako JSON.');
  const wpis = JSON.parse(surowy);

  const kwota = Number(wpis.kwota);
  if (!Number.isFinite(kwota) || kwota <= 0) {
    throw new Error(`kwota "${wpis.kwota}" musi być liczbą większą od zera.`);
  }
  if (!wpis.opis || !wpis.opis.trim()) throw new Error('opis jest wymagany.');

  const zrodlo = wpis.zrodlo ?? 'dodatkowy';
  if (zrodlo !== 'plan' && zrodlo !== 'dodatkowy') {
    throw new Error(`zrodlo "${zrodlo}" — dozwolone: plan, dodatkowy.`);
  }

  const data = wpis.data ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new Error(`data "${data}" — oczekiwano RRRR-MM-DD.`);
  }

  const w = {
    data,
    kwota: Math.round(kwota * 100) / 100,
    opis: wpis.opis.trim(),
    zrodlo,
    dodano: new Date().toISOString(),
  };

  const id = await uid();
  await pod(id, 'wplaty').doc(noweId()).set(w);

  console.log(`Dopisano wpłatę: ${w.data}  ${w.kwota.toFixed(2)} zł  ${w.opis} (${w.zrodlo})`);
  console.log('Apka zobaczy to od razu — nasłuchuje zmian.');
}

/**
 * Poprawka istniejącego wydatku — najczęściej kategorii.
 *
 * Podmieniane są wyłącznie podane pola, reszta dokumentu zostaje. Dlatego to,
 * a nie „usuń i dodaj od nowa": tamto gubi `dodano`, czyli kolejność wpisów
 * w obrębie dnia, i podmienia id, które mogłeś już gdzieś zapisać.
 */
async function popraw(kolekcja, idWpisu, surowy) {
  if (!idWpisu) throw new Error(`Podaj id — pokazuje je \`npm run baza ${kolekcja}\`.`);
  if (!surowy) throw new Error('Podaj zmiany jako JSON, np. {"kategoria":"wyjazdy"}');

  const zmiany = JSON.parse(surowy);
  if (zmiany.kategoria) {
    const kategorie = znaneKategorie();
    if (!kategorie.includes(zmiany.kategoria)) {
      throw new Error(`nieznana kategoria "${zmiany.kategoria}".
Dostępne: ${kategorie.join(', ')}`);
    }
  }
  if (zmiany.zrodlo && kolekcja === 'wplaty' && !['plan', 'dodatkowy'].includes(zmiany.zrodlo)) {
    throw new Error(`zrodlo "${zmiany.zrodlo}" — dozwolone: plan, dodatkowy.`);
  }
  if (zmiany.kwota !== undefined) {
    const kwota = Number(zmiany.kwota);
    if (!Number.isFinite(kwota) || kwota <= 0) {
      throw new Error(`kwota "${zmiany.kwota}" musi być liczbą większą od zera.`);
    }
    zmiany.kwota = Math.round(kwota * 100) / 100;
  }

  const id = await uid();
  const dok = pod(id, kolekcja).doc(idWpisu);
  const snap = await dok.get();
  if (!snap.exists) throw new Error(`Nie ma wpisu o id ${idWpisu} w ${kolekcja}.`);

  await dok.set(zmiany, { merge: true });
  const w = { ...snap.data(), ...zmiany };
  console.log(
    `Poprawiono: ${w.data}  ${w.kwota.toFixed(2)} zł  ${w.kategoria ?? w.zrodlo ?? '—'}  ${w.opis}`,
  );
}

/**
 * Skasowanie wpisu. Bez kopii i bez cofania — jeden dokument, jedna decyzja.
 * Dlatego najpierw wypisujemy, co znika: pomyłka w id skasowałaby cudzy wpis
 * po cichu.
 */
async function usunWpis(kolekcja, idWpisu) {
  if (!idWpisu) throw new Error(`Podaj id — pokazuje je \`npm run baza ${kolekcja}\`.`);

  const id = await uid();
  const dok = pod(id, kolekcja).doc(idWpisu);
  const snap = await dok.get();
  if (!snap.exists) throw new Error(`Nie ma wpisu o id ${idWpisu} w ${kolekcja}.`);

  const w = snap.data();
  await dok.delete();
  console.log(
    `Usunięto: ${w.data}  ${w.kwota.toFixed(2)} zł  ${w.kategoria ?? w.zrodlo ?? '—'}  ${w.opis}`,
  );
}

/**
 * Odhaczenie albo odznaczenie kroków miesiąca.
 *
 * Zapis scalający, nie nadpisujący, bo dokument miesiąca zbiera odhaczenia
 * z apki i stąd naraz — nadpisanie skasowałoby to, co odhaczono na telefonie.
 * Odznaczenie: `{"r-przelewy":false}`.
 */
async function krok(klucz, surowy) {
  if (!/^\d{4}-\d{2}$/.test(klucz ?? '')) throw new Error('Podaj miesiąc jako RRRR-MM.');
  if (!surowy) throw new Error('Podaj kroki jako JSON, np. {"r-przelewy":true}');

  const zmiany = JSON.parse(surowy);
  for (const [k, v] of Object.entries(zmiany)) {
    if (typeof v !== 'boolean') throw new Error(`krok "${k}": oczekiwano true albo false.`);
  }

  const id = await uid();
  await pod(id, 'kroki').doc(klucz).set(zmiany, { merge: true });

  const opis = Object.entries(zmiany)
    .map(([k, v]) => `${v ? '✔' : '✘'} ${k}`)
    .join(', ');
  console.log(`${klucz}: ${opis}`);
}

/** Kasuje odhaczenia całego miesiąca — dokument znika, apka pokaże czystą listę. */
async function krokiUsun(klucz) {
  if (!/^\d{4}-\d{2}$/.test(klucz ?? '')) throw new Error('Podaj miesiąc jako RRRR-MM.');

  const id = await uid();
  const dok = pod(id, 'kroki').doc(klucz);
  const snap = await dok.get();
  if (!snap.exists) throw new Error(`Nie ma kroków dla ${klucz}.`);

  const ile = Object.values(snap.data()).filter((v) => v === true).length;
  await dok.delete();
  console.log(`Usunięto kroki ${klucz} (${ile} odhaczonych).`);
}

/** Profil to preferencje widoku, nie dane finansowe — stąd sam merge, bez kopii. */
async function profilUstaw(surowy) {
  if (!surowy) throw new Error('Podaj zmiany jako JSON, np. {"zwinieteKarty":{"fundusz":true}}');
  const zmiany = JSON.parse(surowy);

  const id = await uid();
  await db.doc(`uzytkownicy/${id}`).set(zmiany, { merge: true });
  console.log(`Profil: podmienione pola ${Object.keys(zmiany).join(', ')}`);
}

/* ── Surowy dostęp do dowolnego miejsca w bazie ─────────────
   Bez walidacji dziedzinowej — to jest jednocześnie sens tych komend i ich
   cena. Są po to, żeby nowe pole w bazie nie wymagało nowej komendy tutaj;
   na co dzień lepsze są komendy wyżej, bo łapią literówkę w kategorii
   albo ujemną kwotę, zanim wejdzie do bazy. */

/**
 * `@` w dowolnym segmencie to uid; `@` z przodu rozwija się do dokumentu
 * użytkownika, czyli `@wydatki` znaczy `uzytkownicy/{uid}/wydatki`.
 *
 * Bez ukośnika po `@` celowo. Git Bash przerabia każdy argument zaczynający
 * się od `/` na ścieżkę Windows, więc z `@/wydatki` robi mu się
 * `@C:/Program Files/Git/wydatki` — ten sam mechanizm, który wyżej psuje
 * ustawianie GOOGLE_APPLICATION_CREDENTIALS. `@wydatki` przechodzi nietknięte.
 */
async function rozwin(wzor) {
  if (!wzor) throw new Error('Podaj ścieżkę, np. @wydatki albo plany/@');
  if (wzor.includes('Program Files/Git')) {
    throw new Error(
      `Powłoka przerobiła ścieżkę na "${wzor}".\n` +
        'Pomiń ukośnik po @: zamiast @/wydatki napisz @wydatki.',
    );
  }

  const id = await uid();
  const czesci = (wzor.startsWith('@') ? `uzytkownicy/${id}/${wzor.slice(1)}` : wzor)
    .split('/')
    .filter(Boolean);

  return czesci.map((c) => (c === '@' ? id : c)).join('/');
}

/* Nieparzysta liczba segmentów to kolekcja, parzysta — dokument. */
const toDokument = (s) => s.split('/').length % 2 === 0;

async function pokaz(wzor) {
  const s = await rozwin(wzor);

  if (toDokument(s)) {
    const dok = await db.doc(s).get();
    if (!dok.exists) return console.log(`Nie ma dokumentu ${s}.`);
    return console.log(JSON.stringify(dok.data(), null, 2));
  }

  const snap = await db.collection(s).get();
  if (snap.empty) return console.log(`Kolekcja ${s} jest pusta.`);
  const pozycje = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(JSON.stringify(pozycje, null, 2));
  console.log(`\n${snap.size} dokumentów w ${s}`);
}

/** Plan jest jedynym źródłem prawdy i nie ma go nigdzie indziej — stąd kopia. */
async function chronPlan(s) {
  if (s.startsWith('plany/')) await kopiaPlanu(await uid());
}

async function zapisz(wzor, surowy) {
  const s = await rozwin(wzor);
  if (!toDokument(s)) throw new Error(`${s} to kolekcja — zapisz wskazuje na dokument.`);
  if (!surowy) throw new Error('Podaj treść dokumentu jako JSON.');

  await chronPlan(s);
  await db.doc(s).set(JSON.parse(surowy));
  console.log(`Nadpisano ${s}.`);
}

async function scal(wzor, surowy) {
  const s = await rozwin(wzor);
  if (!toDokument(s)) throw new Error(`${s} to kolekcja — scal wskazuje na dokument.`);
  if (!surowy) throw new Error('Podaj zmiany jako JSON.');

  const zmiany = JSON.parse(surowy);
  await chronPlan(s);
  await db.doc(s).set(zmiany, { merge: true });
  console.log(`${s}: podmienione pola ${Object.keys(zmiany).join(', ')}`);
}

async function skasuj(wzor) {
  const s = await rozwin(wzor);
  if (!toDokument(s)) {
    throw new Error(
      `${s} to kolekcja. Firestore nie kasuje kolekcji jednym ruchem — ` +
        'skasuj dokumenty pojedynczo, id pokaże `pokaz`.',
    );
  }

  const dok = await db.doc(s).get();
  if (!dok.exists) throw new Error(`Nie ma dokumentu ${s}.`);

  /* Wypisujemy całą treść przed skasowaniem: bez cofania to jedyny ślad
     po tym, co zniknęło. */
  console.log(JSON.stringify(dok.data(), null, 2));
  await chronPlan(s);
  await db.doc(s).delete();
  console.log(`\nSkasowano ${s}.`);
}

/* ── Wywołanie ──────────────────────────────────────────── */

const [komenda, ...reszta] = process.argv.slice(2);
const komendy = {
  stan,
  wydatki: () => wydatki(reszta[0]),
  wplaty: () => wplaty(reszta[0]),
  kroki: () => kroki(reszta[0]),
  profil,
  plan,
  dodaj: () => dodaj(reszta[0]),
  popraw: () => popraw('wydatki', reszta[0], reszta[1]),
  usun: () => usunWpis('wydatki', reszta[0]),
  wplata: () => wplata(reszta[0]),
  'wplata-popraw': () => popraw('wplaty', reszta[0], reszta[1]),
  'wplata-usun': () => usunWpis('wplaty', reszta[0]),
  krok: () => krok(reszta[0], reszta[1]),
  'kroki-usun': () => krokiUsun(reszta[0]),
  'profil-ustaw': () => profilUstaw(reszta[0]),
  'plan-zapisz': () => planZapisz(reszta[0]),
  'plan-popraw': () => planPopraw(reszta[0]),
  pokaz: () => pokaz(reszta[0]),
  zapisz: () => zapisz(reszta[0], reszta[1]),
  scal: () => scal(reszta[0], reszta[1]),
  skasuj: () => skasuj(reszta[0]),
};

if (!komendy[komenda]) {
  console.error(`Użycie: npm run baza <komenda> [argumenty]

Odczyt
  stan                          co jest w bazie
  wydatki [RRRR-MM]             lista wydatków, ostatnia kolumna to id
  wplaty  [RRRR-MM]             lista wpłat na poduszkę
  kroki   [RRRR-MM]             odhaczone kroki miesiąca
  profil                        preferencje widoku
  plan                          zrzut planu

Wydatki
  dodaj  '{"kwota":12.99,"opis":"kawa","kategoria":"spozywcze","sklep":"Żabka"}'
  popraw <id> '{"kategoria":"wyjazdy"}'
  usun   <id>

Poduszka
  wplata        '{"kwota":100,"opis":"Nagroda z banku","zrodlo":"dodatkowy"}'
  wplata-popraw <id> '{"kwota":120}'
  wplata-usun   <id>

Kroki miesiąca i profil
  krok         2026-09 '{"r-przelewy":true}'
  kroki-usun   2026-09
  profil-ustaw '{"zwinieteKarty":{"fundusz":true}}'

Plan
  plan-zapisz <plik.json>       podmiana całości, z kopią starego planu
  plan-popraw '{"budzetBiezacy":7800}'   podmiana wybranych pól, też z kopią

Surowo, bez walidacji — @ oznacza uid
  pokaz  <sciezka>              @ | @wydatki | @wydatki/<id> | plany/@
  zapisz <sciezka> '<json>'     nadpisuje cały dokument
  scal   <sciezka> '<json>'     podmienia tylko podane pola
  skasuj <sciezka>              wypisuje treść, potem kasuje`);
  process.exit(1);
}

komendy[komenda]().catch((e) => {
  console.error(`Błąd: ${e.message}`);
  process.exit(1);
});
