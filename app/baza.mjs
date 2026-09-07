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
 *   npm run baza stan
 *   npm run baza wydatki 2026-09
 *   npm run baza plan
 *   npm run baza dodaj '{"kwota":3.47,"opis":"Prowizja","kategoria":"oplaty"}'
 *   npm run baza wplata '{"kwota":100,"opis":"Nagroda z banku","zrodlo":"dodatkowy"}'
 *   npm run baza plan-zapisz <plik.json>
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

/* Lista kategorii wyciągana ze źródła prawdy, czyli z kategorie.ts.
   Duplikowanie jej tutaj skończyłoby się rozjazdem przy pierwszej zmianie. */
function znaneKategorie() {
  const zrodlo = readFileSync(new URL('./src/lib/kategorie.ts', import.meta.url), 'utf8');
  return [...zrodlo.matchAll(/\{\s*id:\s*'([a-z-]+)'/g)].map((m) => m[1]);
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
    console.log(`${w.data}  ${kwota} zł  ${kat} ${sklep} ${w.opis}`);
  }

  const suma = snap.docs.reduce((s, d) => s + d.data().kwota, 0);
  console.log(`\n${snap.size} pozycji, razem ${suma.toFixed(2)} zł`);
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
async function planZapisz(sciezka) {
  if (!sciezka) throw new Error('Podaj ścieżkę do pliku JSON z planem.');
  const nowy = JSON.parse(readFileSync(sciezka, 'utf8'));
  const id = await uid();

  const stary = await db.doc(`plany/${id}`).get();
  if (stary.exists) {
    const znacznik = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const kopia = `plan-kopia-${znacznik}.json`;
    writeFileSync(kopia, JSON.stringify(stary.data()?.plan ?? null, null, 2), 'utf8');
    console.log(`Kopia poprzedniego planu: ${kopia}`);
  }

  await db.doc(`plany/${id}`).set({ plan: nowy, zaktualizowano: FieldValue.serverTimestamp() });

  console.log(`Zapisano plan: ${Object.keys(nowy).length} pól.`);
  console.log(
    `budżet ${nowy.budzetBiezacy}, cel ${nowy.cel}, kroków miesiąca ${nowy.krokiMiesiaca?.length ?? 0}`,
  );
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

/* ── Wywołanie ──────────────────────────────────────────── */

const [komenda, ...reszta] = process.argv.slice(2);
const komendy = {
  stan,
  wydatki: () => wydatki(reszta[0]),
  plan,
  'plan-zapisz': () => planZapisz(reszta[0]),
  dodaj: () => dodaj(reszta[0]),
  wplata: () => wplata(reszta[0]),
};

if (!komendy[komenda]) {
  console.error(`Użycie: npm run baza <${Object.keys(komendy).join('|')}>`);
  process.exit(1);
}

komendy[komenda]().catch((e) => {
  console.error(`Błąd: ${e.message}`);
  process.exit(1);
});
