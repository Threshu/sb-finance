'use client';

import {
  budzetDlaMiesiaca,
  kluczMiesiaca,
  nazwaMiesiaca,
  obciazeniaMiesiaca,
  resztaNaPoduszke,
  rozdysponowanieWgFaz,
  skladkaFunduszu,
  wplataDlaMiesiaca,
  type KrokRozdysponowania,
  type Plan,
} from '@/lib/plan';
import { krokFunduszu } from '@/lib/zakupy';
import { usePlan } from '@/lib/PlanKontekst';
import { Checklista } from './Checklista';
import { zl } from '@/lib/format';

/**
 * Kwota kroku. Żadna liczba nie stoi w kroku drugi raz — krok mówi tylko,
 * skąd ją wziąć, a plan trzyma ją w jednym miejscu:
 *
 *   kwotaZ: 'budzet'     → budżet tego miesiąca (z wyjątkami)
 *   kwotaZ: 'fundusz'    → składka na fundusz nieregularny
 *   kwotaZ: 'obciazenie' → obciążenie z przepływu, po nazwie
 *   kwota: null          → reszta po podatkach, budżecie i funduszu,
 *                          opcjonalnie pomnożona przez `udzial`
 *
 * `null` w wyniku znaczy „ten krok nie ma kwoty", nie „zero złotych".
 */
function kwotaKroku(
  plan: Plan,
  krok: KrokRozdysponowania,
  klucz: string,
  funduszPelny: boolean,
): number | null {
  if (krok.kwotaZ === 'budzet') return budzetDlaMiesiaca(plan, klucz);
  if (krok.kwotaZ === 'fundusz') return skladkaFunduszu(plan, klucz);
  if (krok.kwotaZ === 'obciazenie') {
    // Po nazwie, w oknie tego miesiąca — dwa obciążenia o tej samej nazwie
    // (stawka stara i nowa) nigdy nie są widoczne naraz.
    return obciazeniaMiesiaca(plan, klucz).find((o) => o.nazwa === krok.obciazenie)?.kwota ?? null;
  }
  if (krok.kwota === undefined) return null;
  if (krok.kwota === null) {
    return resztaNaPoduszke(plan, klucz, funduszPelny) * (krok.udzial ?? 1);
  }
  return krok.kwota;
}

/**
 * Checklista rozdysponowania wpływu — robiona raz w miesiącu, w dniu,
 * w którym pieniądze wpłyną na konto firmowe. Każdy przelew ma własny
 * ptaszek, bo odhaczanie po jednym jest jedynym sposobem, żeby żaden
 * nie wypadł. Stan trzyma się per miesiąc, więc lista zeruje się sama.
 */
export function Rozdysponowanie({
  kroki,
  przelacz,
  funduszPelny,
}: {
  kroki: Record<string, boolean>;
  przelacz: (krokId: string) => void;
  /** Fundusz osiągnął poziom roboczy — składka odpada, całość idzie na poduszkę. */
  funduszPelny: boolean;
}) {
  const plan = usePlan();
  const klucz = kluczMiesiaca(new Date());

  // Który krok jest przelewem na fundusz, mówi plan (`kwotaZ: 'fundusz'`),
  // a nie identyfikator wpisany tutaj na sztywno.
  const idFunduszu = krokFunduszu(plan);
  const pomin = (k: KrokRozdysponowania) => !(funduszPelny && k.id === idFunduszu);

  const grupy = rozdysponowanieWgFaz(plan, klucz)
    .map((g) => ({ ...g, kroki: g.kroki.filter(pomin) }))
    .filter((g) => g.kroki.length > 0);

  const reszta = resztaNaPoduszke(plan, klucz, funduszPelny);
  const wgPlanu = wplataDlaMiesiaca(plan, klucz);
  const roznica = reszta - wgPlanu;

  return (
    <Checklista<KrokRozdysponowania>
      id="rozdysponowanie"
      tytul={`Rozdysponowanie wpływu — ${nazwaMiesiaca(klucz)}`}
      opoznienie={90}
      grupy={grupy}
      odhaczone={kroki}
      przelacz={przelacz}
      kwota={(k) => kwotaKroku(plan, k, klucz, funduszPelny)}
      przed={<p className="notka wyzwalacz">{plan.rozdysponowanie.wyzwalacz}</p>}
      po={
        Math.abs(roznica) >= 10 ? (
          <p className="notka roznica">
            Plan zakłada {zl(wgPlanu)} na poduszkę, a z bieżących szacunków podatków wychodzi{' '}
            {zl(reszta)} — różnica {zl(Math.abs(roznica))}. Przelewasz tyle, ile realnie zostało.
          </p>
        ) : null
      }
    />
  );
}
