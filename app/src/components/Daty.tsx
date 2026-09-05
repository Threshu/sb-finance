'use client';

import {
  nazwaDaty,
  dniDo,
} from '@/lib/plan';
import { usePlan } from '@/lib/PlanKontekst';
import { Karta } from './Karta';
import { dni } from '@/lib/format';

export function Daty() {
  const plan = usePlan();
  const dzis = new Date();

  const nadchodzace = plan.daty
    .map((d) => ({ ...d, zostalo: dniDo(d.data, dzis) }))
    .filter((d) => d.zostalo >= 0)
    .sort((a, b) => a.zostalo - b.zostalo);

  const przeglad = plan.przegladyKwartalne
    .map((d) => ({ data: d, zostalo: dniDo(d, dzis) }))
    .filter((d) => d.zostalo >= 0)
    .sort((a, b) => a.zostalo - b.zostalo)[0];

  return (
    <Karta id="daty" tytul="Daty do pilnowania" opoznienie={320}>
      {przeglad && (
        <div className="wiersz">
          <span className="opis">
            <span className="glowny">
              <span className="data-waga srednia" />
              Przegląd kwartalny
            </span>
            Sprawdzamy, czy budżet jest realny. Można go podnieść.
          </span>
          <span className="wartosc akcent">
            {przeglad.zostalo === 0 ? 'dziś' : `za ${dni(przeglad.zostalo)}`}
          </span>
        </div>
      )}

      {nadchodzace.map((d) => (
        <div className="wiersz" key={`${d.data}-${d.tytul}`}>
          <span className="opis">
            <span className="glowny">
              <span className={`data-waga ${d.waga}`} />
              {d.tytul}
            </span>
            {d.opis}
          </span>
          <span className={`wartosc ${d.waga === 'wysoka' ? 'ostrzezenie' : ''}`}>
            <span style={{ display: 'block' }}>{nazwaDaty(d.data)}</span>
            <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>
              za {dni(d.zostalo)}
            </span>
          </span>
        </div>
      ))}

      {nadchodzace.length === 0 && <p className="lista-pusta">Brak nadchodzących dat.</p>}
    </Karta>
  );
}
