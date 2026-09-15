/**
 * Wydatki: model i liczenie podsumowań.
 *
 * Dane siedzą w Firestore, w podkolekcji `uzytkownicy/{uid}/wydatki` — jeden
 * wydatek to jeden dokument. Zapisują je formularz w apce i narzędzie
 * `npm run baza`. Tutaj są już tylko przekształcenia w pamięci: sumy,
 * podziały na kategorie i typy, porównania między miesiącami.
 */

import {
  kluczMiesiaca,
  miesiaceOd,
  skladkaFunduszu,
  type Plan,
} from './plan';
import {
  czyPozaBudzetem,
  KATEGORIE,
  KATEGORIA_DOMYSLNA,
  KATEGORIA_FIRMA,
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
  /** Chwila zapisu (ISO). Ustala kolejność wpisów z tego samego dnia. */
  dodano?: string;
};

/* ── Kolejność na listach ───────────────────────────────────
   Wpisy z jednego dnia mają stać w kolejności dopisywania. Samo `data` tego
   nie rozstrzyga (to tylko dzień), a Firestore oddaje dokumenty w kolejności
   losowych identyfikatorów — stąd brało się wrażenie porządku alfabetycznego.
   Dlatego drugim kluczem jest `dodano`. */

export type Chronologiczny = { data: string; dodano?: string };

/**
 * Od najnowszego: najpierw dzień, potem chwila zapisu w obrębie dnia.
 *
 * Wpisy sprzed wprowadzenia pola `dodano` lądują na końcu swojego dnia —
 * i słusznie, bo powstały wcześniej niż cokolwiek dopisanego później.
 */
export function odNajnowszych(a: Chronologiczny, b: Chronologiczny): number {
  return b.data.localeCompare(a.data) || (b.dodano ?? '').localeCompare(a.dodano ?? '');
}

export function kluczMiesiacaWydatku(w: Wydatek): string {
  return w.data.slice(0, 7);
}

/* ── Poza budżetem ──────────────────────────────────────────
   Fundusz nieregularny to osobne subkonto, osobna kieszeń: dentysta, opony,
   sprzęt, prezenty. Koszty firmy schodzą jeszcze wcześniej, z konta
   firmowego. Wszystko, co liczy „ile wydałem z budżetu", musi jedne i drugie
   pominąć — inaczej duży, rzadki zakup wyglądałby na przekroczony miesiąc,
   a przelew do ZUS-u policzyłby się drugi raz. Listę trzyma `POZA_BUDZETEM`
   w kategoriach. */

export function budzetowe(wydatki: Wydatek[]): Wydatek[] {
  return wydatki.filter((w) => !czyPozaBudzetem(w.kategoria));
}

export function funduszowe(wydatki: Wydatek[]): Wydatek[] {
  return wydatki.filter((w) => w.kategoria === KATEGORIA_FUNDUSZ);
}

/**
 * Koszty firmy zapisane mimo ostrzeżenia. Nie wchodzą do budżetu, ale nie
 * mogą też zniknąć bez śladu — kartę budżetu stać na jeden wiersz, żeby było
 * widać, że wpis gdzieś jest.
 */
export function firmowe(wydatki: Wydatek[]): Wydatek[] {
  return wydatki.filter((w) => w.kategoria === KATEGORIA_FIRMA);
}

/** Id kroku, którym odhaczasz przelew na fundusz — z planu, nie z kodu. */
export function krokFunduszu(plan: Plan): string | undefined {
  return plan.rozdysponowanie.kroki.find((k) => k.kwotaZ === 'fundusz')?.id;
}

export type StanFunduszu = {
  saldo: number;
  /** Co leżało na subkoncie przed startem planu. */
  startowe: number;
  /** Miesiące, w których przelew jest odhaczony. */
  skladki: number;
  wplacone: number;
  wydane: number;
  /** Miesiące od startu planu bez odhaczonego przelewu, od najstarszego. */
  zalegle: string[];
  /** Czy przelew za bieżący miesiąc jest już odhaczony. */
  biezacyZrobiony: boolean;
};

/**
 * Stan funduszu liczony z faktów, nie z założeń.
 *
 * Wcześniej saldo rosło samo: tyle miesięcy od startu planu razy składka —
 * apka zakładała, że każdy przelew się odbył. Przy pierwszym pominiętym
 * przelewie pokazywała pieniądze, których na subkoncie nie ma, i nie dało się
 * tego poprawić inaczej niż w bazie.
 *
 * Teraz składka wchodzi do salda dopiero wtedy, gdy odhaczysz przelew
 * w Rozdysponowaniu. Ten sam ptaszek, który mówi „zrobione", dokłada
 * pieniądze — jedno kliknięcie, jedno źródło prawdy.
 */
export function stanFunduszu(
  wydatki: Wydatek[],
  plan: Plan,
  kroki: Record<string, Record<string, boolean>>,
  dzis: Date = new Date(),
): StanFunduszu {
  const id = krokFunduszu(plan);
  const miesiace = miesiaceOd(plan.start, dzis);
  const biezacy = kluczMiesiaca(dzis);

  const odhaczone = id ? miesiace.filter((m) => kroki[m]?.[id]) : [];
  const startowe = plan.funduszSaldoStartowe ?? 0;
  const wplacone = odhaczone.reduce((s, m) => s + skladkaFunduszu(plan, m), 0);
  const wydane = funduszowe(wydatki).reduce((s, w) => s + w.kwota, 0);

  return {
    saldo: startowe + wplacone - wydane,
    startowe,
    skladki: odhaczone.length,
    wplacone,
    wydane,
    zalegle: id ? miesiace.filter((m) => m !== biezacy && !kroki[m]?.[id]) : [],
    biezacyZrobiony: Boolean(id && kroki[biezacy]?.[id]),
  };
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
