'use client';

import { usePlan } from '@/lib/PlanKontekst';
import { Karta } from './Karta';
import { zl, zlDokladnie, odmiana } from '@/lib/format';
import { kluczMiesiacaWydatku, stanFunduszu, funduszowe, type Wydatek } from '@/lib/zakupy';
import { kluczMiesiaca, nazwaMiesiaca, skladkaFunduszu } from '@/lib/plan';

/**
 * Fundusz nieregularny — subkonto na dentystę, opony, sprzęt, prezenty.
 *
 * Nie jest celem oszczędnościowym, tylko wygładzaczem: wpłacasz co miesiąc
 * jedną dwunastą rocznych kosztów nieregularnych, wypłacasz gdy coś wyskoczy,
 * a saldo ma falować, nie rosnąć w nieskończoność. Dlatego karta pokazuje nie
 * „ile uzbierałeś", tylko czy saldo trzyma się przedziału, w którym fundusz
 * robi swoje.
 */
export function Fundusz({
  wydatki,
  kroki,
  usun,
}: {
  wydatki: Wydatek[];
  /** Odhaczone kroki wszystkich miesięcy — z nich liczą się wpłacone składki. */
  kroki: Record<string, Record<string, boolean>>;
  usun: (id: string) => void;
}) {
  const plan = usePlan();
  const biezacy = kluczMiesiaca(new Date());
  const { saldo, startowe, skladki, wplacone, wydane, zalegle, biezacyZrobiony } = stanFunduszu(
    wydatki,
    plan,
    kroki,
  );

  const skladka = skladkaFunduszu(plan, biezacy);
  const poziomRoboczy = plan.funduszPoziomRoboczy ?? 0;
  // Rok składek. Trwałe przekroczenie znaczy, że składka jest za wysoka —
  // wtedy nadwyżka powinna iść na poduszkę, a nie leżeć tutaj.
  const sufit = skladka * 12;

  const zaMalo = poziomRoboczy > 0 && saldo < poziomRoboczy;
  const zaDuzo = saldo > sufit;
  const wTymMiesiacu = funduszowe(wydatki).filter((w) => kluczMiesiacaWydatku(w) === biezacy);
  const ostatnie = funduszowe(wydatki).slice(0, 6);

  return (
    <Karta
      id="fundusz"
      tytul="Fundusz nieregularny"
      opoznienie={280}
      dodatek={<span className="mono licznik">{zl(skladka)}/mies</span>}
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

      {startowe > 0 && (
        <div className="wiersz">
          <span className="opis">
            <span className="glowny">Saldo otwarcia</span>
            co leżało na subkoncie przed startem planu
          </span>
          <span className="wartosc">{zl(startowe)}</span>
        </div>
      )}

      <div className="wiersz">
        <span className="opis">
          <span className="glowny">Wpłacone</span>
          {skladki} {odmiana(skladki, 'składka', 'składki', 'składek')} — liczone z odhaczonych przelewów
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

      {!biezacyZrobiony && (
        <p className="notka ostrzezenie">
          Składka za {nazwaMiesiaca(biezacy)} ({zl(skladka)}) nie jest jeszcze w saldzie. Wejdzie,
          gdy odhaczysz przelew na fundusz w Rozdysponowaniu — ptaszek jest tu jedynym dowodem, że
          pieniądze faktycznie poszły na subkonto.
        </p>
      )}

      {zalegle.length > 0 && (
        <p className="notka ostrzezenie">
          Bez odhaczonego przelewu: {zalegle.map(nazwaMiesiaca).join(', ')}. Jeśli przelew się odbył,
          odhacz go w tamtym miesiącu; jeśli nie — saldo jest poprawne i tyle na subkoncie leży.
        </p>
      )}

      <p className="notka">
        {zaMalo
          ? `Poniżej poziomu roboczego ${zl(poziomRoboczy)} — tyle wynosi twój największy pojedynczy wydatek nieregularny z historii. Do tego czasu przelewaj pełne ${zl(skladka)}.`
          : zaDuzo
            ? `Powyżej rocznej sumy składek (${zl(sufit)}). To znaczy, że ${zl(skladka)} miesięcznie jest za dużo — obniż składkę, a różnicę przelewaj na poduszkę.`
            : `Saldo w przedziale roboczym. Fundusz ma falować, nie rosnąć: jeśli po roku stale przyrasta, składka jest za wysoka i nadwyżka powinna iść na poduszkę.`}
      </p>
    </Karta>
  );
}
