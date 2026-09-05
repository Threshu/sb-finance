'use client';

import { usePlan } from '@/lib/PlanKontekst';
import { Karta } from './Karta';
import { zl, zlDokladnie } from '@/lib/format';
import { kluczMiesiacaWydatku, stanFunduszu, funduszowe, type Wydatek } from '@/lib/zakupy';
import { kluczMiesiaca } from '@/lib/plan';

/**
 * Fundusz nieregularny — subkonto na dentystę, opony, sprzęt, prezenty.
 *
 * Nie jest celem oszczędnościowym, tylko wygładzaczem: wpłacasz co miesiąc
 * jedną dwunastą rocznych kosztów nieregularnych, wypłacasz gdy coś wyskoczy,
 * a saldo ma falować, nie rosnąć w nieskończoność. Dlatego karta pokazuje nie
 * „ile uzbierałeś", tylko czy saldo trzyma się przedziału, w którym fundusz
 * robi swoje.
 */
export function Fundusz({ wydatki, usun }: { wydatki: Wydatek[]; usun: (id: string) => void }) {
  const plan = usePlan();
  const { saldo, skladki, wplacone, wydane } = stanFunduszu(
    wydatki,
    plan.funduszNieregularny,
    plan.start,
  );

  const poziomRoboczy = plan.funduszPoziomRoboczy ?? 0;
  // Rok składek. Trwałe przekroczenie znaczy, że składka jest za wysoka —
  // wtedy nadwyżka powinna iść na poduszkę, a nie leżeć tutaj.
  const sufit = plan.funduszNieregularny * 12;

  const zaMalo = poziomRoboczy > 0 && saldo < poziomRoboczy;
  const zaDuzo = saldo > sufit;

  const biezacy = kluczMiesiaca(new Date());
  const wTymMiesiacu = funduszowe(wydatki).filter((w) => kluczMiesiacaWydatku(w) === biezacy);
  const ostatnie = funduszowe(wydatki).slice(0, 6);

  return (
    <Karta
      id="fundusz"
      tytul="Fundusz nieregularny"
      opoznienie={280}
      dodatek={<span className="mono licznik">{zl(plan.funduszNieregularny)}/mies</span>}
    >
      <div className="hero-kwota" style={{ marginBottom: 0 }}>
        <span className="duza" style={{ fontSize: 'clamp(28px, 8vw, 38px)' }}>{zl(saldo)}</span>
        {poziomRoboczy > 0 && <span className="cel">poziom roboczy {zl(poziomRoboczy)}</span>}
      </div>

      {poziomRoboczy > 0 && (
        <div className={`pasek${zaMalo ? ' przekroczony' : ''}`}>
          <span style={{ width: `${Math.min((saldo / poziomRoboczy) * 100, 100)}%` }} />
        </div>
      )}

      <div className="wiersz">
        <span className="opis">
          <span className="glowny">Wpłacone</span>
          {skladki} {skladki === 1 ? 'składka' : 'składki'} po {zl(plan.funduszNieregularny)}
        </span>
        <span className="wartosc">{zl(wplacone)}</span>
      </div>

      <div className="wiersz">
        <span className="opis">
          <span className="glowny">Wydane</span>
          w tym miesiącu {zl(wTymMiesiacu.reduce((s, w) => s + w.kwota, 0))}
        </span>
        <span className="wartosc">{wydane > 0 ? `−${zl(wydane)}` : '—'}</span>
      </div>

      {ostatnie.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {ostatnie.map((w) => (
            <div className="wiersz" key={w.id}>
              <span className="opis">
                <span className="glowny">{w.opis}</span>
                <span className="mono" style={{ fontSize: 11.5 }}>
                  {w.data}
                  {w.sklep && ` · ${w.sklep}`}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="wartosc">−{zlDokladnie(w.kwota)}</span>
                <button
                  className="przycisk-usun"
                  onClick={() => usun(w.id)}
                  aria-label={`Usuń wydatek ${w.opis}`}
                >
                  ×
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="notka">
        {zaMalo
          ? `Poniżej poziomu roboczego ${zl(poziomRoboczy)} — tyle wynosi twój największy pojedynczy wydatek nieregularny z historii. Do tego czasu przelewaj pełne ${zl(plan.funduszNieregularny)}.`
          : zaDuzo
            ? `Powyżej rocznej sumy składek (${zl(sufit)}). To znaczy, że ${zl(plan.funduszNieregularny)} miesięcznie jest za dużo — obniż składkę, a różnicę przelewaj na poduszkę.`
            : `Saldo w przedziale roboczym. Fundusz ma falować, nie rosnąć: jeśli po roku stale przyrasta, składka jest za wysoka i nadwyżka powinna iść na poduszkę.`}
      </p>
    </Karta>
  );
}
