'use client';

import {
  kluczMiesiaca,
  nazwaMiesiaca,
  wplataDlaMiesiaca,
  resztaNaPoduszke,
  krokiRozdysponowania,
  rozdysponowanieWgFaz,
  type KrokRozdysponowania,
  type Plan,
} from '@/lib/plan';
import { usePlan } from '@/lib/PlanKontekst';
import { Karta } from './Karta';
import { zl } from '@/lib/format';

function Ptaszek() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2 6.4L4.7 9L10 3"
        stroke="#1b2416"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Strzalka() {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true" className="strzalka">
      <path
        d="M0 4h8M5.5 1L8.5 4L5.5 7"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Trasa({ skad, dokad }: { skad?: string; dokad?: string }) {
  if (!skad && !dokad) return null;
  return (
    <span className="trasa">
      {skad && <span className="konto">{skad}</span>}
      {skad && dokad && <Strzalka />}
      {dokad && <span className="konto docelowe">{dokad}</span>}
    </span>
  );
}

/** Kwota kroku. `null` znaczy „cała reszta" — liczona z planu, nie wpisana na sztywno. */
function kwotaKroku(
  plan: Plan,
  krok: KrokRozdysponowania,
  funduszPelny: boolean,
): number | null {
  if (krok.kwota === undefined) return null;
  // `null` znaczy „cała reszta" — rośnie o składkę funduszu, gdy ta odpada.
  if (krok.kwota === null) return resztaNaPoduszke(plan, kluczMiesiaca(new Date()), funduszPelny);
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
  const pomin = (k: { id: string }) => !(funduszPelny && k.id === 'r-fundusz');
  const widoczne = krokiRozdysponowania(plan, klucz).filter(pomin);
  const grupy = rozdysponowanieWgFaz(plan, klucz)
    .map((g) => ({ ...g, kroki: g.kroki.filter(pomin) }))
    .filter((g) => g.kroki.length > 0);

  const zrobione = widoczne.filter((k) => kroki[k.id]).length;
  const wszystkie = widoczne.length;
  const komplet = zrobione === wszystkie;

  const reszta = resztaNaPoduszke(plan, klucz, funduszPelny);
  const plan_ = wplataDlaMiesiaca(plan, klucz);
  const roznica = reszta - plan_;

  return (
    <Karta
      id="rozdysponowanie"
      tytul={`Rozdysponowanie wpływu — ${nazwaMiesiaca(klucz)}`}
      opoznienie={90}
      dodatek={
        <span className={`mono licznik${komplet ? ' komplet' : ''}`}>
          {zrobione}/{wszystkie}
        </span>
      }
    >
      <div className="pasek-krokow" aria-hidden="true">
        <span style={{ width: `${(zrobione / wszystkie) * 100}%` }} />
      </div>

      <p className="notka wyzwalacz">{plan.rozdysponowanie.wyzwalacz}</p>

      {grupy.map((grupa) => (
        <div className="faza" key={grupa.faza}>
          <span className="faza-tytul">{grupa.faza}</span>

          {grupa.kroki.map((krok) => {
            const czyZrobione = Boolean(kroki[krok.id]);
            const kwota = kwotaKroku(plan, krok, funduszPelny);
            return (
              <button
                key={krok.id}
                className="krok"
                data-zrobione={czyZrobione}
                onClick={() => przelacz(krok.id)}
                aria-pressed={czyZrobione}
              >
                <span className="pole">
                  <Ptaszek />
                </span>

                <span className="tresc">
                  <span className="krok-glowka">
                    <span className="tytul">{krok.tytul}</span>
                    {kwota !== null && <span className="mono kwota-znacznik">{zl(kwota)}</span>}
                    {krok.kiedy && <span className="kiedy">{krok.kiedy}</span>}
                  </span>

                  <Trasa skad={krok.skad} dokad={krok.dokad} />

                  {krok.opis && <span className="podpis">{krok.opis}</span>}

                  {krok.uwaga && <span className="uwaga">{krok.uwaga}</span>}
                </span>
              </button>
            );
          })}
        </div>
      ))}

      {Math.abs(roznica) >= 10 && (
        <p className="notka roznica">
          Plan zakłada {zl(plan_)} na poduszkę, a z bieżących szacunków podatków wychodzi{' '}
          {zl(reszta)} — różnica {zl(Math.abs(roznica))}. Przelewasz tyle, ile realnie zostało.
        </p>
      )}
    </Karta>
  );
}
