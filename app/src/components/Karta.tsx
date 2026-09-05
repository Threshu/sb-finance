'use client';

import { useZwiniecie } from '@/lib/ZwinieciaKontekst';

function Strzalka({ zwiniete }: { zwiniete: boolean }) {
  return (
    <span className="karta-tytul-ikona">
      <svg
        width="13"
        height="13"
        viewBox="0 0 10 10"
        fill="none"
        aria-hidden="true"
        className="strzalka-karty"
        style={{ transform: zwiniete ? 'rotate(-90deg)' : 'none' }}
      >
        <path
          d="M2 3.5L5 6.5L8 3.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * Karta panelu ze zwijanym nagłówkiem.
 *
 * Cały wygląd i zachowanie zwijania — odznaka strzałki, animacja, zapis stanu
 * — siedzi tutaj, bo wcześniej było to przepisane ręcznie w czternastu
 * miejscach i każda zmiana wyglądu wymagała czternastu edycji.
 */
export function Karta({
  id,
  tytul,
  przed,
  dodatek,
  klasaGlowki = 'karta-glowka',
  opoznienie,
  children,
}: {
  /** Klucz stanu zwinięcia w bazie. Musi być stały — po nim wraca ustawienie. */
  id: string;
  tytul: React.ReactNode;
  /** Na lewo od tytułu, poza przyciskiem. */
  przed?: React.ReactNode;
  /**
   * Na prawo od tytułu, poza przyciskiem — bo bywa tam własny przycisk,
   * a przycisk w przycisku to niepoprawny HTML.
   */
  dodatek?: React.ReactNode;
  /** Dla nagłówka o innym układzie niż domyślny pasek tytuł-dodatek. */
  klasaGlowki?: string;
  opoznienie?: number;
  children: React.ReactNode;
}) {
  const [zwiniete, przelacz] = useZwiniecie(id);

  return (
    <section
      className="karta pojawia"
      data-zwiniete={zwiniete}
      style={opoznienie ? { animationDelay: `${opoznienie}ms` } : undefined}
    >
      <div className={klasaGlowki}>
        {przed}
        <button
          type="button"
          className="karta-tytul"
          onClick={przelacz}
          aria-expanded={!zwiniete}
        >
          <Strzalka zwiniete={zwiniete} />
          <span className="etykieta">{tytul}</span>
        </button>
        {dodatek}
      </div>

      {/* Dwa poziomy: zewnętrzny animuje wysokość, wewnętrzny przycina treść
          w trakcie animacji. */}
      <div className="karta-tresc" data-zwiniete={zwiniete}>
        <div>{children}</div>
      </div>
    </section>
  );
}
