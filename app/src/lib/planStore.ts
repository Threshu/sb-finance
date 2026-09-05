'use client';

import { useEffect, useState } from 'react';
import { sprawdzPlan, type Plan } from './plan';
import { subskrybujPlan } from './firebase';

export type StanPlanu =
  /** Jeszcze nie wiadomo — czekamy na pierwszą odpowiedź z bazy. */
  | 'sprawdzam'
  /** Zalogowany, ale w bazie nie ma planu. */
  | 'brak'
  | 'gotowy'
  | 'blad';

/**
 * Plan właściciela, nasłuchiwany z Firestore po zalogowaniu.
 *
 * Nasłuch, a nie jednorazowe pobranie: dzięki temu `npm run baza plan-zapisz`
 * widać na telefonie od razu, tak samo jak dopisany wydatek. Wcześniej plan
 * wymagał odświeżenia strony i był jedyną rzeczą, która się tak zachowywała.
 *
 * Offline obsługuje trwały cache Firestore — pierwsze wywołanie przychodzi
 * z cache'a, więc panel pojawia się bez rundy do serwera. Osobnej kopii planu
 * w localStorage tu nie ma i nie powinno być: cały plan leżałby wtedy jawnie
 * w pamięci przeglądarki drugi raz, bez żadnego zysku.
 */
export function useZdalnyPlan(uid: string | null) {
  const [plan, ustawPlan] = useState<Plan | null>(null);
  const [stan, ustawStan] = useState<StanPlanu>('sprawdzam');
  const [blad, ustawBlad] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      // Wylogowany — plan znika z pamięci, żeby nie został na cudzym urządzeniu.
      ustawPlan(null);
      ustawBlad(null);
      ustawStan('sprawdzam');
      return;
    }

    let aktywne = true;
    let anuluj = () => {};

    subskrybujPlan<unknown>(
      uid,
      (surowy) => {
        if (!aktywne) return;
        if (!surowy) {
          ustawStan('brak');
          return;
        }
        // Walidacja przy każdym wczytaniu, nie tylko przy zapisie — plan wchodzi
        // do bazy z wiersza poleceń, gdzie nikt go nie sprawdza.
        const wynik = sprawdzPlan(surowy);
        if (wynik.ok) {
          ustawPlan(wynik.plan);
          ustawBlad(null);
          ustawStan('gotowy');
        } else {
          ustawBlad(`Plan w bazie jest niepoprawny: ${wynik.bledy.join(' ')}`);
          ustawStan('blad');
        }
      },
      (e) => {
        if (!aktywne) return;
        ustawBlad(e.message);
        ustawStan('blad');
      },
    ).then((f) => {
      anuluj = f;
    });

    return () => {
      aktywne = false;
      anuluj();
    };
  }, [uid]);

  return { plan, stan, blad };
}
