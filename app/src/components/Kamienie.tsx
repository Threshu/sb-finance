'use client';

import {
  stanKamieni,
  kluczMiesiaca,
  nazwaMiesiaca,
  type Plan,
} from '@/lib/plan';
import { usePlan } from '@/lib/PlanKontekst';
import { Karta } from './Karta';
import { zl } from '@/lib/format';

/** Przybliżony miesiąc osiągnięcia kwoty przy obecnym tempie wpłat. */
function kiedyOsiagniesz(plan: Plan, brakuje: number): string | null {
  if (plan.wplataMiesieczna <= 0) return null;
  const miesiecy = Math.ceil(brakuje / plan.wplataMiesieczna);
  if (miesiecy > 120) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + miesiecy);
  return nazwaMiesiaca(kluczMiesiaca(d));
}

function Ptaszek() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2 6.4L4.7 9L10 3"
        stroke="#1b2416"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Kamienie({ saldo }: { saldo: number }) {
  const plan = usePlan();
  const stany = stanKamieni(plan, saldo);
  const zdobyte = stany.filter((s) => s.osiagniety).length;

  return (
    <Karta
      id="kamienie"
      tytul="Kamienie milowe"
      opoznienie={180}
      dodatek={
        <span className={`mono licznik${zdobyte === stany.length ? ' komplet' : ''}`}>
          {zdobyte}/{stany.length}
        </span>
      }
    >
      <ol className="kamienie">
        {stany.map(({ kamien, osiagniety, postep, brakuje, nastepny }) => {
          const termin = nastepny ? kiedyOsiagniesz(plan, brakuje) : null;
          return (
            <li
              className="kamien"
              key={kamien.kwota}
              data-osiagniety={osiagniety}
              data-nastepny={nastepny}
            >
              <div className="znacznik">{osiagniety && <Ptaszek />}</div>

              <div className="kamien-tresc">
                <div className="kamien-glowka">
                  <span className="tytul">{kamien.tytul}</span>
                  <span className="mono prog">{zl(kamien.kwota)}</span>
                </div>

                <span className="podpis">{kamien.opis}</span>

                {nastepny && (
                  <>
                    <div className="pasek maly">
                      <span style={{ width: `${postep * 100}%` }} />
                    </div>
                    <span className="kamien-status">
                      brakuje <strong className="mono">{zl(brakuje)}</strong>
                      {termin && <> · przy obecnym tempie {termin}</>}
                    </span>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="warstwy">
        <span className="faza-tytul">Gdzie leży poduszka — docelowo</span>
        {plan.warstwyPoduszki.map((w) => (
          <div className="wiersz" key={w.nazwa}>
            <span className="opis">
              <span className="glowny">{w.nazwa}</span>
              {w.gdzie} · {w.oprocentowanie} · dostęp {w.dostep}
            </span>
            <span className="mono wartosc">{zl(w.docelowo)}</span>
          </div>
        ))}
        <p className="notka">
          Podział 25/75 z rozdz. 3. Zakupy obligacji ruszają 1 stycznia 2027, razem z OKI.
          Do tego czasu całość leży na koncie oszczędnościowym.
        </p>
      </div>
    </Karta>
  );
}
