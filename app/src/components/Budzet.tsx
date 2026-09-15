'use client';

import { useMemo, useRef, useState } from 'react';
import {
  budzetDlaMiesiaca,
  kluczMiesiaca,
} from '@/lib/plan';
import { usePlan } from '@/lib/PlanKontekst';
import { Karta } from './Karta';
import { zl, zlDokladnie } from '@/lib/format';
import {
  KATEGORIE,
  KATEGORIA_DOMYSLNA,
  ostrzezenieFirmowe,
  rozpoznajKategorie,
} from '@/lib/kategorie';
import {
  czesteWpisy,
  kategoriaSklepu,
  opisyKategorii,
  ostatniaKwota,
  sklepyKategorii,
  wszystkieSklepy,
} from '@/lib/sugestie';
import { budzetowe, firmowe } from '@/lib/zakupy';
import type { Wydatek } from '@/lib/store';

function dzisiaj(): string {
  return new Date().toISOString().slice(0, 10);
}

export function Budzet({
  wydatki,
  wydane,
  dodaj,
  usun,
}: {
  wydatki: Wydatek[];
  wydane: number;
  dodaj: (
    kwota: number,
    opis: string,
    kategoria?: string,
    sklep?: string,
    data?: string,
  ) => void;
  usun: (id: string) => void;
}) {
  const plan = usePlan();
  const [kwota, ustawKwote] = useState('');
  const [opis, ustawOpis] = useState('');
  const [sklep, ustawSklep] = useState('');
  const [data, ustawDate] = useState(dzisiaj);
  const [kategoria, ustawKategorie] = useState(KATEGORIA_DOMYSLNA);
  // Dopóki nie wybierzesz kategorii ręcznie, podpowiada ją opis albo sklep.
  const [kategoriaRecznie, ustawKategorieRecznie] = useState(false);
  // Pierwsze kliknięcie przy ostrzeżeniu tylko je potwierdza, nie zapisuje.
  const [mimoOstrzezenia, ustawMimoOstrzezenia] = useState(false);
  const poleKwoty = useRef<HTMLInputElement>(null);

  const liczba = Number(kwota.replace(',', '.'));
  const poprawna = Number.isFinite(liczba) && liczba > 0;

  /* Podpowiedzi liczą się z całej historii, nie tylko z bieżącego miesiąca —
     inaczej pierwszego dnia miesiąca formularz zapominałby, gdzie kupujesz. */
  const kafelki = useMemo(() => czesteWpisy(wydatki), [wydatki]);
  const znaneSklepy = useMemo(() => wszystkieSklepy(wydatki), [wydatki]);
  const podpowiedziSklepu = useMemo(
    () => sklepyKategorii(wydatki, kategoria),
    [wydatki, kategoria],
  );
  const podpowiedziOpisu = useMemo(
    () => opisyKategorii(wydatki, kategoria),
    [wydatki, kategoria],
  );
  const poprzednia = useMemo(
    () => ostatniaKwota(wydatki, opis, sklep),
    [wydatki, opis, sklep],
  );

  const klucz = kluczMiesiaca(new Date());
  // Bez wydatków z funduszu — te rozlicza własna karta, a `wydane` też ich
  // nie liczy, więc lista i kwota muszą stać na tej samej podstawie.
  const wTymMiesiacu = budzetowe(wydatki).filter((w) => w.data.startsWith(klucz));

  // Wpisy firmowe zostają w historii, ale poza sumą miesiąca — jeden wiersz
  // niżej mówi, że gdzieś są, żeby nie wyglądało na zgubiony wydatek.
  const firmoweWTym = firmowe(wydatki)
    .filter((w) => w.data.startsWith(klucz))
    .reduce((s, w) => s + w.kwota, 0);

  const ostrzezenie = ostrzezenieFirmowe(opis, sklep, kategoria);

  const budzet = budzetDlaMiesiaca(plan, klucz);
  const zostalo = budzet - wydane;
  const procent = Math.min((wydane / budzet) * 100, 100);
  const przekroczony = wydane > budzet;

  const dzis = new Date();
  const dniWMiesiacu = new Date(dzis.getFullYear(), dzis.getMonth() + 1, 0).getDate();
  const dniZostalo = dniWMiesiacu - dzis.getDate() + 1;
  const naDzien = dniZostalo > 0 ? zostalo / dniZostalo : 0;

  function zmienOpis(nowy: string) {
    ustawOpis(nowy);
    ustawMimoOstrzezenia(false);
    if (!kategoriaRecznie) ustawKategorie(rozpoznajKategorie(nowy) ?? KATEGORIA_DOMYSLNA);
  }

  /**
   * Sklep podpowiada kategorię, bo ten kierunek historia rozstrzyga: sklep
   * spożywczy zostaje spożywczym. Odwrotnie już nie — pod jedną kategorią
   * siedzi kilka sklepów naraz, więc tamtą stronę pokazujemy jako przyciski.
   */
  function zmienSklep(nowy: string) {
    ustawSklep(nowy);
    ustawMimoOstrzezenia(false);
    if (kategoriaRecznie) return;
    const z = kategoriaSklepu(wydatki, nowy);
    if (z) ustawKategorie(z);
  }

  /** Kafelek wypełnia wszystko poza kwotą i przenosi kursor na kwotę. */
  function wezKafelek(k: (typeof kafelki)[number]) {
    ustawOpis(k.opis);
    ustawSklep(k.sklep ?? '');
    ustawKategorie(k.kategoria ?? KATEGORIA_DOMYSLNA);
    ustawKategorieRecznie(true);
    ustawMimoOstrzezenia(false);
    poleKwoty.current?.focus();
  }

  function zapisz() {
    if (!poprawna) return;
    /* Ostrzeżenie zatrzymuje pierwszy raz, nie blokuje na stałe: bywa, że
       koszt firmy naprawdę poszedł z prywatnej karty i musi być zapisany. */
    if (ostrzezenie && !mimoOstrzezenia) {
      ustawMimoOstrzezenia(true);
      return;
    }
    dodaj(liczba, opis.trim() || 'Wydatek', kategoria, sklep, data);
    ustawKwote('');
    ustawOpis('');
    ustawSklep('');
    ustawDate(dzisiaj());
    ustawKategorie(KATEGORIA_DOMYSLNA);
    ustawKategorieRecznie(false);
    ustawMimoOstrzezenia(false);
    poleKwoty.current?.focus();
  }

  return (
    <Karta id="budzet" tytul="Budżet bieżący" opoznienie={240}>
      <div className="hero-kwota" style={{ marginBottom: 0 }}>
        <span className="duza" style={{ fontSize: 'clamp(28px, 8vw, 38px)' }}>
          {zl(wydane)}
        </span>
        <span className="cel">z {zl(budzet)}</span>
      </div>

      <div className={`pasek${przekroczony ? ' przekroczony' : ''}`}>
        <span style={{ width: `${procent}%` }} />
      </div>

      <div className="wiersz">
        <span className="opis">{przekroczony ? 'Przekroczone o' : 'Zostało do końca miesiąca'}</span>
        <span className={`wartosc ${przekroczony ? 'ostrzezenie' : 'dodatnia'}`}>
          {zl(Math.abs(zostalo))}
        </span>
      </div>

      {!przekroczony && dniZostalo > 0 && (
        <div className="wiersz">
          <span className="opis">Dziennie przez najbliższe {dniZostalo} dni</span>
          <span className="wartosc">{zl(naDzien)}</span>
        </div>
      )}

      {firmoweWTym > 0 && (
        <div className="wiersz">
          <span className="opis">Poza budżetem — koszty firmy</span>
          <span className="wartosc">{zl(firmoweWTym)}</span>
        </div>
      )}

      {kafelki.length > 0 && (
        <div className="chipy" style={{ marginTop: 14 }}>
          {kafelki.map((k) => (
            <button
              key={k.klucz}
              type="button"
              className="chip"
              onClick={() => wezKafelek(k)}
              title={`W historii ${k.liczba} razy`}
            >
              {k.opis}
              {k.sklep && <span className="chip-sklep">{k.sklep}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="formularz">
        <input
          ref={poleKwoty}
          type="text"
          inputMode="decimal"
          placeholder="kwota"
          value={kwota}
          onChange={(e) => ustawKwote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && zapisz()}
          aria-label="Kwota wydatku"
        />
        <input
          type="text"
          list="podpowiedzi-opisu"
          placeholder="na co"
          value={opis}
          onChange={(e) => zmienOpis(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && zapisz()}
          aria-label="Opis wydatku"
          style={{ flex: '2 1 150px' }}
        />
        <datalist id="podpowiedzi-opisu">
          {podpowiedziOpisu.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
        <select
          value={kategoria}
          onChange={(e) => {
            ustawKategorie(e.target.value);
            ustawKategorieRecznie(true);
            ustawMimoOstrzezenia(false);
          }}
          aria-label="Kategoria wydatku"
          style={{ flex: '2 1 150px' }}
        >
          {KATEGORIE.map((k) => (
            <option key={k.id} value={k.id}>
              {k.nazwa}
            </option>
          ))}
        </select>
        <input
          type="text"
          list="podpowiedzi-sklepu"
          placeholder="gdzie"
          value={sklep}
          onChange={(e) => zmienSklep(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && zapisz()}
          aria-label="Sklep"
          style={{ flex: '1 1 120px' }}
        />
        <datalist id="podpowiedzi-sklepu">
          {znaneSklepy.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <input
          type="date"
          value={data}
          max={dzisiaj()}
          onChange={(e) => ustawDate(e.target.value)}
          aria-label="Data wydatku"
          style={{ flex: '1 1 140px' }}
        />
        <button className="przycisk" disabled={!poprawna} onClick={zapisz}>
          {mimoOstrzezenia ? 'Dodaj mimo to' : 'Dodaj'}
        </button>
      </div>

      {ostrzezenie && (
        <p className="notka ostrzezenie" style={{ marginTop: 8 }}>
          {ostrzezenie}
          {mimoOstrzezenia && ' Kliknij jeszcze raz, żeby zapisać.'}
        </p>
      )}

      {podpowiedziSklepu.length > 0 && (
        <div className="chipy">
          <span className="chipy-etykieta">gdzie zwykle</span>
          {podpowiedziSklepu.map((s) => (
            <button
              key={s}
              type="button"
              className="chip drugi"
              onClick={() => zmienSklep(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {poprzednia !== undefined && (
        <p className="notka" style={{ marginTop: 8 }}>
          Ostatnio to samo kosztowało {zlDokladnie(poprzednia)}. Kwotę wpisz z paragonu —
          koszyk za każdym razem jest inny.
        </p>
      )}

      <div style={{ marginTop: 16 }}>
        {wTymMiesiacu.length === 0 && (
          <p className="lista-pusta">Brak wydatków w tym miesiącu.</p>
        )}
        {wTymMiesiacu.slice(0, 5).map((w) => (
          <div className="wiersz" key={w.id}>
            <span className="opis">
              <span className="glowny">{w.opis}</span>
              <span className="mono" style={{ fontSize: 11.5 }}>
                {w.data}
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

    </Karta>
  );
}
