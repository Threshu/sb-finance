/**
 * Typy planu i czyste funkcje liczące.
 *
 * Ten moduł CELOWO nie importuje planu z żadnego pliku. Wcześniej brał go
 * z `config/plan.local.json` i przez to wszystkie kwoty, daty i nazwy kont
 * lądowały w publicznym buildzie — Firebase Hosting serwuje pliki statyczne
 * bez żadnej autoryzacji, więc każdy, kto znał adres, widział cały plan
 * finansowy. Tamtego pliku już nie ma.
 *
 * Plan mieszka wyłącznie w Firestore, pod dokumentem właściciela, i trafia do
 * komponentów przez `usePlan()` z `PlanKontekst`. Funkcje niżej przyjmują go
 * jawnie jako argument — dzięki temu są czyste i dają się testować.
 */

export type Waga = 'niska' | 'srednia' | 'wysoka';

export type DataKluczowa = {
  data: string;
  tytul: string;
  opis: string;
  waga: Waga;
  /**
   * Nazwa banku, gdy termin dotyczy promocji albo oprocentowania konta.
   * Takie daty idą do zakładki Banki, reszta zostaje w panelu — inaczej koniec
   * promocji leżałby obok końca dopłat do kredytu i jedno przykrywało drugie.
   */
  bank?: string;
};

/** Jeden przelew w ramach kroku — ile, dokąd i po co. */
export type Pozycja = {
  /** null = kwota zmienna, liczona z planu na dany miesiąc. */
  kwota: number | null;
  dokad: string;
  poCo: string;
  uwaga?: string;
};

export type KrokMiesiaca = {
  id: string;
  /** Nagłówek grupy, np. „1. dnia miesiąca". */
  faza: string;
  tytul: string;
  opis: string;
  skad?: string;
  dokad?: string;
  kwota?: number;
  kiedy?: string;
  uwaga?: string;
  pozycje?: Pozycja[];
  /** Okno obowiązywania, RRRR-MM. Promocje bankowe mają daty ważności. */
  od?: string;
  do?: string;
};

/**
 * Jedna wypłata z promocji bankowej — bank ma termin, nie konkretny dzień.
 *
 * `id` musi być stałe, bo po nim zapisuje się odhaczenie „wpłynęło". Trzymamy
 * je w tej samej podkolekcji co kroki miesiąca (`kroki/{RRRR-MM}`), pod kluczem
 * miesiąca, w którym wypłata ma nastąpić — to ta sama operacja co odhaczenie
 * kroku, więc nie zasługiwała na osobny magazyn.
 */
export type WyplataPromocji = {
  id: string;
  /** RRRR-MM-DD — najpóźniejszy termin z regulaminu. */
  do: string;
  kwota: number;
  /** Za co ta transza, np. „za październik". */
  za: string;
};

/**
 * Promocja bankowa — jedna na bank, z warunkami i harmonogramem wypłat.
 *
 * Osobny byt od `krokiMiesiaca`, mimo że oba opisują to samo pilnowanie
 * warunków. Kroki odpowiadają na pytanie „co mam zrobić w tym miesiącu",
 * promocja — „ile z tego jeszcze wpadnie i kiedy". Przy jednym banku różnica
 * była nieistotna, przy pięciu kroki przestają się mieścić na ekranie, a suma
 * pieniędzy do odebrania ginie między nimi.
 */
export type Promocja = {
  id: string;
  bank: string;
  nazwa: string;
  /** Nazwa konta z regulaminu — przy sporze z bankiem to ona się liczy. */
  konto?: string;
  /** Okno miesięcy, w których trzeba spełniać warunki. RRRR-MM. */
  od?: string;
  do?: string;
  /** Co trzeba zrobić w każdym miesiącu okna. Krótkie hasła, nie zdania. */
  warunki: string[];
  /** Rzecz, o której łatwo zapomnieć — np. do kiedy nie wolno zamknąć konta. */
  uwaga?: string;
  wyplaty: WyplataPromocji[];
};

export type Obciazenie = {
  nazwa: string;
  kwota: number;
  termin: string;
  /**
   * Okno obowiązywania, RRRR-MM. Składka, która wchodzi dopiero za dwa
   * miesiące, tylko zaśmieca przepływ — a gdy wejdzie, ma się pojawić sama.
   */
  od?: string;
  do?: string;
};

export type Przeplyw = {
  zrodlo: string;
  /** Konto, na które wpływa faktura. Musi zgadzać się z `skad` kroków rozdysponowania. */
  konto: string;
  kwotaBrutto: number;
  obciazenia: Obciazenie[];
};

/**
 * Jeden krok rozdysponowania wpływu — do odhaczenia ręcznie, raz w miesiącu.
 * Osobny typ od KrokMiesiaca, bo tu każdy przelew jest własnym ptaszkiem.
 */
export type KrokRozdysponowania = {
  id: string;
  faza: string;
  tytul: string;
  opis: string;
  /** null = reszta po podatkach i pozostałych przelewach, liczona z planu. */
  kwota?: number | null;
  skad?: string;
  dokad?: string;
  kiedy?: string;
  uwaga?: string;
  /** YYYY-MM — krok pojawia się dopiero od tego miesiąca. */
  od?: string;
  /** YYYY-MM — ostatni miesiąc, w którym krok jest widoczny. */
  do?: string;
};

export type Rozdysponowanie = {
  wyzwalacz: string;
  kroki: KrokRozdysponowania[];
};

export type Kamien = {
  kwota: number;
  tytul: string;
  opis: string;
};

export type WarstwaPoduszki = {
  nazwa: string;
  docelowo: number;
  gdzie: string;
  oprocentowanie: string;
  dostep: string;
};

export type Plan = {
  start: string;
  saldoStartowe: number;
  cel: number;
  celMinimum: number;
  kosztyTwarde: number;
  budzetBiezacy: number;
  /** Budżet na wskazane miesiące, gdy różni się od `budzetBiezacy`. */
  budzetyWyjatki?: Record<string, number>;
  funduszNieregularny: number;
  /**
   * Ile fundusz ma unieść bez wysychania — największy pojedynczy wydatek
   * nieregularny, jaki realnie się zdarzył. Poniżej tego poziomu przelewasz
   * pełną składkę; trwałe przekroczenie rocznej sumy składek znaczy, że
   * składka jest za wysoka i nadwyżka powinna iść na poduszkę.
   */
  funduszPoziomRoboczy?: number;
  wplataMiesieczna: number;
  wplatyWyjatki: Record<string, number>;
  /**
   * Źródła dochodu spoza projekcji — przyspieszają zbieranie, ale nie są
   * w niej policzone. Nazwy MUSZĄ przychodzić z planu, nigdy z kodu: build
   * stoi na publicznym hostingu i wszystko, co wpisane w komponent, jest
   * jawne dla każdego, kto zna adres.
   */
  zrodlaDodatkowe?: string[];
  przeplyw: Przeplyw;
  kamienie: Kamien[];
  warstwyPoduszki: WarstwaPoduszki[];
  daty: DataKluczowa[];
  przegladyKwartalne: string[];
  rozdysponowanie: Rozdysponowanie;
  krokiMiesiaca: KrokMiesiaca[];
  /** Promocje bankowe. Pole opcjonalne — plan bez nich jest poprawny. */
  promocje?: Promocja[];
};

/* ── Walidacja ──────────────────────────────────────────────
   Plan wchodzi do bazy z wiersza poleceń (`npm run baza plan-zapisz`), gdzie
   nikt nie sprawdza jego kształtu. Dlatego sprawdzamy go tutaj, przy KAŻDYM
   wczytaniu z Firestore. Lepiej pokazać listę braków niż pozwolić apce paść
   na brakującym polu. */

export type WynikSprawdzenia =
  | { ok: true; plan: Plan }
  | { ok: false; bledy: string[] };

const LICZBY: (keyof Plan)[] = [
  'saldoStartowe',
  'cel',
  'celMinimum',
  'kosztyTwarde',
  'budzetBiezacy',
  'funduszNieregularny',
  'wplataMiesieczna',
];

const TABLICE: (keyof Plan)[] = ['kamienie', 'warstwyPoduszki', 'daty', 'przegladyKwartalne'];

export function sprawdzPlan(dane: unknown): WynikSprawdzenia {
  const bledy: string[] = [];

  if (typeof dane !== 'object' || dane === null) {
    return { ok: false, bledy: ['Plik nie zawiera obiektu JSON.'] };
  }
  const p = dane as Record<string, unknown>;

  for (const pole of LICZBY) {
    if (typeof p[pole] !== 'number' || Number.isNaN(p[pole])) {
      bledy.push(`Brakuje liczby „${pole}".`);
    }
  }
  for (const pole of TABLICE) {
    if (!Array.isArray(p[pole])) bledy.push(`Pole „${pole}" musi być listą.`);
  }
  // Na `start` stoi liczenie składek funduszu — zły format daje ciche NaN,
  // a nie błąd, więc saldo funduszu wyszłoby puste bez żadnego ostrzeżenia.
  if (typeof p.start !== 'string' || !/^\d{4}-\d{2}/.test(p.start)) {
    bledy.push('Pole „start" musi być datą w formacie RRRR-MM-DD.');
  }
  if (typeof p.wplatyWyjatki !== 'object' || p.wplatyWyjatki === null) {
    bledy.push('Pole „wplatyWyjatki" musi być obiektem.');
  }
  if (p.budzetyWyjatki !== undefined && (typeof p.budzetyWyjatki !== 'object' || p.budzetyWyjatki === null)) {
    bledy.push('Pole „budzetyWyjatki" musi być obiektem.');
  }
  if (!Array.isArray(p.krokiMiesiaca) || p.krokiMiesiaca.length === 0) {
    bledy.push('Brakuje kroków miesiąca.');
  }

  const przeplyw = p.przeplyw as Przeplyw | undefined;
  if (!przeplyw || typeof przeplyw.kwotaBrutto !== 'number' || !Array.isArray(przeplyw.obciazenia)) {
    bledy.push('Sekcja „przeplyw" jest niekompletna.');
  }

  const rozdysponowanie = p.rozdysponowanie as Rozdysponowanie | undefined;
  if (!rozdysponowanie || !Array.isArray(rozdysponowanie.kroki)) {
    bledy.push('Sekcja „rozdysponowanie" jest niekompletna.');
  }

  // Promocje są opcjonalne, ale jeśli są — muszą mieć wypłaty z terminem
  // i kwotą, bo na nich stoi cała arytmetyka „ile zostało do odebrania".
  const promocje = p.promocje;
  if (promocje !== undefined) {
    if (!Array.isArray(promocje)) {
      bledy.push('Pole „promocje" musi być listą.');
    } else {
      for (const [i, sur] of promocje.entries()) {
        const pr = sur as Promocja | undefined;
        const gdzie = pr?.id ? `promocja „${pr.id}"` : `promocja nr ${i + 1}`;
        if (!pr?.id || !pr.bank || !pr.nazwa) {
          bledy.push(`${gdzie}: wymagane są „id", „bank" i „nazwa".`);
        }
        if (!Array.isArray(pr?.warunki)) bledy.push(`${gdzie}: „warunki" muszą być listą.`);
        if (!Array.isArray(pr?.wyplaty)) {
          bledy.push(`${gdzie}: „wyplaty" muszą być listą.`);
          continue;
        }
        for (const w of pr.wyplaty) {
          if (!w?.id || typeof w.kwota !== 'number') {
            bledy.push(`${gdzie}: wypłata bez „id" albo bez liczbowej „kwota".`);
          }
          if (typeof w?.do !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(w.do)) {
            bledy.push(`${gdzie}: wypłata „${w?.id}" — „do" musi być datą RRRR-MM-DD.`);
          }
        }
      }
    }
  }

  // Zdublowane identyfikatory rozsypałyby odhaczanie — kroki i wypłaty siedzą
  // w tej samej podkolekcji `kroki/{RRRR-MM}`, więc liczą się do jednej puli.
  const idKrokow = [
    ...(Array.isArray(p.krokiMiesiaca) ? (p.krokiMiesiaca as KrokMiesiaca[]) : []),
    ...(rozdysponowanie?.kroki ?? []),
    ...(Array.isArray(promocje) ? (promocje as Promocja[]) : []).flatMap((pr) => pr?.wyplaty ?? []),
  ].map((k) => k?.id);
  // Które id — bez tego zostaje ręczne przeszukiwanie planu po omacku.
  const powtorzone = [...new Set(idKrokow.filter((id, i) => idKrokow.indexOf(id) !== i))];
  if (powtorzone.length) {
    bledy.push(`Powtórzone identyfikatory („id"): ${powtorzone.join(', ')}.`);
  }

  if (typeof p.cel === 'number' && typeof p.celMinimum === 'number' && p.celMinimum > p.cel) {
    bledy.push('„celMinimum" jest większe niż „cel".');
  }

  return bledy.length ? { ok: false, bledy } : { ok: true, plan: dane as Plan };
}

/* ── Daty — nie potrzebują planu ────────────────────────────── */

/** Klucz miesiąca w formacie YYYY-MM. */
export function kluczMiesiaca(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MIESIACE = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
];

const MIESIACE_MIANOWNIK = [
  'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień',
];

/** "2027-08" -> "sierpień 2027" */
export function nazwaMiesiaca(klucz: string): string {
  const [rok, mies] = klucz.split('-');
  return `${MIESIACE_MIANOWNIK[Number(mies) - 1]} ${rok}`;
}

/** "2026-10-31" -> "31 października 2026" */
export function nazwaDaty(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()} ${MIESIACE[d.getMonth()]} ${d.getFullYear()}`;
}

export function dniDo(iso: string, od: Date = new Date()): number {
  const cel = new Date(iso + 'T00:00:00').getTime();
  const teraz = new Date(od.getFullYear(), od.getMonth(), od.getDate()).getTime();
  return Math.round((cel - teraz) / 86_400_000);
}

/* ── Liczenie — plan wchodzi jawnie ─────────────────────────── */

/** Planowana wpłata w danym miesiącu (z uwzględnieniem wyjątków, np. ulgi na start). */
export function wplataDlaMiesiaca(plan: Plan, klucz: string): number {
  return plan.wplatyWyjatki[klucz] ?? plan.wplataMiesieczna;
}

/**
 * Budżet obowiązujący w danym miesiącu.
 *
 * Podniesienie samego `budzetBiezacy` przestawiłoby też miesiące zamknięte —
 * wrzesień rozliczałby się nagle z budżetu ustalonego w listopadzie i całe
 * „ile wydałem wobec budżetu" przestaje mieć sens wstecz.
 */
export function budzetDlaMiesiaca(plan: Plan, klucz: string): number {
  return plan.budzetyWyjatki?.[klucz] ?? plan.budzetBiezacy;
}

/** Ile miesięcy przetrwasz bez dochodu przy twardych kosztach. */
export function miesiacePrzetrwania(plan: Plan, saldo: number): number {
  return saldo / plan.kosztyTwarde;
}

/**
 * Czy pozycja obowiązuje w danym miesiącu.
 *
 * Promocje bankowe, ulgi i składki mają daty ważności. Pozycja bez `od` i `do`
 * obowiązuje zawsze — większość taka jest, więc brak pól znaczy „bezterminowo".
 */
function wOknie(x: { od?: string; do?: string }, klucz: string): boolean {
  return (!x.od || x.od <= klucz) && (!x.do || x.do >= klucz);
}

/** Kroki obowiązujące w danym miesiącu. */
export function krokiMiesiacaWOknie(plan: Plan, klucz: string): KrokMiesiaca[] {
  return plan.krokiMiesiaca.filter((k) => wOknie(k, klucz));
}

/** Kroki pogrupowane po fazie, z zachowaniem kolejności z konfiguracji. */
export function krokiWgFaz(
  plan: Plan,
  klucz: string,
): { faza: string; kroki: KrokMiesiaca[] }[] {
  const grupy: { faza: string; kroki: KrokMiesiaca[] }[] = [];
  for (const krok of krokiMiesiacaWOknie(plan, klucz)) {
    const ostatnia = grupy[grupy.length - 1];
    if (ostatnia && ostatnia.faza === krok.faza) ostatnia.kroki.push(krok);
    else grupy.push({ faza: krok.faza, kroki: [krok] });
  }
  return grupy;
}

/** Obciążenia obowiązujące w danym miesiącu. */
export function obciazeniaMiesiaca(plan: Plan, klucz: string): Obciazenie[] {
  return plan.przeplyw.obciazenia.filter((o) => wOknie(o, klucz));
}

/* ── Promocje bankowe ───────────────────────────────────────── */

/** Wypłata z doklejonym bankiem — lista wypłat sama w sobie nie mówi, czyja jest. */
export type WyplataZBanku = WyplataPromocji & { bank: string; promocjaId: string };

/**
 * Odhaczenia wypłat leżą w `kroki/{RRRR-MM}` pod kluczem miesiąca terminu.
 * Funkcja jest tu, a nie w komponencie, bo ten sam klucz liczy zapis i odczyt —
 * rozjazd między nimi dawałby ptaszki, które znikają po odświeżeniu.
 */
export function miesiacWyplaty(w: WyplataPromocji): string {
  return w.do.slice(0, 7);
}

export function czyOdebrana(
  w: WyplataPromocji,
  kroki: Record<string, Record<string, boolean>>,
): boolean {
  return Boolean(kroki[miesiacWyplaty(w)]?.[w.id]);
}

/** Wszystkie wypłaty ze wszystkich promocji, od najbliższego terminu. */
export function wyplatyPromocji(plan: Plan): WyplataZBanku[] {
  return (plan.promocje ?? [])
    .flatMap((p) => p.wyplaty.map((w) => ({ ...w, bank: p.bank, promocjaId: p.id })))
    .sort((a, b) => a.do.localeCompare(b.do));
}

export type StanPromocji = {
  /** Suma wszystkich transz w planie. */
  lacznie: number;
  odebrane: number;
  /** Ile jeszcze wpadnie, jeśli warunki będą spełniane. */
  zostalo: number;
  /** Najbliższa nieodebrana wypłata — null, gdy nie ma już żadnej. */
  najblizsza: WyplataZBanku | null;
};

export function stanPromocji(
  plan: Plan,
  kroki: Record<string, Record<string, boolean>>,
): StanPromocji {
  const wszystkie = wyplatyPromocji(plan);
  let lacznie = 0;
  let odebrane = 0;
  for (const w of wszystkie) {
    lacznie += w.kwota;
    if (czyOdebrana(w, kroki)) odebrane += w.kwota;
  }
  return {
    lacznie,
    odebrane,
    zostalo: lacznie - odebrane,
    najblizsza: wszystkie.find((w) => !czyOdebrana(w, kroki)) ?? null,
  };
}

/**
 * Czy w danym miesiącu trzeba spełniać warunki tej promocji.
 * Promocja bez okna liczy się jako zawsze aktywna — tak samo jak kroki.
 */
export function promocjaAktywna(p: Promocja, klucz: string): boolean {
  return wOknie(p, klucz);
}

/** Ile transz z tej promocji zostało do odebrania. */
export function zostaloZPromocji(
  p: Promocja,
  kroki: Record<string, Record<string, boolean>>,
): { kwota: number; sztuk: number } {
  const niezebrane = p.wyplaty.filter((w) => !czyOdebrana(w, kroki));
  return {
    kwota: niezebrane.reduce((s, w) => s + w.kwota, 0),
    sztuk: niezebrane.length,
  };
}

/** Ile zostaje na koncie firmowym po odłożeniu podatków. */
export function poPodatkach(plan: Plan, klucz = kluczMiesiaca(new Date())): number {
  const suma = obciazeniaMiesiaca(plan, klucz).reduce((s, o) => s + o.kwota, 0);
  return plan.przeplyw.kwotaBrutto - suma;
}

/**
 * Ile realnie zostaje na poduszkę: wpływ minus podatki, budżet i fundusz.
 * Może się różnić od `wplataDlaMiesiaca` — ta jest planem, ta liczba
 * wynika z bieżących szacunków podatków.
 */
export function resztaNaPoduszke(
  plan: Plan,
  klucz = kluczMiesiaca(new Date()),
  funduszPelny = false,
): number {
  const skladka = funduszPelny ? 0 : plan.funduszNieregularny;
  return poPodatkach(plan, klucz) - budzetDlaMiesiaca(plan, klucz) - skladka;
}

/**
 * Kroki rozdysponowania widoczne w danym miesiącu.
 * `od` i `do` przełączają listę w czasie — np. zakupy obligacji ruszają
 * dopiero w styczniu 2027, gdy wchodzi OKI.
 */
export function krokiRozdysponowania(plan: Plan, klucz: string): KrokRozdysponowania[] {
  return plan.rozdysponowanie.kroki.filter((k) => wOknie(k, klucz));
}

/** Kroki rozdysponowania pogrupowane po fazie, z zachowaniem kolejności. */
export function rozdysponowanieWgFaz(
  plan: Plan,
  klucz: string,
): { faza: string; kroki: KrokRozdysponowania[] }[] {
  const grupy: { faza: string; kroki: KrokRozdysponowania[] }[] = [];
  for (const krok of krokiRozdysponowania(plan, klucz)) {
    const ostatnia = grupy[grupy.length - 1];
    if (ostatnia && ostatnia.faza === krok.faza) ostatnia.kroki.push(krok);
    else grupy.push({ faza: krok.faza, kroki: [krok] });
  }
  return grupy;
}

export type StanKamienia = {
  kamien: Kamien;
  osiagniety: boolean;
  /** 0–1, postęp w obrębie tego kamienia. */
  postep: number;
  /** Ile jeszcze brakuje. 0 gdy osiągnięty. */
  brakuje: number;
  /** Pierwszy nieosiągnięty kamień. */
  nastepny: boolean;
};

/** Stan wszystkich kamieni milowych przy danym saldzie. */
export function stanKamieni(plan: Plan, saldo: number): StanKamienia[] {
  let pierwszyOtwarty = true;
  return plan.kamienie.map((kamien, i) => {
    const poprzedni = i === 0 ? 0 : plan.kamienie[i - 1].kwota;
    const osiagniety = saldo >= kamien.kwota;
    const zakres = kamien.kwota - poprzedni;
    const postep = osiagniety ? 1 : Math.max(0, Math.min(1, (saldo - poprzedni) / zakres));
    const nastepny = !osiagniety && pierwszyOtwarty;
    if (!osiagniety) pierwszyOtwarty = false;
    return {
      kamien,
      osiagniety,
      postep,
      brakuje: osiagniety ? 0 : kamien.kwota - saldo,
      nastepny,
    };
  });
}

export type Projekcja = {
  /** Miesiąc, w którym saldo osiąga cel. null, jeśli nie osiąga w 120 miesięcy. */
  miesiacCelu: string | null;
  miesiecyDoCelu: number | null;
  /** Miesiąc osiągnięcia minimum bezpieczeństwa. */
  miesiacMinimum: string | null;
  miesiecyDoMinimum: number | null;
};

/**
 * Projekcja w przód od dzisiejszego salda, przy planowanych wpłatach.
 * Nie zakłada żadnych dodatkowych wpływów — te tylko przyspieszają.
 */
export function projekcja(plan: Plan, saldo: number, od: Date = new Date()): Projekcja {
  let biezace = saldo;
  const kursor = new Date(od.getFullYear(), od.getMonth(), 1);
  let miesiacCelu: string | null = null;
  let miesiecyDoCelu: number | null = null;
  let miesiacMinimum: string | null = null;
  let miesiecyDoMinimum: number | null = null;

  if (biezace >= plan.celMinimum) {
    miesiacMinimum = kluczMiesiaca(kursor);
    miesiecyDoMinimum = 0;
  }
  if (biezace >= plan.cel) {
    return {
      miesiacCelu: kluczMiesiaca(kursor),
      miesiecyDoCelu: 0,
      miesiacMinimum,
      miesiecyDoMinimum,
    };
  }

  for (let i = 1; i <= 120; i++) {
    kursor.setMonth(kursor.getMonth() + 1);
    const klucz = kluczMiesiaca(kursor);
    biezace += wplataDlaMiesiaca(plan, klucz);

    if (miesiacMinimum === null && biezace >= plan.celMinimum) {
      miesiacMinimum = klucz;
      miesiecyDoMinimum = i;
    }
    if (biezace >= plan.cel) {
      miesiacCelu = klucz;
      miesiecyDoCelu = i;
      break;
    }
  }

  return { miesiacCelu, miesiecyDoCelu, miesiacMinimum, miesiecyDoMinimum };
}

/**
 * O ile dni przyspieszy cel, jeśli dorzucisz dodatkową kwotę.
 * Liczone jako kwota podzielona przez dzienne tempo oszczędzania.
 */
export function przyspieszenieWDniach(plan: Plan, kwota: number): number {
  const dzienneTempo = plan.wplataMiesieczna / 30.44;
  if (dzienneTempo <= 0) return 0;
  return Math.round(kwota / dzienneTempo);
}
