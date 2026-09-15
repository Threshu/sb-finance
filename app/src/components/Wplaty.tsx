'use client';

import { useEffect, useRef, useState } from 'react';
import { przyspieszenieWDniach } from '@/lib/plan';
import { usePlan } from '@/lib/PlanKontekst';
import { Karta } from './Karta';
import { zlDokladnie, dni } from '@/lib/format';
import type { Wplata } from '@/lib/store';

function dzisiaj(): string {
  return new Date().toISOString().slice(0, 10);
}

export function Wplaty({
  wplaty,
  dodaj,
  usun,
}: {
  wplaty: Wplata[];
  dodaj: (kwota: number, opis: string, zrodlo: 'plan' | 'dodatkowy', data?: string) => void;
  usun: (id: string) => void;
}) {
  const plan = usePlan();
  const [kwota, ustawKwote] = useState('');
  const [opis, ustawOpis] = useState('');
  const [data, ustawDate] = useState(dzisiaj);
  const [potwierdzenie, ustawPotwierdzenie] = useState<string | null>(null);
  const [blad, ustawBlad] = useState<string | null>(null);
  const zegar = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poleKwoty = useRef<HTMLInputElement>(null);

  // Zdjęcie potwierdzenia po sześciu sekundach nie może przeżyć komponentu.
  useEffect(() => () => {
    if (zegar.current) clearTimeout(zegar.current);
  }, []);

  const liczba = Number(kwota.replace(',', '.'));
  const poprawna = Number.isFinite(liczba) && liczba > 0;

  /*
   * Przyciski są zawsze klikalne.
   *
   * Wcześniej miały `disabled`, dopóki w polu nie było poprawnej kwoty — a stan
   * wyłączony jest tu z założenia dyskretny (przycisk zostaje złoty, tylko
   * ciemniejszy). Na telefonie nie ma najechania kursorem, więc różnicy nie
   * widać wcale: przycisk wygląda normalnie, klika się i nic się nie dzieje.
   * To wygląda na zepsutą apkę, a nie na brakującą kwotę. Teraz kliknięcie
   * bez kwoty mówi wprost, czego brakuje, i wraca kursorem do pola.
   */
  function zapisz(zrodlo: 'plan' | 'dodatkowy') {
    if (!poprawna) {
      ustawBlad(
        kwota.trim() ? `„${kwota.trim()}" to nie jest kwota.` : 'Najpierw wpisz kwotę.',
      );
      poleKwoty.current?.focus();
      return;
    }
    ustawBlad(null);
    dodaj(liczba, opis.trim() || (zrodlo === 'plan' ? 'Wpłata planowa' : 'Dodatkowy wpływ'), zrodlo, data);
    if (zegar.current) clearTimeout(zegar.current);
    if (zrodlo === 'dodatkowy') {
      ustawPotwierdzenie(`Cel bliżej o ${dni(przyspieszenieWDniach(plan, liczba))}.`);
      zegar.current = setTimeout(() => ustawPotwierdzenie(null), 6000);
    } else {
      ustawPotwierdzenie(null);
    }
    ustawKwote('');
    ustawOpis('');
    ustawDate(dzisiaj());
  }

  return (
    <Karta id="wplaty" tytul="Wpłaty na poduszkę" opoznienie={160}>
      <div className="formularz">
        <input
          ref={poleKwoty}
          type="text"
          inputMode="decimal"
          placeholder="kwota"
          value={kwota}
          onChange={(e) => {
            ustawKwote(e.target.value);
            if (blad) ustawBlad(null);
          }}
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
        {/* Przelew robi się przy rozdysponowaniu, a wpisuje wieczorem —
            bez tego pola wpłata siadałaby na dniu wpisania. */}
        <input
          type="date"
          value={data}
          max={dzisiaj()}
          onChange={(e) => ustawDate(e.target.value)}
          aria-label="Data wpłaty"
          style={{ flex: '1 1 140px' }}
        />
      </div>

      <div className="formularz">
        <button className="przycisk" onClick={() => zapisz('plan')}>
          Wpłata planowa
        </button>
        <button className="przycisk cichy" onClick={() => zapisz('dodatkowy')}>
          Dodatkowy wpływ
        </button>
      </div>

      {blad && (
        <p className="notka" style={{ color: 'var(--rust)' }} role="alert">
          {blad}
        </p>
      )}

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
