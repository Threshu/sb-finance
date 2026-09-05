'use client';

import {
  miesiacePrzetrwania,
  projekcja,
  nazwaMiesiaca,
} from '@/lib/plan';
import { usePlan } from '@/lib/PlanKontekst';
import { Karta } from './Karta';
import { zl, miesiace, ulamek } from '@/lib/format';

export function Miernik({ saldo }: { saldo: number }) {
  const plan = usePlan();
  const przetrwanie = miesiacePrzetrwania(plan, saldo);
  const p = projekcja(plan, saldo);
  const osiagniety = saldo >= plan.cel;
  const dodatkowe = (plan.zrodlaDodatkowe ?? []).join(', ');

  return (
    <Karta id="poduszka" tytul="Poduszka bezpieczeństwa">
      <div className="hero-kwota">
        <span className="duza">{zl(saldo)}</span>
        <span className="cel">z {zl(plan.cel)}</span>
      </div>

      <p className="hero-podpis">
        Bez żadnych dochodów przeżyjesz <strong>{ulamek(przetrwanie)}</strong> miesiąca
        przy twardych kosztach {zl(plan.kosztyTwarde)} miesięcznie.
      </p>

      {/* Postęp w miesiącach przetrwania pokazuje karta Kamienie milowe —
          z nazwami progów i odległością do najbliższego. Powtarzanie tego
          tutaj słupkami dawało to samo, tylko bez nazw. */}
      <div style={{ marginTop: 20 }}>
        <div className="wiersz">
          <span className="opis">Cel {zl(plan.cel)}</span>
          <span className={`wartosc ${osiagniety ? 'dodatnia' : 'akcent'}`}>
            {osiagniety
              ? 'osiągnięty'
              : p.miesiacCelu === null
                ? 'poza zasięgiem'
                : nazwaMiesiaca(p.miesiacCelu)}
          </span>
        </div>
        {!osiagniety && p.miesiecyDoCelu !== null && (
          <div className="wiersz">
            <span className="opis">Zostało przy obecnym tempie</span>
            <span className="wartosc">{miesiace(p.miesiecyDoCelu)}</span>
          </div>
        )}
      </div>

      {/* Nazwy źródeł biorą się z planu, nie z kodu — build jest publiczny. */}
      <p className="notka">
        Projekcja zakłada tylko planowane wpłaty — źródło: {plan.przeplyw.zrodlo}.{' '}
        {dodatkowe ? `Dochody dodatkowe (${dodatkowe}) i zwroty podatku` : 'Dochody dodatkowe i zwroty podatku'}{' '}
        ją przyspieszają — nie są tu policzone.
      </p>
    </Karta>
  );
}
