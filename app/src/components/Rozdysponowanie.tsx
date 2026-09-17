'use client';

import {
  budzetDlaMiesiaca,
  fazyRozdysponowania,
  kluczMiesiaca,
  nazwaMiesiaca,
  obciazeniaMiesiaca,
  poprzedniMiesiac,
  resztaNaPoduszke,
  rezerwaPodatkowa,
  skladkaFunduszu,
  type KrokListyRozdysponowania,
  type Plan,
} from '@/lib/plan';
import { krokFunduszu } from '@/lib/zakupy';
import { usePlan } from '@/lib/PlanKontekst';
import { Checklista } from './Checklista';
import { zl } from '@/lib/format';
import type { Wplata } from '@/lib/store';

/**
 * Kwota kroku. Żadna liczba nie stoi w kroku drugi raz — krok mówi tylko,
 * skąd ją wziąć, a plan trzyma ją w jednym miejscu:
 *
 *   kwotaZ: 'budzet'     → budżet tego miesiąca (z wyjątkami)
 *   kwotaZ: 'fundusz'    → składka na fundusz nieregularny
 *   kwotaZ: 'rezerwa'    → suma obciążeń płatnych ręcznie, czyli ile odłożyć
 *   kwotaZ: 'obciazenie' → obciążenie z przepływu, po nazwie; z
 *                          `zaPoprzedniMiesiac` — z miesiąca wcześniej
 *   kwota: null          → reszta po podatkach, budżecie i funduszu,
 *                          opcjonalnie pomnożona przez `udzial`
 *
 * `null` w wyniku znaczy „ten krok nie ma kwoty", nie „zero złotych".
 */
function kwotaKroku(
  plan: Plan,
  krok: KrokListyRozdysponowania,
  klucz: string,
  funduszPelny: boolean,
): number | null {
  // Kroki miesiąca dopięte z zakładki Banki nie mają `kwotaZ` — mają
  // wpisaną kwotę albo nie mają żadnej (1 000 zł na Alior, 5 płatności).
  if ('kwotaZ' in krok && krok.kwotaZ) {
    if (krok.kwotaZ === 'budzet') return budzetDlaMiesiaca(plan, klucz);
    if (krok.kwotaZ === 'fundusz') return skladkaFunduszu(plan, klucz);
    if (krok.kwotaZ === 'rezerwa') return rezerwaPodatkowa(plan, klucz);
    if (krok.kwotaZ === 'obciazenie') {
      // Po nazwie, w oknie właściwego miesiąca — dwa obciążenia o tej samej
      // nazwie (stawka stara i nowa) nigdy nie są widoczne naraz. Podatki
      // płaci się za miesiąc zamknięty, stąd `zaPoprzedniMiesiac`.
      const zaKtory = krok.zaPoprzedniMiesiac ? poprzedniMiesiac(klucz) : klucz;
      return obciazeniaMiesiaca(plan, zaKtory).find((o) => o.nazwa === krok.obciazenie)?.kwota ?? null;
    }
  }
  if (krok.kwota === undefined) return null;
  if (krok.kwota === null) {
    const udzial = ('udzial' in krok && krok.udzial) || 1;
    return resztaNaPoduszke(plan, klucz, funduszPelny) * udzial;
  }
  return krok.kwota;
}

/**
 * Checklista rozdysponowania wpływu.
 *
 * Nie jest robiona jednego dnia, choć długo tak wyglądała. Miesiąc ma trzy
 * różne momenty i lista idzie teraz w ich kolejności: na początku miesiąca
 * płacisz podatki za miesiąc zamknięty (twarde kwoty przychodzą mailem
 * z biura, zwykle między 2. a 10.), 15. wpływa faktura i rozchodzi się na
 * cztery przelewy, ostatniego dnia schodzi sam abonament księgowości.
 *
 * Każdy przelew ma własny ptaszek, bo odhaczanie po jednym jest jedynym
 * sposobem, żeby żaden nie wypadł. Stan trzyma się per miesiąc, więc lista
 * zeruje się sama.
 */
export function Rozdysponowanie({
  kroki,
  przelacz,
  funduszPelny,
  wplaty,
}: {
  kroki: Record<string, boolean>;
  przelacz: (krokId: string) => void;
  /** Fundusz osiągnął poziom roboczy — składka odpada, całość idzie na poduszkę. */
  funduszPelny: boolean;
  /** Zapisane wpłaty — do sprawdzenia, czy przelew na poduszkę ma już ślad. */
  wplaty: Wplata[];
}) {
  const plan = usePlan();
  const klucz = kluczMiesiaca(new Date());

  // Który krok jest przelewem na fundusz, mówi plan (`kwotaZ: 'fundusz'`),
  // a nie identyfikator wpisany tutaj na sztywno.
  const idFunduszu = krokFunduszu(plan);
  const pomin = (k: KrokListyRozdysponowania) => !(funduszPelny && k.id === idFunduszu);

  const grupy = fazyRozdysponowania(plan, klucz)
    .map((g) => ({ ...g, kroki: g.kroki.filter(pomin) }))
    .filter((g) => g.kroki.length > 0);

  /* Ile z tego miesiąca ma trafić na poduszkę i ile już ma na to dowód.
     Saldo poduszki liczy się z wpłat, nie z ptaszków — odhaczony przelew
     bez wpisu we Wpłatach nie podnosi ani miernika, ani kamieni. To
     najłatwiejsza rzecz do przeoczenia w całym miesiącu, więc karta
     mówi o tym wprost, zamiast czekać, aż saldo przestanie się zgadzać. */
  const naPoduszke = resztaNaPoduszke(plan, klucz, funduszPelny);
  const zapisane = wplaty
    .filter((w) => w.data.startsWith(klucz))
    .reduce((s, w) => s + w.kwota, 0);

  return (
    <Checklista<KrokListyRozdysponowania>
      id="rozdysponowanie"
      tytul={`Rozdysponowanie wpływu — ${nazwaMiesiaca(klucz)}`}
      opoznienie={90}
      grupy={grupy}
      odhaczone={kroki}
      przelacz={przelacz}
      kwota={(k) => kwotaKroku(plan, k, klucz, funduszPelny)}
      przed={
        plan.rozdysponowanie.wyzwalacz ? (
          <p className="notka wyzwalacz">{plan.rozdysponowanie.wyzwalacz}</p>
        ) : null
      }
      po={
        <p className="notka">
          {zapisane > 0
            ? `Na poduszkę wychodzi w tym miesiącu ${zl(naPoduszke)}. We Wpłatach zapisane ${zl(zapisane)} — saldo liczy się z wpłat, nie z ptaszków.`
            : `Na poduszkę wychodzi w tym miesiącu ${zl(naPoduszke)}. We Wpłatach nie ma jeszcze nic za ten miesiąc — dopóki nie zapiszesz przelewu, nie podniesie ani miernika, ani kamieni.`}
        </p>
      }
    />
  );
}
