'use client';

import { Karta } from './Karta';
import { zl } from '@/lib/format';

/* ── Wspólne części list z ptaszkiem ────────────────────────
   Trzy karty pokazują to samo: rząd do odhaczenia z kwadratem, tytułem
   i kwotą. Wcześniej każda miała własną kopię ikony, przycisku i paska
   postępu — trzy komplety, które trzeba było poprawiać osobno. Kroki
   miesiąca i rozdysponowanie mają na dodatek identyczny układ grup, więc
   dostają gotową `Checklista`; harmonogram wypłat ma inną treść wiersza
   i składa go z `PrzyciskKroku`. */

export function Ptaszek() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2 6.4L4.7 9L10 3"
        stroke="#1b2416"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Strzalka() {
  return (
    <svg
      width="10"
      height="8"
      viewBox="0 0 10 8"
      fill="none"
      aria-hidden="true"
      className="strzalka"
    >
      <path
        d="M0 4h8M5.5 1L8.5 4L5.5 7"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Skąd → dokąd, w jednej linii. */
export function Trasa({ skad, dokad }: { skad?: string; dokad?: string }) {
  if (!skad && !dokad) return null;
  return (
    <span className="trasa">
      {skad && <span className="konto">{skad}</span>}
      {skad && dokad && <Strzalka />}
      {dokad && <span className="konto docelowe">{dokad}</span>}
    </span>
  );
}

export function PasekPostepu({ zrobione, wszystkie }: { zrobione: number; wszystkie: number }) {
  const procent = wszystkie > 0 ? (zrobione / wszystkie) * 100 : 0;
  return (
    <div className="pasek-krokow" aria-hidden="true">
      <span style={{ width: `${procent}%` }} />
    </div>
  );
}

export function Licznik({ zrobione, wszystkie }: { zrobione: number; wszystkie: number }) {
  const komplet = wszystkie > 0 && zrobione === wszystkie;
  return (
    <span className={`mono licznik${komplet ? ' komplet' : ''}`}>
      {zrobione}/{wszystkie}
    </span>
  );
}

export function PrzyciskKroku({
  zrobione,
  przelacz,
  children,
}: {
  zrobione: boolean;
  przelacz: () => void;
  children: React.ReactNode;
}) {
  return (
    <button className="krok" data-zrobione={zrobione} onClick={przelacz} aria-pressed={zrobione}>
      <span className="pole">
        <Ptaszek />
      </span>
      <span className="tresc">{children}</span>
    </button>
  );
}

/** Wspólny kształt kroku miesiąca i kroku rozdysponowania. */
export type KrokChecklisty = {
  id: string;
  faza: string;
  tytul: string;
  opis?: string;
  skad?: string;
  dokad?: string;
  uwaga?: string;
};

/**
 * Lista kroków pogrupowana po fazach, w karcie z licznikiem i paskiem.
 *
 * `kwota` jest funkcją, a nie polem kroku, bo jedna lista pokazuje kwoty
 * wpisane w planie, a druga liczone z niego na bieżący miesiąc. `null`
 * znaczy „ten krok nie ma kwoty", nie „zero złotych".
 */
export function Checklista<T extends KrokChecklisty>({
  id,
  tytul,
  opoznienie,
  grupy,
  odhaczone,
  przelacz,
  kwota,
  przed,
  po,
}: {
  id: string;
  tytul: string;
  opoznienie?: number;
  grupy: { faza: string; kroki: T[] }[];
  odhaczone: Record<string, boolean>;
  przelacz: (krokId: string) => void;
  kwota?: (krok: T) => number | null;
  przed?: React.ReactNode;
  po?: React.ReactNode;
}) {
  const widoczne = grupy.flatMap((g) => g.kroki);
  const zrobione = widoczne.filter((k) => odhaczone[k.id]).length;

  return (
    <Karta
      id={id}
      tytul={tytul}
      opoznienie={opoznienie}
      dodatek={<Licznik zrobione={zrobione} wszystkie={widoczne.length} />}
    >
      <PasekPostepu zrobione={zrobione} wszystkie={widoczne.length} />

      {przed}

      {grupy.map((grupa) => (
        <div className="faza" key={grupa.faza}>
          <span className="faza-tytul">{grupa.faza}</span>

          {grupa.kroki.map((krok) => {
            const ile = kwota?.(krok) ?? null;
            return (
              <PrzyciskKroku
                key={krok.id}
                zrobione={Boolean(odhaczone[krok.id])}
                przelacz={() => przelacz(krok.id)}
              >
                <span className="krok-glowka">
                  <span className="tytul">{krok.tytul}</span>
                  {ile !== null && <span className="mono kwota-znacznik">{zl(ile)}</span>}
                </span>

                <Trasa skad={krok.skad} dokad={krok.dokad} />

                {krok.opis && <span className="podpis">{krok.opis}</span>}
                {krok.uwaga && <span className="uwaga">{krok.uwaga}</span>}
              </PrzyciskKroku>
            );
          })}
        </div>
      ))}

      {po}
    </Karta>
  );
}
