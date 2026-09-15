'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Plan } from './plan';
import { budzetowe, odNajnowszych, type Wydatek } from './zakupy';
import {
  firebaseWlaczony,
  obserwujUzytkownika,
  subskrybuj,
  subskrybujProfil,
  usunPozycje,
  zapiszPozycje,
  zapiszProfil,
} from './firebase';

export type ZrodloWplaty = 'plan' | 'dodatkowy';

export type Wplata = {
  id: string;
  data: string;
  kwota: number;
  zrodlo: ZrodloWplaty;
  opis: string;
  /** Chwila zapisu (ISO) — jak przy wydatkach, do kolejności w obrębie dnia. */
  dodano?: string;
};

// Model wydatku mieszka w `zakupy.ts` razem z liczeniem podsumowań.
// Tutaj tylko przechodzi dalej, żeby komponenty miały jedno miejsce importu.
export type { Wydatek };

/** Odhaczone kroki jednego miesiąca — jeden dokument `kroki/{RRRR-MM}`. */
type KrokiMiesiaca = { id: string } & Record<string, boolean | string>;

export type Stan = {
  wplaty: Wplata[];
  wydatki: Wydatek[];
  /** { "2026-09": { "przelewy": true, ... } } */
  kroki: Record<string, Record<string, boolean>>;
};

/*
 * Firestore jest jedynym magazynem — nie ma tu żadnego zapisu do localStorage.
 *
 * Kiedyś była druga ścieżka: bez zalogowania apka trzymała stan w pamięci
 * przeglądarki, a po zalogowaniu przenosiła go raz do bazy. Straciła sens
 * w dniu, w którym plan przeniósł się do Firestore — bez planu nie ma czego
 * pokazać, a planu nie da się wstawić inaczej niż przez bazę. Za offline
 * odpowiada trwały cache Firestore (`persistentLocalCache` w `firebase.ts`):
 * apka wstaje bez sieci, a zapisy zrobione offline wychodzą same po powrocie
 * połączenia.
 */

export function id(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/* ── Odczyty pochodne ───────────────────────────────────── */

/** Saldo poduszki: saldo startowe z planu plus wszystkie zapisane wpłaty. */
export function saldo(plan: Plan, stan: Stan): number {
  return stan.wplaty.reduce((s, w) => s + w.kwota, 0) + plan.saldoStartowe;
}

/** Wydatki z budżetu bieżącego. Fundusz nieregularny idzie z innej kieszeni. */
export function wydatkiMiesiaca(stan: Stan, klucz: string): number {
  return budzetowe(stan.wydatki)
    .filter((w) => w.data.startsWith(klucz))
    .reduce((s, w) => s + w.kwota, 0);
}

/* ── Hak stanu ──────────────────────────────────────────── */

export function useStan() {
  const [wydatki, ustawWydatki] = useState<Wydatek[]>([]);
  const [wplaty, ustawWplaty] = useState<Wplata[]>([]);
  const [kroki, ustawKroki] = useState<Record<string, Record<string, boolean>>>({});
  const [zwinieteKarty, ustawZwinieteKarty] = useState<Record<string, boolean>>({});
  const [gotowe, ustawGotowe] = useState(false);
  const [uid, ustawUid] = useState<string | null>(null);
  const [email, ustawEmail] = useState<string | null>(null);

  const stan = useMemo<Stan>(() => ({ wydatki, wplaty, kroki }), [wydatki, wplaty, kroki]);

  /* `gotowe` znaczy „wiadomo, kto jest zalogowany" — nie „dane przyszły".
     Bez tego ekran logowania nigdy by się nie pokazał, bo czekałby na dane,
     których wylogowany i tak nie dostanie. */
  useEffect(() => {
    if (!firebaseWlaczony) {
      ustawGotowe(true);
      return;
    }
    let anuluj = () => {};
    let aktywne = true;

    obserwujUzytkownika((u) => {
      if (!aktywne) return;
      ustawUid(u?.uid ?? null);
      ustawEmail(u?.email ?? null);
      ustawGotowe(true);
    }).then((u) => {
      anuluj = u;
    });

    return () => {
      aktywne = false;
      anuluj();
    };
  }, []);

  /* Nasłuch na żywo. Zapis z wiersza poleceń albo z drugiego urządzenia
     pojawia się tutaj sam, bez wylogowania i bez odświeżania strony. */
  useEffect(() => {
    if (!uid) {
      ustawWydatki([]);
      ustawWplaty([]);
      ustawKroki({});
      return;
    }
    let aktywne = true;
    const odsubskrybuj: (() => void)[] = [];

    async function podepnij(biezacyUid: string) {
      const [a, b, c] = await Promise.all([
        subskrybuj<Wydatek>(biezacyUid, 'wydatki', (poz) => {
          if (aktywne) ustawWydatki([...poz].sort(odNajnowszych));
        }),
        subskrybuj<Wplata>(biezacyUid, 'wplaty', (poz) => {
          if (aktywne) ustawWplaty([...poz].sort(odNajnowszych));
        }),
        subskrybuj<KrokiMiesiaca>(biezacyUid, 'kroki', (poz) => {
          if (!aktywne) return;
          const mapa: Record<string, Record<string, boolean>> = {};
          for (const { id: miesiac, ...pola } of poz) {
            mapa[miesiac] = Object.fromEntries(
              Object.entries(pola).filter(([, v]) => typeof v === 'boolean'),
            ) as Record<string, boolean>;
          }
          ustawKroki(mapa);
        }),
      ]);

      if (aktywne) odsubskrybuj.push(a, b, c);
      else [a, b, c].forEach((f) => f());
    }

    void podepnij(uid);
    return () => {
      aktywne = false;
      odsubskrybuj.forEach((f) => f());
    };
  }, [uid]);

  /* Zwinięte karty — osobny nasłuch, bo to pole dokumentu profilu,
     nie podkolekcja jak wydatki i wpłaty. */
  useEffect(() => {
    if (!uid) {
      ustawZwinieteKarty({});
      return;
    }
    let aktywne = true;
    let anuluj = () => {};

    subskrybujProfil(uid, (dane) => {
      if (aktywne) {
        ustawZwinieteKarty((dane.zwinieteKarty as Record<string, boolean>) ?? {});
      }
    }).then((f) => {
      anuluj = f;
    });

    return () => {
      aktywne = false;
      anuluj();
    };
  }, [uid]);

  /* ── Zapisy ───────────────────────────────────────────────
     Jeden dokument na zmianę, resztę dociąga nasłuch. Bez zalogowania
     nie ma dokąd pisać, więc zapisy po prostu nic nie robią — panel
     i tak się wtedy nie renderuje. */

  /**
   * Wpłata na poduszkę. `data` jest opcjonalna, ale potrzebna: przelew
   * robi się przy rozdysponowaniu, a wpisuje wieczorem albo nazajutrz —
   * bez tego pola każda wpłata siadałaby na dniu wpisania i miesiąc
   * zamykałby się z przesuniętą historią.
   */
  const dodajWplate = useCallback(
    (kwota: number, opis: string, zrodlo: ZrodloWplaty, data?: string) => {
      if (!uid) return;
      const w: Wplata = {
        id: id(),
        data: data || new Date().toISOString().slice(0, 10),
        kwota,
        zrodlo,
        opis,
        // Nie to samo co `data`: mówi, kiedy wpis trafił do bazy, i ustala
        // kolejność wpłat z tego samego dnia.
        dodano: new Date().toISOString(),
      };
      void zapiszPozycje(uid, 'wplaty', w.id, w);
    },
    [uid],
  );

  const usunWplate = useCallback(
    (wplataId: string) => {
      if (uid) void usunPozycje(uid, 'wplaty', wplataId);
    },
    [uid],
  );

  /**
   * Dopisanie wydatku z formularza.
   *
   * `sklep` i `data` są opcjonalne, ale nie kosmetyczne: bez sklepu nie działają
   * podpowiedzi „gdzie zwykle", a bez daty nie da się wieczorem dopisać czegoś
   * z wczoraj. Puste pole sklepu zostaje pominięte, nie zapisane jako pusty
   * napis — inaczej w podpowiedziach pojawiłaby się pozycja bez nazwy.
   */
  const dodajWydatek = useCallback(
    (kwota: number, opis: string, kategoria?: string, sklep?: string, data?: string) => {
      if (!uid) return;
      const w: Wydatek = {
        id: id(),
        data: data || new Date().toISOString().slice(0, 10),
        kwota,
        opis,
        kategoria,
        zrodlo: 'reczny',
        // Nie to samo co `data`: wieczorem można dopisać wczorajszy wydatek.
        // `data` mówi, kiedy było, `dodano` — kiedy trafiło do bazy.
        dodano: new Date().toISOString(),
      };
      const nazwaSklepu = sklep?.trim();
      if (nazwaSklepu) w.sklep = nazwaSklepu;

      void zapiszPozycje(uid, 'wydatki', w.id, w);
    },
    [uid],
  );

  const usunWydatek = useCallback(
    (wydatekId: string) => {
      if (uid) void usunPozycje(uid, 'wydatki', wydatekId);
    },
    [uid],
  );

  const przelaczKrok = useCallback(
    (klucz: string, krokId: string) => {
      if (!uid) return;
      const teraz = !(kroki[klucz]?.[krokId] ?? false);
      void zapiszPozycje(uid, 'kroki', klucz, { [krokId]: teraz });
    },
    [uid, kroki],
  );

  const przelaczZwiniecie = useCallback(
    (kartaId: string) => {
      if (!uid) return;
      const teraz = !(zwinieteKarty[kartaId] ?? false);
      // `merge` na zagnieżdżonej mapie — dwie karty zwinięte niemal
      // jednocześnie na telefonie i w przeglądarce nie kasują się nawzajem.
      void zapiszProfil(uid, { zwinieteKarty: { [kartaId]: teraz } });
    },
    [uid, zwinieteKarty],
  );

  return {
    stan,
    gotowe,
    uid,
    email,
    zwinieteKarty,
    przelaczZwiniecie,
    dodajWplate,
    usunWplate,
    dodajWydatek,
    usunWydatek,
    przelaczKrok,
  };
}
