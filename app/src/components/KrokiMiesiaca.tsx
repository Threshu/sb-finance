'use client';

import {
  kluczMiesiaca,
  nazwaMiesiaca,
  krokiWgFaz,
  type KrokMiesiaca as Krok,
} from '@/lib/plan';
import { usePlan } from '@/lib/PlanKontekst';
import { Checklista } from './Checklista';

/**
 * Co trzeba zrobić w tym miesiącu poza rozdysponowaniem wpływu — warunki
 * promocji bankowych, dodatkowe wpłaty, podsumowanie miesiąca.
 *
 * Kwoty stoją wprost w planie: to nie są przelewy liczone z przepływu, tylko
 * progi z regulaminów („wpływ 1 000 zł"). Dlatego tu nie ma `kwotaZ`.
 */
export function KrokiMiesiaca({
  kroki,
  przelacz,
}: {
  kroki: Record<string, boolean>;
  przelacz: (krokId: string) => void;
}) {
  const plan = usePlan();
  const klucz = kluczMiesiaca(new Date());

  return (
    <Checklista<Krok>
      id="kroki-miesiaca"
      tytul={`Do zrobienia — ${nazwaMiesiaca(klucz)}`}
      opoznienie={120}
      // Tylko kroki obowiązujące w tym miesiącu — inaczej licznik liczyłby
      // też promocje, które jeszcze nie ruszyły.
      grupy={krokiWgFaz(plan, klucz)}
      odhaczone={kroki}
      przelacz={przelacz}
      kwota={(k) => k.kwota ?? null}
    />
  );
}
