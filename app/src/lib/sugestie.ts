/**
 * Podpowiedzi do formularza wydatku, liczone z historii.
 *
 * Wszystko tutaj wynika z `stan.wydatki`, czyli z Firestore — ani jedna nazwa
 * sklepu nie jest wpisana w kodzie. To nie jest wygoda, tylko wymóg: build stoi
 * na Firebase Hosting bez autoryzacji, więc nazwa własna w komponencie jest
 * nazwą własną opublikowaną w internecie.
 *
 * Podpowiadamy tylko to, co historia rozstrzyga. Kwoty nie podpowiadamy nigdy —
 * pokazujemy najwyżej, ile było ostatnio, jako tekst obok pola.
 */

import { odNajnowszych, type Wydatek } from './zakupy';

/** Do porównywania wpisanego tekstu z historią: „zabka" ma trafiać w „Żabka". */
export function bezOgonkow(tekst: string): string {
  return tekst
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** Najnowszy wpis wygrywa przy remisie liczności — nawyki się zmieniają. */
function nowszy(a: Wydatek, b: Wydatek): Wydatek {
  return odNajnowszych(a, b) <= 0 ? a : b;
}

/* ── Kafelki: najczęstsze kombinacje opis + kategoria + sklep ── */

export type CzestyWpis = {
  klucz: string;
  opis: string;
  kategoria?: string;
  sklep?: string;
  liczba: number;
  ostatniaKwota: number;
};

/**
 * Kombinacje, które powtórzyły się co najmniej `minimum` razy.
 *
 * Bez dolnego progu pierwszy z brzegu jednorazowy wydatek trafiałby na kafelek
 * i zajmował miejsce czemuś, co faktycznie kupujesz co tydzień.
 */
export function czesteWpisy(wydatki: Wydatek[], ile = 4, minimum = 3): CzestyWpis[] {
  const grupy = new Map<string, { wpisy: Wydatek[]; ostatni: Wydatek }>();

  for (const w of wydatki) {
    const klucz = `${w.opis}|${w.kategoria ?? ''}|${w.sklep ?? ''}`;
    const grupa = grupy.get(klucz);
    if (grupa) {
      grupa.wpisy.push(w);
      grupa.ostatni = nowszy(grupa.ostatni, w);
    } else {
      grupy.set(klucz, { wpisy: [w], ostatni: w });
    }
  }

  return [...grupy.entries()]
    .filter(([, g]) => g.wpisy.length >= minimum)
    .map(([klucz, g]) => ({
      klucz,
      opis: g.ostatni.opis,
      kategoria: g.ostatni.kategoria,
      sklep: g.ostatni.sklep,
      liczba: g.wpisy.length,
      ostatniaKwota: g.ostatni.kwota,
    }))
    .sort((a, b) => b.liczba - a.liczba || a.opis.localeCompare(b.opis, 'pl'))
    .slice(0, ile);
}

/* ── Sklep → kategoria ──────────────────────────────────────
   Kierunek jednoznaczny: w historii każdy sklep ma w praktyce jedną kategorię
   (spożywczy zostaje spożywczym). Dlatego tę stronę wolno uzupełniać samemu. */

export function kategoriaSklepu(wydatki: Wydatek[], sklep: string): string | undefined {
  const szukany = bezOgonkow(sklep);
  if (!szukany) return undefined;

  const liczniki = new Map<string, { ile: number; ostatni: Wydatek }>();
  for (const w of wydatki) {
    if (!w.sklep || !w.kategoria || bezOgonkow(w.sklep) !== szukany) continue;
    const wpis = liczniki.get(w.kategoria);
    if (wpis) {
      wpis.ile += 1;
      wpis.ostatni = nowszy(wpis.ostatni, w);
    } else {
      liczniki.set(w.kategoria, { ile: 1, ostatni: w });
    }
  }

  return [...liczniki.entries()].sort(
    (a, b) => b[1].ile - a[1].ile || b[1].ostatni.data.localeCompare(a[1].ostatni.data),
  )[0]?.[0];
}

/* ── Kategoria → sklepy ─────────────────────────────────────
   Kierunek NIEjednoznaczny: pod „spożywcze" trafia kilka sklepów naraz
   i żaden nie ma większości. Dlatego zwracamy listę do kliknięcia,
   a nie jedną odpowiedź do wstawienia. */

export function sklepyKategorii(wydatki: Wydatek[], kategoria: string, ile = 3): string[] {
  const liczniki = new Map<string, { ile: number; ostatni: Wydatek }>();
  for (const w of wydatki) {
    if (!w.sklep || w.kategoria !== kategoria) continue;
    const wpis = liczniki.get(w.sklep);
    if (wpis) {
      wpis.ile += 1;
      wpis.ostatni = nowszy(wpis.ostatni, w);
    } else {
      liczniki.set(w.sklep, { ile: 1, ostatni: w });
    }
  }

  return [...liczniki.entries()]
    .sort((a, b) => b[1].ile - a[1].ile || odNajnowszych(a[1].ostatni, b[1].ostatni))
    .slice(0, ile)
    .map(([nazwa]) => nazwa);
}

/* ── Listy do podpowiedzi w polach tekstowych ─────────────── */

/** Wszystkie sklepy z historii, od najczęstszego. Zasila `datalist` pola sklepu. */
export function wszystkieSklepy(wydatki: Wydatek[]): string[] {
  const liczniki = new Map<string, number>();
  for (const w of wydatki) {
    if (!w.sklep) continue;
    liczniki.set(w.sklep, (liczniki.get(w.sklep) ?? 0) + 1);
  }
  return [...liczniki.entries()].sort((a, b) => b[1] - a[1]).map(([nazwa]) => nazwa);
}

/**
 * Opisy z historii — zawężone do kategorii, gdy jakaś jest wybrana.
 * Bez zawężenia lista rośnie do kilkuset pozycji i przestaje pomagać.
 */
export function opisyKategorii(wydatki: Wydatek[], kategoria?: string, ile = 8): string[] {
  const liczniki = new Map<string, number>();
  for (const w of wydatki) {
    if (kategoria && w.kategoria !== kategoria) continue;
    liczniki.set(w.opis, (liczniki.get(w.opis) ?? 0) + 1);
  }
  return [...liczniki.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pl'))
    .slice(0, ile)
    .map(([opis]) => opis);
}

/**
 * Ile kosztowało ostatnim razem to samo w tym samym sklepie.
 *
 * Wyłącznie do pokazania obok pola. Nie wstawiamy tego w kwotę — koszyk
 * spożywczy jest za każdym razem inny, a wpisana z automatu liczba wygląda
 * jak sprawdzona i trafiłaby do statystyki bez czytania.
 */
export function ostatniaKwota(
  wydatki: Wydatek[],
  opis: string,
  sklep?: string,
): number | undefined {
  const szukanyOpis = bezOgonkow(opis);
  if (!szukanyOpis) return undefined;
  const szukanySklep = sklep ? bezOgonkow(sklep) : '';

  const pasujace = wydatki.filter(
    (w) =>
      bezOgonkow(w.opis) === szukanyOpis &&
      bezOgonkow(w.sklep ?? '') === szukanySklep,
  );
  if (pasujace.length === 0) return undefined;

  return pasujace.reduce(nowszy).kwota;
}
