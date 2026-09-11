'use client';

import {
  nazwaDaty,
  dniDo,
} from '@/lib/plan';
import { usePlan } from '@/lib/PlanKontekst';
import { Karta } from './Karta';
import { dni } from '@/lib/format';

/**
 * Daty do pilnowania, w dwóch rozłącznych wariantach.
 *
 * `zakres="bank"` bierze wyłącznie terminy oznaczone bankiem i trafia do
 * zakładki Banki; domyślny bierze całą resztę i zostaje w panelu. Rozdział
 * idzie po polu `bank` w planie, nie po szukaniu nazw w tytule — nazw banków
 * nie wolno wpisywać w kod, bo build stoi na publicznym hostingu.
 */
export function Daty({ zakres = 'reszta' }: { zakres?: 'bank' | 'reszta' }) {
  const plan = usePlan();
  const dzis = new Date();
  const tylkoBanki = zakres === 'bank';

  const nadchodzace = plan.daty
    .filter((d) => Boolean(d.bank) === tylkoBanki)
    .map((d) => ({ ...d, zostalo: dniDo(d.data, dzis) }))
    .filter((d) => d.zostalo >= 0)
    .sort((a, b) => a.zostalo - b.zostalo);

  // Przegląd kwartalny jest o całym planie, nie o bankach — pokazujemy go
  // tylko w panelu.
  const przeglad = tylkoBanki
    ? undefined
    : plan.przegladyKwartalne
        .map((d) => ({ data: d, zostalo: dniDo(d, dzis) }))
        .filter((d) => d.zostalo >= 0)
        .sort((a, b) => a.zostalo - b.zostalo)[0];

  return (
    <Karta
      id={tylkoBanki ? 'daty-banki' : 'daty'}
      tytul={tylkoBanki ? 'Terminy w bankach' : 'Daty do pilnowania'}
      opoznienie={320}
    >
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

      {nadchodzace.length === 0 && (
        <p className="lista-pusta">
          {tylkoBanki ? 'Brak terminów w bankach.' : 'Brak nadchodzących dat.'}
        </p>
      )}
    </Karta>
  );
}
