'use client';

import { createContext, useContext } from 'react';
import type { Plan } from './plan';

/**
 * Plan nie jest już importowany z pliku — przychodzi z Firestore po zalogowaniu.
 * Kontekst niesie go do komponentów, żeby nie przekazywać go ręcznie przez
 * kilka poziomów propsów.
 */
const KontekstPlanu = createContext<Plan | null>(null);

export function DostawcaPlanu({ plan, children }: { plan: Plan; children: React.ReactNode }) {
  return <KontekstPlanu.Provider value={plan}>{children}</KontekstPlanu.Provider>;
}

/**
 * Zwraca plan. Rzuca, jeśli go nie ma — to celowe: komponenty panelu renderują
 * się wyłącznie wtedy, gdy plan jest już wczytany, więc brak planu tutaj
 * oznaczałby błąd w układzie strony, a nie zwykły stan przejściowy.
 */
export function usePlan(): Plan {
  const plan = useContext(KontekstPlanu);
  if (!plan) {
    throw new Error(
      'usePlan() poza DostawcaPlanu — komponent panelu wyrenderował się przed wczytaniem planu.',
    );
  }
  return plan;
}
