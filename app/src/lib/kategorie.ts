/**
 * Katalog kategorii wydatków.
 *
 * Nie jest wymyślony — powstał z przeglądu historii rachunku osobistego
 * za 2025 i 2026 (ok. 10 600 transakcji wychodzących). Kategorie odpowiadają
 * temu, co faktycznie się w niej powtarza, a nie ogólnemu schematowi
 * z aplikacji budżetowych.
 *
 * Kluczowy jest podział na `typ`, nie sama kategoria. Oszczędza się na
 * wydatkach uznaniowych i częściowo na zmiennych. Stałe da się zmienić
 * dopiero decyzją (wypowiedzenie umowy, nadpłata kredytu), nie codziennym
 * pilnowaniem — dlatego wykresy pokazują je osobno.
 */

export type TypWydatku =
  /** Umowa albo zobowiązanie. Zmienia się decyzją, nie samokontrolą. */
  | 'staly'
  /** Konieczne, ale kwota zależy od zachowania. */
  | 'zmienny'
  /** Można nie wydać i nic się nie stanie. Tutaj szuka się oszczędności. */
  | 'uznaniowy';

export type Kategoria = {
  id: string;
  nazwa: string;
  typ: TypWydatku;
};

export const KATEGORIE: Kategoria[] = [
  { id: 'spozywcze', nazwa: 'Spożywcze', typ: 'zmienny' },
  { id: 'jedzenie-poza-domem', nazwa: 'Jedzenie na mieście', typ: 'uznaniowy' },
  // Osobno od spożywczych celowo. Cola i chipsy ze sklepu po drodze to nie
  // są zakupy na jedzenie — to impuls, który w koszyku spożywczym znika
  // z oczu, a jest jedną z niewielu pozycji do skasowania bez konsekwencji.
  { id: 'przekaski', nazwa: 'Przekąski i napoje', typ: 'uznaniowy' },
  { id: 'dom', nazwa: 'Dom i rachunki', typ: 'staly' },
  { id: 'transport', nazwa: 'Transport i paliwo', typ: 'zmienny' },
  // Noclegi w podróży do pracy. Osobno od transportu, bo paliwo ma własną
  // linię w budżecie, a nocleg własną — zlane w jedno nie dają odpowiedzi
  // na pytanie, ile naprawdę kosztuje dojeżdżanie.
  { id: 'wyjazdy', nazwa: 'Wyjazdy i noclegi', typ: 'zmienny' },
  { id: 'zdrowie', nazwa: 'Zdrowie i leki', typ: 'zmienny' },
  { id: 'uroda', nazwa: 'Fryzjer i uroda', typ: 'uznaniowy' },
  // Traktowane jako inwestycja w siebie, nie luksus — konieczne jak leki,
  // tyle że kwota zależy od zachowania (ile razy pójdziesz, co kupisz).
  { id: 'sport', nazwa: 'Sport i rekreacja', typ: 'zmienny' },
  { id: 'suplementy', nazwa: 'Suplementy', typ: 'zmienny' },
  { id: 'subskrypcje', nazwa: 'Subskrypcje', typ: 'staly' },
  // Koszty JDG, które i tak przechodzą przez to samo konto — księgowość,
  // narzędzia firmowe. Osobno od subskrypcji, bo to inny rodzaj kosztu
  // (prowadzenie firmy), nie osobista usługa.
  { id: 'firma', nazwa: 'Firma', typ: 'staly' },
  { id: 'rozrywka', nazwa: 'Rozrywka i gry', typ: 'uznaniowy' },
  { id: 'zaklady', nazwa: 'Zakłady i gry losowe', typ: 'uznaniowy' },
  { id: 'sprzet', nazwa: 'Rzeczy i sprzęt', typ: 'uznaniowy' },
  { id: 'ubrania', nazwa: 'Ubrania i buty', typ: 'uznaniowy' },
  { id: 'ubezpieczenia', nazwa: 'Ubezpieczenia', typ: 'staly' },
  { id: 'kredyt', nazwa: 'Kredyt i raty', typ: 'staly' },
  { id: 'prezenty', nazwa: 'Prezenty', typ: 'uznaniowy' },
  { id: 'oplaty', nazwa: 'Opłaty i prowizje', typ: 'zmienny' },
  { id: 'inne', nazwa: 'Inne', typ: 'zmienny' },
  // Idzie z subkonta, nie z budżetu bieżącego — stąd osobna obsługa wszędzie,
  // gdzie liczy się „ile wydałem w tym miesiącu".
  { id: 'fundusz', nazwa: 'Z funduszu nieregularnego', typ: 'zmienny' },
];

export const KATEGORIA_DOMYSLNA = 'inne';

/** Wydatki z tej kategorii stoją poza budżetem bieżącym. */
export const KATEGORIA_FUNDUSZ = 'fundusz';

const WG_ID = new Map(KATEGORIE.map((k) => [k.id, k]));

export function kategoria(id: string | undefined): Kategoria {
  return WG_ID.get(id ?? '') ?? WG_ID.get(KATEGORIA_DOMYSLNA)!;
}

export function typKategorii(id: string | undefined): TypWydatku {
  return kategoria(id).typ;
}

/* ── Kolory ─────────────────────────────────────────────────
   Skala, nie trzy równorzędne barwy: typ wydatku idzie od „nie ruszysz"
   do „możesz nie wydać", więc kolor też ma iść w jedną stronę. Trzy osobne
   barwy sugerowałyby, że są równoważne, a przy daltonizmie i tak by się
   zlały — brąz i zieleń z motywu apki nie przechodzą testu rozróżnialności.

   Każda para różni się na DWÓCH osiach naraz, bo sama jasność nie wystarcza —
   trzy jej kroki na ciemnym tle nie zmieszczą się w 3:1 na krok (górny
   musiałby być jaśniejszy od bieli), a dwa odcienie tej samej szarości i tak
   się gryzą:

     uznaniowe ↔ konieczne     jasność 2,0:1, oba ciepłe
     konieczne ↔ zobowiązania  jasność 1,9:1 + ciepłe kontra zimne
     uznaniowe ↔ zobowiązania  jasność 3,9:1 + żółty kontra niebieski

   Złoto dostaje tylko część uznaniowa, bo to jedyna, na którą masz wpływ.
   Zobowiązania są jedynym zimnym kolorem w apce i to jest zamierzone:
   pieniądze związane umową mają wyglądać na odległe. Skrajne pola dzieli oś
   żółty–niebieski, czyli ta, która przechodzi każdy rodzaj daltonizmu.

   Historia: #e6b455 / #b98a45 / #736b60 miały 1,6:1 między sąsiadami i się
   zlewały; potem trzy ciepłe odcienie — kontrast wyszedł, ale dwie szarości
   nadal gryzły się ze sobą. */
export const KOLOR_TYPU: Record<TypWydatku, string> = {
  uznaniowy: '#f0c56a',
  zmienny: '#9a8d7d',
  staly: '#4f6275',
};

/* Nazwa mówi, czym to zmienisz, a nie czy kwota jest co miesiąc taka sama.
   „Stałe" myliło: rachunek za gaz jest zobowiązaniem, ale kwota skacze. */
export const NAZWA_TYPU: Record<TypWydatku, string> = {
  staly: 'Zobowiązania',
  zmienny: 'Konieczne',
  uznaniowy: 'Uznaniowe',
};

/** Kolejność do wykresów — od tego, co da się ciąć, do tego, co nie. */
export const TYPY: TypWydatku[] = ['uznaniowy', 'zmienny', 'staly'];

/* ── Rozpoznawanie kategorii po opisie ──────────────────────
   Wyłącznie nazwy ogólnopolskie i słowa opisowe — nic, co wskazywałoby
   na konkretną osobę.

   To nie jest nadmiarowa ostrożność. Build stoi na Firebase Hosting, który
   serwuje pliki statyczne bez żadnej autoryzacji, więc każdy, kto zna adres,
   czyta tę listę. Lista ułożona pod czyjąś historię rachunku zdradzałaby
   jego miasto (lokalny fryzjer, miejski ośrodek sportu), leki, które bierze,
   u kogo się ubezpiecza i gdzie obstawia — a to wynika już z samego faktu,
   że dana nazwa się tutaj znalazła.

   Rozpoznawanie jest tylko wygodą przy ręcznym dopisywaniu wydatku w apce.
   Wydatki wgrywane z pliku mają kategorię wpisaną wprost, więc nic nie tracimy.
   Pierwsza pasująca reguła wygrywa — węższe wzorce idą przed szerszymi. */

const REGULY: { kategoria: string; slowa: string[] }[] = [
  {
    kategoria: 'zaklady',
    slowa: ['bukmach', 'zaklady wzajemne', 'zakłady wzajemne', 'kupon', 'lotto', 'totalizator'],
  },
  {
    kategoria: 'wyjazdy',
    slowa: ['hotel', 'motel', 'nocleg', 'hostel', 'pensjonat'],
  },
  // Przed subskrypcjami — "abonament" inaczej wpadłby tam.
  // Bez nazwy konkretnego biura rachunkowego: repozytorium jest publiczne,
  // a sama obecność marki na liście mówi, z czyich usług ktoś korzysta.
  {
    kategoria: 'firma',
    slowa: ['ksiegowosc', 'księgowość', 'biuro rachunkowe', 'koszt firmowy', 'zus ', 'jpk'],
  },
  {
    kategoria: 'subskrypcje',
    slowa: [
      'youtube',
      'apple.com/bill',
      'canal+',
      'netflix',
      'spotify',
      'hbo',
      'disney',
      'tvn',
      'player',
      'icloud',
      'google one',
      'chatgpt',
      'openai',
      'anthropic',
      'claude',
      'subskrypcja',
      'abonament',
    ],
  },
  {
    kategoria: 'rozrywka',
    slowa: ['playstation', 'steam', 'xbox', 'nintendo', 'kino', 'teatr', 'koncert', 'gra '],
  },
  // Przed spożywczymi — inaczej „cola z Dino" wpadłaby do zakupów na jedzenie.
  {
    kategoria: 'przekaski',
    slowa: [
      'cola',
      'pepsi',
      'napoj',
      'napój',
      'energetyk',
      'monster',
      'chipsy',
      'paluszki',
      'baton',
      'słodycze',
      'slodycze',
      'guma do żucia',
      'przekaska',
      'przekąska',
      'lody',
      'piwo',
      'papierosy',
    ],
  },
  {
    kategoria: 'spozywcze',
    slowa: [
      'zabka',
      'żabka',
      'biedronka',
      'lidl',
      'dino',
      'aldi',
      'kaufland',
      'lewiatan',
      'carrefour',
      'auchan',
      'netto',
      'stokrotka',
      'delikatesy',
      'piekarnia',
      'warzywniak',
      'spozyw',
      'spożyw',
      'zakupy spozywcze',
    ],
  },
  {
    kategoria: 'jedzenie-poza-domem',
    slowa: [
      'mcdonald',
      'kfc',
      'burger',
      'kebab',
      'pizzeria',
      'pizza',
      'restauracja',
      'bar ',
      'pub',
      'bistro',
      'kawiarnia',
      'kawa',
      'starbucks',
      'costa',
      'pyszne',
      'glovo',
      'uber eats',
      'wolt',
      'obiad',
      'lunch',
      'pierogi',
      'vending',
      'automat',
    ],
  },
  {
    kategoria: 'transport',
    slowa: [
      'stacja paliw',
      'orlen',
      'bp ',
      'shell',
      'circle k',
      'mol ',
      'lotos',
      'paliwo',
      'tankowanie',
      'myjnia',
      'autopay',
      'viatoll',
      'autostrada',
      'parking',
      'spp ',
      'strefa platnego',
      'intercity',
      'koleo',
      'pkp',
      'bilet',
      'mpk',
      'uber',
      'bolt',
      'taxi',
      'flixbus',
      'serwis',
      'opony',
      'mechanik',
      'przeglad',
      'przegląd',
    ],
  },
  {
    kategoria: 'suplementy',
    slowa: [
      'kreatyna',
      'suplement',
      'bialko',
      'białko',
      'whey',
      'witamina',
      'witaminy',
      'magnez',
      'omega-3',
      'omega 3',
      'multiwitamina',
      'proteina',
    ],
  },
  {
    kategoria: 'zdrowie',
    slowa: [
      'apteka',
      'dentysta',
      'stomatolog',
      'lekarz',
      'przychodnia',
      'lek ',
      'lekarstw',
      'nfz',
      'rehabilit',
      'okulista',
      'badania',
      'wizyta',
    ],
  },
  {
    kategoria: 'uroda',
    slowa: ['barber', 'fryzjer', 'strzyżenie', 'strzyzenie', 'kosmetyk', 'rossmann', 'hebe'],
  },
  {
    kategoria: 'sport',
    slowa: [
      'gym',
      'silownia',
      'siłownia',
      'fitness',
      'basen',
      'orlik',
      'karnet',
      'sedziowsk',
      'sędziowsk',
      'klub sportowy',
    ],
  },
  {
    kategoria: 'ubrania',
    slowa: ['sizeer', 'zalando', 'h&m', 'reserved', 'ccc', 'deichmann', 'nike', 'adidas', 'buty', 'odziez', 'odzież'],
  },
  {
    kategoria: 'sprzet',
    slowa: [
      'allegro',
      'ikea',
      'rtv euro agd',
      'media expert',
      'terg',
      'x-kom',
      'morele',
      'castorama',
      'leroy',
      'obi ',
      'jysk',
      'action',
      'pepco',
      'inpost',
      'paczka',
      'kurier',
    ],
  },
  {
    kategoria: 'prezenty',
    slowa: ['kwiaciarnia', 'kwiaty', 'bukiecik', 'prezent', 'upominek'],
  },
  {
    kategoria: 'ubezpieczenia',
    slowa: ['ubezpiecz', 'polisa', 'skladka', 'składka', 'oc ', 'ac '],
  },
  {
    kategoria: 'kredyt',
    slowa: ['kredyt', 'rata', 'splata', 'spłata', 'hipotek', 'pozyczka', 'pożyczka', 'leasing'],
  },
  {
    kategoria: 'dom',
    slowa: [
      'orange',
      'play ',
      't-mobile',
      'plus ',
      'internet',
      'telefon',
      'prad',
      'prąd',
      'enea',
      'tauron',
      'energa',
      'pgnig',
      'gaz',
      'woda',
      'wodociag',
      'wodociąg',
      'czynsz',
      'wspolnota',
      'wspólnota',
      'odpady',
      'nieczystosci',
      'nieczystości',
      'smieci',
      'śmieci',
      'podatek od nieruchom',
    ],
  },
  {
    kategoria: 'oplaty',
    slowa: ['prowizja', 'prow. za', 'oplata za pakiet', 'przewalutowanie', 'quasi cash', 'oplata bankowa'],
  },
];

/**
 * Zgaduje kategorię z opisu wydatku. Zwraca `undefined`, gdy nic nie pasuje —
 * lepiej zostawić puste i dopytać, niż wpisać zły wiersz do statystyki.
 */
export function rozpoznajKategorie(opis: string): string | undefined {
  const tekst = ` ${opis.toLowerCase()} `;
  for (const regula of REGULY) {
    if (regula.slowa.some((s) => tekst.includes(s))) return regula.kategoria;
  }
  return undefined;
}
