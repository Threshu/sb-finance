'use client';

import {
  kluczMiesiaca,
  nazwaMiesiaca,
  wplataDlaMiesiaca,
  krokiWgFaz,
  krokiMiesiacaWOknie,
  type KrokMiesiaca as Krok,
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
      <path d="M0 4h8M5.5 1L8.5 4L5.5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Skąd → dokąd, w jednej linii. */
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

function Rozbicie({ krok, wplata }: { krok: Krok; wplata: number }) {
  if (!krok.pozycje) return null;
  return (
    <span className="rozbicie">
      {krok.pozycje.map((p, i) => (
        <span className="pozycja" key={i}>
          <span className="mono kwota">{zl(p.kwota ?? wplata)}</span>
          <Strzalka />
          <span className="konto docelowe">{p.dokad}</span>
          <span className="po-co">{p.poCo}</span>
          {p.uwaga && <span className="uwaga">{p.uwaga}</span>}
        </span>
      ))}
    </span>
  );
}

export function KrokiMiesiaca({
  kroki,
  przelacz,
}: {
  kroki: Record<string, boolean>;
  przelacz: (krokId: string) => void;
}) {
  const plan = usePlan();
  const klucz = kluczMiesiaca(new Date());
  const wplata = wplataDlaMiesiaca(plan, klucz);
  // Licznik z kroków obowiązujących w tym miesiącu, nie ze wszystkich w planie —
  // inaczej „0/9" liczyłoby też promocje, które jeszcze nie ruszyły.
  const widoczne = krokiMiesiacaWOknie(plan, klucz);
  const zrobione = widoczne.filter((k) => kroki[k.id]).length;
  const wszystkie = widoczne.length;
  const komplet = zrobione === wszystkie;
  const grupy = krokiWgFaz(plan, klucz);

  return (
    <Karta
      id="kroki-miesiaca"
      tytul={`Promocje bankowe — ${nazwaMiesiaca(klucz)}`}
      opoznienie={120}
      dodatek={
        <span className={`mono licznik${komplet ? ' komplet' : ''}`}>
          {zrobione}/{wszystkie}
        </span>
      }
    >
      <div className="pasek-krokow" aria-hidden="true">
        <span style={{ width: `${(zrobione / wszystkie) * 100}%` }} />
      </div>

      {grupy.map((grupa) => (
        <div className="faza" key={grupa.faza}>
          <span className="faza-tytul">{grupa.faza}</span>

          {grupa.kroki.map((krok) => {
            const czyZrobione = Boolean(kroki[krok.id]);
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
                    {krok.kwota !== undefined && (
                      <span className="mono kwota-znacznik">{zl(krok.kwota)}</span>
                    )}
                    {krok.kiedy && <span className="kiedy">{krok.kiedy}</span>}
                  </span>

                  {!krok.pozycje && <Trasa skad={krok.skad} dokad={krok.dokad} />}

                  {krok.opis && <span className="podpis">{krok.opis}</span>}

                  {krok.uwaga && <span className="uwaga">{krok.uwaga}</span>}

                  <Rozbicie krok={krok} wplata={wplata} />
                </span>
              </button>
            );
          })}
        </div>
      ))}

    </Karta>
  );
}
