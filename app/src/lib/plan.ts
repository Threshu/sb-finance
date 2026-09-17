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

export type KrokMiesiaca = {
  id: string;
  /** Nagłówek grupy, np. „1. dnia miesiąca". */
  faza: string;
  tytul: string;
  opis: string;
  skad?: string;
  dokad?: string;
  kwota?: number;
  uwaga?: string;
  /** Okno obowiązywania, RRRR-MM. Promocje bankowe mają daty ważności. */
  od?: string;
  do?: string;
  /**
   * Nazwa fazy w Rozdysponowaniu, gdy ten krok ma być widoczny także tam.
   *
   * Przelewy pod promocje (1 000 zł na Alior, BNP, ING) robi się tego samego
   * dnia co przelewy z firmowego, ale pilnuje ich zakładka Banki — razem
   * z warunkami i harmonogramem wypłat. Zamiast wpisywać je w plan dwa razy,
   * ten sam krok pokazuje się w obu miejscach: jedno `id`, jeden ptaszek,
   * jeden dokument `kroki/{RRRR-MM}`. Odhaczenie tu i tam to ta sama zmiana.
   */
  wRozdysponowaniu?: string;
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
   * Kiedy ta kwota realnie wychodzi z konta — a nie kiedy się „należy".
   *
   *   'rezerwa' (domyślne) — płacisz ręcznie na początku NASTĘPNEGO miesiąca,
   *      po mailu z biura z twardymi kwotami. 15. odkładasz na to rezerwę.
   *   'automat' — schodzi samo, bez twojego udziału (abonament księgowości
   *      na koniec miesiąca). Do rezerwy nie wchodzi, bo nie ma jej po co
   *      przelewać — zostaje na koncie, z którego pobiera je dostawca.
   */
  platne?: 'rezerwa' | 'automat';
  /**
   * Okno obowiązywania, RRRR-MM. Składka, która wchodzi dopiero za dwa
   * miesiące, tylko zaśmieca przepływ — a gdy wejdzie, ma się pojawić sama.
   */
  od?: string;
  do?: string;
};

/**
 * Wpływ i to, co z niego schodzi, zanim pieniądze staną się twoje.
 * Nie ma tu konta docelowego — trasę przelewu trzyma każdy krok
 * rozdysponowania osobno (`skad`/`dokad`), a dwa zapisy tej samej rzeczy
 * rozjeżdżały się przy pierwszej zmianie banku.
 */
export type Przeplyw = {
  zrodlo: string;
  kwotaBrutto: number;
  /**
   * Faktura bywa inna niż typowa — niepełny miesiąc, dwie faktury, przerwa.
   * Wpisz tu miesiąc i prawdziwą kwotę (`{"2026-09": 11333.33}`), a cała
   * checklista przeliczy się sama: podatki zostają, reszta na poduszkę
   * schodzi o tyle, o ile faktycznie mniej wpłynęło.
   */
  kwotaBruttoWyjatki?: Record<string, number>;
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
  /**
   * Skąd wziąć kwotę, zamiast wpisywać ją w kroku drugi raz.
   *
   * Każda liczba w planie ma mieszkać w jednym miejscu. Przelew budżetowy
   * stał tu kiedyś jako 7 100 zł w miesiącu, w którym budżet wynosił 7 663 —
   * checklista kazała przelać za mało, a reszta na poduszkę liczyła się już
   * od prawdziwego budżetu, więc różnica wychodziła jako „nieprzypisane".
   * Ten sam błąd czekał na ryczałcie: krok miał 1 377 zł bez okna czasowego,
   * a od października stawka rośnie.
   *
   *   'budzet'     — budżet miesiąca, razem z `budzetyWyjatki`
   *   'fundusz'    — składka na fundusz nieregularny
   *   'obciazenie' — obciążenie z przepływu, wskazane polem `obciazenie`
   *   'rezerwa'    — suma obciążeń miesiąca płatnych ręcznie, czyli tyle,
   *                  ile trzeba odłożyć 15. na podatki płacone za trzy
   *                  tygodnie. Nie stoi nigdzie wpisana: zmiana stawki
   *                  ryczałtu przestawia ją sama.
   */
  kwotaZ?: 'budzet' | 'fundusz' | 'obciazenie' | 'rezerwa';
  /**
   * Przy `kwotaZ: 'obciazenie'` — weź kwotę z POPRZEDNIEGO miesiąca.
   *
   * Podatki płaci się za miesiąc zamknięty: mail z biura przychodzi
   * na początku następnego miesiąca i dopiero wtedy idzie przelew.
   * W listopadzie płacisz więc ryczałt za październik, nie za listopad.
   * Bez tego pola krok pokazywałby stawkę o miesiąc do przodu — a stawki
   * w planie zmieniają się w oknach `od`/`do`, więc różnica bywa spora.
   */
  zaPoprzedniMiesiac?: boolean;
  /**
   * Ułamek reszty przy `kwota: null` — np. 0.25 na część płynną poduszki
   * i 0.75 na obligacje. Dzielona jest reszta, nie planowana wpłata, więc
   * przelewy zawsze sumują się do tego, co faktycznie zostało.
   */
  udzial?: number;
  /** Nazwa obciążenia z `przeplyw.obciazenia` — używane przy `kwotaZ: 'obciazenie'`. */
  obciazenie?: string;
  skad?: string;
  dokad?: string;
  uwaga?: string;
  /** YYYY-MM — krok pojawia się dopiero od tego miesiąca. */
  od?: string;
  /** YYYY-MM — ostatni miesiąc, w którym krok jest widoczny. */
  do?: string;
};

export type Rozdysponowanie = {
  /** Zdanie nad listą: co uruchamia tę checklistę. Pole opcjonalne. */
  wyzwalacz?: string;
  kroki: KrokRozdysponowania[];
};

export type Kamien = {
  /** Kwota wpisana wprost. Pomijana, gdy stoi `podstawa`. */
  kwota?: number;
  /**
   * Kwota liczona z planu, żeby nie stała tu drugi raz:
   *
   *   'kosztyTwarde' × `razy` — „miesiąc oddechu", „kwartał"
   *   'celMinimum'            — próg sześciu miesięcy
   *   'cel'                   — koniec etapu
   *
   * Podniesienie kosztów twardych przesuwa wtedy kamienie samo, zamiast
   * zostawiać progi policzone od starej kwoty.
   */
  podstawa?: 'kosztyTwarde' | 'cel' | 'celMinimum';
  razy?: number;
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
   * Co leżało na subkoncie w dniu startu planu. Bez tego pola fundusz zaczyna
   * od zera, a składki sprzed `start` nie mają jak wejść do salda — tak samo
   * jak `saldoStartowe` dla poduszki.
   */
  funduszSaldoStartowe?: number;
  /** Wyjątki składki funduszu w pojedynczych miesiącach, jak `budzetyWyjatki`. */
  funduszWyjatki?: Record<string, number>;
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
  for (const pole of ['budzetyWyjatki', 'funduszWyjatki'] as const) {
    const v = p[pole];
    if (v !== undefined && (typeof v !== 'object' || v === null)) {
      bledy.push(`Pole „${pole}" musi być obiektem.`);
    }
  }
  if (!Array.isArray(p.krokiMiesiaca) || p.krokiMiesiaca.length === 0) {
    bledy.push('Brakuje kroków miesiąca.');
  }

  const przeplyw = p.przeplyw as Przeplyw | undefined;
  if (!przeplyw || typeof przeplyw.kwotaBrutto !== 'number' || !Array.isArray(przeplyw.obciazenia)) {
    bledy.push('Sekcja „przeplyw" jest niekompletna.');
  }

  /* Warstwy dzielą docelową poduszkę. Gdy przestaną się sumować do celu,
     karta kamieni pokazuje podział, który nie prowadzi tam, gdzie trzeba —
     a to widać dopiero po zsumowaniu w głowie. */
  if (Array.isArray(p.warstwyPoduszki) && typeof p.cel === 'number') {
    const suma = (p.warstwyPoduszki as WarstwaPoduszki[]).reduce((a, w) => a + (w?.docelowo ?? 0), 0);
    if (suma !== p.cel) {
      bledy.push(`Warstwy poduszki sumują się do ${suma}, a cel to ${p.cel}.`);
    }
  }

  const rozdysponowanie = p.rozdysponowanie as Rozdysponowanie | undefined;
  if (!rozdysponowanie || !Array.isArray(rozdysponowanie.kroki)) {
    bledy.push('Sekcja „rozdysponowanie" jest niekompletna.');
  } else {
    /* Krok bierze kwotę z obciążenia po nazwie. Literówka w nazwie nie
       wywala apki — krok po prostu stoi bez kwoty, czyli po cichu przestaje
       mówić, ile przelać. Lepiej złapać to tutaj. */
    const nazwy = new Set((przeplyw?.obciazenia ?? []).map((o) => o.nazwa));
    for (const k of rozdysponowanie.kroki) {
      if (k.udzial !== undefined) {
        if (k.kwota !== null) {
          bledy.push(`Krok „${k.id}": „udzial" działa tylko przy „kwota: null" (dzieli resztę).`);
        }
        if (typeof k.udzial !== 'number' || k.udzial <= 0 || k.udzial > 1) {
          bledy.push(`Krok „${k.id}": „udzial" musi być ułamkiem z przedziału (0, 1].`);
        }
      }
      if (k.zaPoprzedniMiesiac && k.kwotaZ !== 'obciazenie') {
        bledy.push(
          `Krok „${k.id}": „zaPoprzedniMiesiac" działa tylko przy „kwotaZ: obciazenie".`,
        );
      }
      if (k.kwotaZ !== 'obciazenie') continue;
      if (!k.obciazenie) {
        bledy.push(`Krok „${k.id}": przy „kwotaZ: obciazenie" trzeba podać pole „obciazenie".`);
      } else if (!nazwy.has(k.obciazenie)) {
        bledy.push(`Krok „${k.id}": w przepływie nie ma obciążenia „${k.obciazenie}".`);
      }
    }

    /* Krok miesiąca dopięty do Rozdysponowania wskazuje fazę po nazwie.
       Literówka nie wywala apki — przelew ląduje w osobnej grupie na dole
       listy, pod nagłówkiem, którego nikt nie planował. Łatwiej złapać tutaj. */
    const fazy = new Set(rozdysponowanie.kroki.map((k) => k.faza));
    for (const k of Array.isArray(p.krokiMiesiaca) ? (p.krokiMiesiaca as KrokMiesiaca[]) : []) {
      if (k?.wRozdysponowaniu && !fazy.has(k.wRozdysponowaniu)) {
        bledy.push(
          `Krok „${k.id}": w rozdysponowaniu nie ma fazy „${k.wRozdysponowaniu}".`,
        );
      }
    }
  }

  /* Obciążenie bez poprawnego „platne" po cichu wpadłoby do rezerwy
     podatkowej albo z niej wypadło — a to jest kwota przelewu z 15. */
  for (const o of przeplyw?.obciazenia ?? []) {
    if (o?.platne !== undefined && o.platne !== 'rezerwa' && o.platne !== 'automat') {
      bledy.push(`Obciążenie „${o?.nazwa}": „platne" musi być „rezerwa" albo „automat".`);
    }
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

/** Poprzedni miesiąc w formacie RRRR-MM. */
export function poprzedniMiesiac(klucz: string): string {
  const [rok, miesiac] = klucz.split('-').map(Number);
  return kluczMiesiaca(new Date(rok, miesiac - 2, 1));
}

export function dniDo(iso: string, od: Date = new Date()): number {
  const cel = new Date(iso + 'T00:00:00').getTime();
  const teraz = new Date(od.getFullYear(), od.getMonth(), od.getDate()).getTime();
  return Math.round((cel - teraz) / 86_400_000);
}

/* ── Liczenie — plan wchodzi jawnie ─────────────────────────── */

/**
 * Kwota miesięczna: stawka podstawowa albo wyjątek na ten jeden miesiąc.
 *
 * Podniesienie samej stawki przestawiłoby też miesiące zamknięte — wrzesień
 * rozliczałby się nagle z budżetu ustalonego w listopadzie i całe „ile
 * wydałem wobec budżetu" przestaje mieć sens wstecz. Dlatego każda kwota,
 * która może się różnić w pojedynczym miesiącu, ma ten sam kształt:
 * stawka + tabela wyjątków.
 */
function kwotaMiesiaca(
  podstawa: number,
  wyjatki: Record<string, number> | undefined,
  klucz: string,
): number {
  return wyjatki?.[klucz] ?? podstawa;
}

/** Wpływ na konto firmowe w danym miesiącu — plan albo prawdziwa faktura. */
function wplywDlaMiesiaca(plan: Plan, klucz: string): number {
  return kwotaMiesiaca(plan.przeplyw.kwotaBrutto, plan.przeplyw.kwotaBruttoWyjatki, klucz);
}

/** Planowana wpłata na poduszkę w danym miesiącu. */
export function wplataDlaMiesiaca(plan: Plan, klucz: string): number {
  return kwotaMiesiaca(plan.wplataMiesieczna, plan.wplatyWyjatki, klucz);
}

/** Budżet bieżący obowiązujący w danym miesiącu. */
export function budzetDlaMiesiaca(plan: Plan, klucz: string): number {
  return kwotaMiesiaca(plan.budzetBiezacy, plan.budzetyWyjatki, klucz);
}

/** Składka na fundusz nieregularny w danym miesiącu. */
export function skladkaFunduszu(plan: Plan, klucz: string): number {
  return kwotaMiesiaca(plan.funduszNieregularny, plan.funduszWyjatki, klucz);
}

/**
 * Klucze miesięcy od startu planu do dziś włącznie.
 * Na tym stoi liczenie funduszu: sprawdzamy miesiąc po miesiącu, czy przelew
 * został odhaczony, zamiast zakładać, że każdy się odbył.
 */
export function miesiaceOd(start: string, dzis: Date = new Date()): string[] {
  const [rok, miesiac] = start.slice(0, 7).split('-').map(Number);
  const klucze: string[] = [];
  const d = new Date(rok, miesiac - 1, 1);
  const koniec = new Date(dzis.getFullYear(), dzis.getMonth(), 1);
  while (d <= koniec) {
    klucze.push(kluczMiesiaca(d));
    d.setMonth(d.getMonth() + 1);
  }
  return klucze;
}

/**
 * Jak daleko w przód liczy apka. Dziesięć lat: dłuższa projekcja przy tym
 * tempie i tak nie mówi nic sensownego, a „poza zasięgiem" jest uczciwszą
 * odpowiedzią niż data w 2050 roku.
 */
export const HORYZONT_MIESIECY = 120;

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
function poPodatkach(plan: Plan, klucz = kluczMiesiaca(new Date())): number {
  const suma = obciazeniaMiesiaca(plan, klucz).reduce((s, o) => s + o.kwota, 0);
  return wplywDlaMiesiaca(plan, klucz) - suma;
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
  const skladka = funduszPelny ? 0 : skladkaFunduszu(plan, klucz);
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

/**
 * Ile odłożyć 15. na podatki — suma obciążeń, które płacisz sam.
 *
 * Abonament księgowości (`platne: 'automat'`) schodzi z konta bez twojego
 * udziału ostatniego dnia miesiąca, więc nie ma go po co przelewać na bok;
 * zostaje tam, gdzie go pobiorą. Reszta — ryczałt, zdrowotna, ZUS — czeka
 * trzy tygodnie na mail z twardymi kwotami i dopiero wtedy wychodzi.
 */
export function rezerwaPodatkowa(plan: Plan, klucz: string): number {
  return obciazeniaMiesiaca(plan, klucz)
    .filter((o) => o.platne !== 'automat')
    .reduce((s, o) => s + o.kwota, 0);
}

/** Krok widoczny w Rozdysponowaniu: własny albo dopięty z kroków miesiąca. */
export type KrokListyRozdysponowania = KrokRozdysponowania | KrokMiesiaca;

/**
 * Id kroku, którym odhaczasz przelew budżetowy — z planu, nie z kodu.
 * Tak samo jak `krokFunduszu`: karta budżetu nie ma własnego ptaszka,
 * tylko czyta ten sam, co Rozdysponowanie.
 */
export function krokBudzetu(plan: Plan): string | undefined {
  return plan.rozdysponowanie.kroki.find((k) => k.kwotaZ === 'budzet')?.id;
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

/**
 * To samo co `rozdysponowanieWgFaz`, plus kroki miesiąca oznaczone polem
 * `wRozdysponowaniu` — dopięte do fazy o tej nazwie.
 *
 * Przelewy pod promocje bankowe robi się w ten sam dzień co przelewy
 * z firmowego, więc muszą być na tej samej liście; warunki i harmonogram
 * wypłat zostają w zakładce Banki. Krok jest jeden, `id` jedno, dokument
 * `kroki/{RRRR-MM}` jeden — odhaczenie w którymkolwiek miejscu widać od razu
 * w drugim. Skopiowanie kroku do obu list dawałoby dwa ptaszki na jeden
 * przelew i cichy rozjazd liczników.
 */
export function fazyRozdysponowania(
  plan: Plan,
  klucz: string,
): { faza: string; kroki: KrokListyRozdysponowania[] }[] {
  const grupy: { faza: string; kroki: KrokListyRozdysponowania[] }[] =
    rozdysponowanieWgFaz(plan, klucz).map((g) => ({ faza: g.faza, kroki: [...g.kroki] }));

  for (const krok of krokiMiesiacaWOknie(plan, klucz)) {
    if (!krok.wRozdysponowaniu) continue;
    const grupa = grupy.find((g) => g.faza === krok.wRozdysponowaniu);
    if (grupa) grupa.kroki.push(krok);
    else grupy.push({ faza: krok.wRozdysponowaniu, kroki: [krok] });
  }
  return grupy;
}

export type StanKamienia = {
  kamien: Kamien;
  /** Próg po rozwinięciu `podstawy` — to jest liczba do pokazania. */
  prog: number;
  osiagniety: boolean;
  /** 0–1, postęp w obrębie tego kamienia. */
  postep: number;
  /** Ile jeszcze brakuje. 0 gdy osiągnięty. */
  brakuje: number;
  /** Pierwszy nieosiągnięty kamień. */
  nastepny: boolean;
};

/** Próg kamienia: wpisany wprost albo policzony z planu. */
function kwotaKamienia(plan: Plan, kamien: Kamien): number {
  switch (kamien.podstawa) {
    case 'kosztyTwarde':
      return plan.kosztyTwarde * (kamien.razy ?? 1);
    case 'celMinimum':
      return plan.celMinimum;
    case 'cel':
      return plan.cel;
    default:
      return kamien.kwota ?? 0;
  }
}

/** Stan wszystkich kamieni milowych przy danym saldzie. */
export function stanKamieni(plan: Plan, saldo: number): StanKamienia[] {
  let pierwszyOtwarty = true;
  return plan.kamienie.map((kamien, i) => {
    const prog = kwotaKamienia(plan, kamien);
    const poprzedni = i === 0 ? 0 : kwotaKamienia(plan, plan.kamienie[i - 1]);
    const osiagniety = saldo >= prog;
    const zakres = prog - poprzedni;
    const postep = osiagniety ? 1 : Math.max(0, Math.min(1, (saldo - poprzedni) / zakres));
    const nastepny = !osiagniety && pierwszyOtwarty;
    if (!osiagniety) pierwszyOtwarty = false;
    return {
      kamien,
      prog,
      osiagniety,
      postep,
      brakuje: osiagniety ? 0 : prog - saldo,
      nastepny,
    };
  });
}

export type Projekcja = {
  /** Miesiąc, w którym saldo osiąga cel. null, jeśli nie osiąga w horyzoncie. */
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

  for (let i = 1; i <= HORYZONT_MIESIECY; i++) {
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
