'use client';

import { useEffect, useRef, useState } from 'react';
import { przyspieszenieWDniach } from '@/lib/plan';
import { usePlan } from '@/lib/PlanKontekst';
import { Karta } from './Karta';
import { zlDokladnie, dni } from '@/lib/format';
import type { Wplata } from '@/lib/store';

export function Wplaty({
  wplaty,
  dodaj,
  usun,
}: {
  wplaty: Wplata[];
  dodaj: (kwota: number, opis: string, zrodlo: 'plan' | 'dodatkowy') => void;
  usun: (id: string) => void;
}) {
  const plan = usePlan();
  const [kwota, ustawKwote] = useState('');
  const [opis, ustawOpis] = useState('');
  const [potwierdzenie, ustawPotwierdzenie] = useState<string | null>(null);
  const zegar = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Zdjęcie potwierdzenia po sześciu sekundach nie może przeżyć komponentu.
  useEffect(() => () => {
    if (zegar.current) clearTimeout(zegar.current);
  }, []);

  const liczba = Number(kwota.replace(',', '.'));
  const poprawna = Number.isFinite(liczba) && liczba > 0;

  function zapisz(zrodlo: 'plan' | 'dodatkowy') {
    if (!poprawna) return;
    dodaj(liczba, opis.trim() || (zrodlo === 'plan' ? 'Wpłata planowa' : 'Dodatkowy wpływ'), zrodlo);
    if (zegar.current) clearTimeout(zegar.current);
    if (zrodlo === 'dodatkowy') {
      ustawPotwierdzenie(`Cel bliżej o ${dni(przyspieszenieWDniach(plan, liczba))}.`);
      zegar.current = setTimeout(() => ustawPotwierdzenie(null), 6000);
    } else {
      ustawPotwierdzenie(null);
    }
    ustawKwote('');
    ustawOpis('');
  }

  return (
    <Karta id="wplaty" tytul="Wpłaty na poduszkę" opoznienie={160}>
      <div className="formularz">
        <input
          type="text"
          inputMode="decimal"
          placeholder="kwota"
          value={kwota}
          onChange={(e) => ustawKwote(e.target.value)}
          aria-label="Kwota wpłaty"
        />
        <input
          type="text"
          placeholder="opis (np. turniej w Poznaniu)"
          value={opis}
          onChange={(e) => ustawOpis(e.target.value)}
          aria-label="Opis wpłaty"
          style={{ flex: '2 1 180px' }}
        />
      </div>

      <div className="formularz">
        <button className="przycisk" disabled={!poprawna} onClick={() => zapisz('plan')}>
          Wpłata planowa
        </button>
        <button className="przycisk cichy" disabled={!poprawna} onClick={() => zapisz('dodatkowy')}>
          Dodatkowy wpływ
        </button>
      </div>

      {potwierdzenie && (
        <p className="notka" style={{ color: 'var(--sage)' }}>
          {potwierdzenie}
        </p>
      )}

      <div style={{ marginTop: 18 }}>
        {wplaty.slice(0, 8).map((w) => (
          <div className="wiersz" key={w.id}>
            <span className="opis">
              <span className="glowny">{w.opis}</span>
              <span className="mono" style={{ fontSize: 11.5 }}>
                {w.data}
                {w.zrodlo === 'dodatkowy' && ' · dodatkowy'}
              </span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className={`wartosc ${w.zrodlo === 'dodatkowy' ? 'dodatnia' : ''}`}>
                +{zlDokladnie(w.kwota)}
              </span>
              <button
                className="przycisk-usun"
                onClick={() => usun(w.id)}
                aria-label={`Usuń wpłatę ${w.opis}`}
              >
                ×
              </button>
            </span>
          </div>
        ))}
        {wplaty.length > 8 && (
          <p className="notka">…i {wplaty.length - 8} wcześniejszych.</p>
        )}
      </div>
    </Karta>
  );
}
