/**
 * Wydatki: model i liczenie podsumowań.
 *
 * Dane siedzą w Firestore, w podkolekcji `uzytkownicy/{uid}/wydatki` — jeden
 * wydatek to jeden dokument. Zapisują je formularz w apce i narzędzie
 * `npm run baza`. Tutaj są już tylko przekształcenia w pamięci: sumy,
 * podziały na kategorie i typy, porównania między miesiącami.
 */

import {
  KATEGORIE,
  KATEGORIA_DOMYSLNA,
  KATEGORIA_FUNDUSZ,
  typKategorii,
  TYPY,
  type TypWydatku,
} from './kategorie';

export type ZrodloWydatku = 'reczny' | 'import';

export type Wydatek = {
  id: string;
  /** YYYY-MM-DD */
  data: string;
  kwota: number;
  opis: string;
  kategoria?: string;
  /** Gdzie — Żabka, Orlen, Allegro. Osobno od opisu, żeby dało się zliczyć. */
  sklep?: string;
  zrodlo?: ZrodloWydatku;
};

export function kluczMiesiacaWydatku(w: Wydatek): string {
  return w.data.slice(0, 7);
}

/* ── Fundusz nieregularny ───────────────────────────────────
   Osobne subkonto, osobna kieszeń: dentysta, opony, sprzęt, prezenty.
   Wszystko, co liczy „ile wydałem z budżetu", musi te wydatki pominąć,
   inaczej duży, rzadki zakup wyglądałby na przekroczony miesiąc. */

export function budzetowe(wydatki: Wydatek[]): Wydatek[] {
  return wydatki.filter((w) => w.kategoria !== KATEGORIA_FUNDUSZ);
}

export function funduszowe(wydatki: Wydatek[]): Wydatek[] {
  return wydatki.filter((w) => w.kategoria === KATEGORIA_FUNDUSZ);
}

/** Składki naliczone od startu planu, z bieżącym miesiącem włącznie. */
function miesiecySkladek(start: string, dzis: Date): number {
  const [rok, miesiac] = start.slice(0, 7).split('-').map(Number);
  const ile = (dzis.getFullYear() - rok) * 12 + (dzis.getMonth() + 1 - miesiac) + 1;
  return Math.max(ile, 0);
}

/**
 * Stan funduszu liczony, nie wpisywany: składki minus to, co z niego poszło.
 * Zakłada, że comiesięczny przelew faktycznie robisz — pilnuje tego checklista
 * rozdysponowania. Gdy saldo rozjedzie się z kontem, to znaczy, że któryś
 * przelew wypadł, i wtedy poprawiamy plan, a nie liczbę tutaj.
 */
export function stanFunduszu(
  wydatki: Wydatek[],
  skladka: number,
  start: string,
  dzis: Date = new Date(),
): { saldo: number; skladki: number; wplacone: number; wydane: number } {
  const skladki = miesiecySkladek(start, dzis);
  const wplacone = skladki * skladka;
  const wydane = funduszowe(wydatki).reduce((s, w) => s + w.kwota, 0);
  return { saldo: wplacone - wydane, skladki, wplacone, wydane };
}

/* ── Podsumowania ───────────────────────────────────────── */

export type PozycjaSumy = {
  klucz: string;
  nazwa: string;
  kwota: number;
  udzial: number;
  liczba: number;
};

export type SumaTypu = {
  typ: TypWydatku;
  kwota: number;
  udzial: number;
};

export type PodsumowanieMiesiaca = {
  klucz: string;
  suma: number;
  liczba: number;
  /** Dni, w których cokolwiek wydano — nie długość miesiąca. */
  dniZWydatkami: number;
  wgKategorii: PozycjaSumy[];
  wgTypu: SumaTypu[];
};

export function wydatkiZMiesiaca(wydatki: Wydatek[], klucz: string): Wydatek[] {
  return wydatki.filter((w) => w.data.startsWith(klucz));
}

/** Miesiące z jakimkolwiek wydatkiem, od najnowszego. */
export function miesiaceZWydatkami(wydatki: Wydatek[]): string[] {
  return [...new Set(wydatki.map(kluczMiesiacaWydatku))].sort((a, b) => b.localeCompare(a));
}

function udzialy(suma: number, kwota: number): number {
  return suma > 0 ? kwota / suma : 0;
}

function dniWMiesiacu(klucz: string): number {
  const [rok, miesiac] = klucz.split('-').map(Number);
  return new Date(rok, miesiac, 0).getDate();
}

export function podsumujMiesiac(wydatki: Wydatek[], klucz: string): PodsumowanieMiesiaca {
  const wTym = wydatkiZMiesiaca(wydatki, klucz);
  const suma = wTym.reduce((s, w) => s + w.kwota, 0);

  const poKategorii = new Map<string, { kwota: number; liczba: number }>();
  const poTypie = new Map<TypWydatku, number>();
  const dniZWpisem = new Set<number>();

  for (const w of wTym) {
    const k = w.kategoria ?? KATEGORIA_DOMYSLNA;
    const wpisK = poKategorii.get(k) ?? { kwota: 0, liczba: 0 };
    poKategorii.set(k, { kwota: wpisK.kwota + w.kwota, liczba: wpisK.liczba + 1 });

    poTypie.set(typKategorii(k), (poTypie.get(typKategorii(k)) ?? 0) + w.kwota);

    dniZWpisem.add(Number(w.data.slice(8, 10)));
  }

  const wgKategorii: PozycjaSumy[] = [...poKategorii.entries()]
    .map(([id, v]) => ({
      klucz: id,
      nazwa: KATEGORIE.find((k) => k.id === id)?.nazwa ?? id,
      kwota: v.kwota,
      udzial: udzialy(suma, v.kwota),
      liczba: v.liczba,
    }))
    .sort((a, b) => b.kwota - a.kwota);

  const wgTypu: SumaTypu[] = TYPY.map((typ) => {
    const kwota = poTypie.get(typ) ?? 0;
    return { typ, kwota, udzial: udzialy(suma, kwota) };
  });

  return {
    klucz,
    suma,
    liczba: wTym.length,
    dniZWydatkami: dniZWpisem.size,
    wgKategorii,
    wgTypu,
  };
}

/** Poprzedni miesiąc w formacie RRRR-MM. */
export function poprzedniMiesiac(klucz: string): string {
  const [rok, miesiac] = klucz.split('-').map(Number);
  const d = new Date(rok, miesiac - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export type Zmiana = {
  klucz: string;
  nazwa: string;
  teraz: number;
  wczesniej: number;
  roznica: number;
};

/**
 * Zmiana kwoty w każdej kategorii wobec poprzedniego miesiąca,
 * od największego wzrostu do największego spadku.
 */
export function porownajZPoprzednim(wydatki: Wydatek[], klucz: string): Zmiana[] {
  const teraz = podsumujMiesiac(wydatki, klucz);
  const wczesniej = podsumujMiesiac(wydatki, poprzedniMiesiac(klucz));

  const klucze = new Set([
    ...teraz.wgKategorii.map((k) => k.klucz),
    ...wczesniej.wgKategorii.map((k) => k.klucz),
  ]);

  return [...klucze]
    .map((id) => {
      const a = teraz.wgKategorii.find((k) => k.klucz === id)?.kwota ?? 0;
      const b = wczesniej.wgKategorii.find((k) => k.klucz === id)?.kwota ?? 0;
      return {
        klucz: id,
        nazwa: KATEGORIE.find((k) => k.id === id)?.nazwa ?? id,
        teraz: a,
        wczesniej: b,
        roznica: a - b,
      };
    })
    .filter((z) => Math.abs(z.roznica) >= 0.01)
    .sort((a, b) => b.roznica - a.roznica);
}

/**
 * Ile miesiąc zamknie się na koniec, jeśli tempo z dotychczasowych dni
 * się utrzyma. Dla miesięcy zamkniętych zwraca po prostu sumę.
 *
 * Zobowiązania stoją poza tempem dziennym: płacisz je raz, zwykle na
 * początku miesiąca, i już nie wrócą. Wrzucone do tempa zawyżałyby prognozę
 * tym mocniej, im wcześniejszy dzień miesiąca — abonament z 1. dnia byłby
 * przy takim liczeniu policzony trzydzieści razy.
 */
export function prognozaMiesiaca(
  podsumowanie: PodsumowanieMiesiaca,
  dzis: Date = new Date(),
): number {
  const dni = dniWMiesiacu(podsumowanie.klucz);
  const biezacy = podsumowanie.klucz === `${dzis.getFullYear()}-${String(dzis.getMonth() + 1).padStart(2, '0')}`;
  if (!biezacy) return podsumowanie.suma;
  const minelo = Math.min(dzis.getDate(), dni);
  if (minelo === 0) return 0;

  const zobowiazania = podsumowanie.wgTypu.find((t) => t.typ === 'staly')?.kwota ?? 0;
  const ruchome = podsumowanie.suma - zobowiazania;
  return zobowiazania + (ruchome / minelo) * dni;
}
