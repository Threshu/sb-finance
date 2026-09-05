'use client';

import { createContext, useContext } from 'react';

/**
 * Który stan zwinięcia kart trzyma Firestore, nie karty same — inaczej każdy
 * komponent musiałby dostawać `zwiniete`/`przelacz` przez propsy z samej góry.
 */
type ZwinieciaApi = {
  zwiniete: Record<string, boolean>;
  przelacz: (id: string) => void;
};

const Kontekst = createContext<ZwinieciaApi | null>(null);

export function DostawcaZwiniec({
  zwiniete,
  przelacz,
  children,
}: ZwinieciaApi & { children: React.ReactNode }) {
  return <Kontekst.Provider value={{ zwiniete, przelacz }}>{children}</Kontekst.Provider>;
}

/** Domyślnie rozwinięta — brak wpisu w bazie nie znaczy "zwinięta". */
export function useZwiniecie(id: string): [boolean, () => void] {
  const ctx = useContext(Kontekst);
  if (!ctx) {
    throw new Error('useZwiniecie() poza DostawcaZwiniec.');
  }
  return [Boolean(ctx.zwiniete[id]), () => ctx.przelacz(id)];
}
