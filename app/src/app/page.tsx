'use client';

import { useState } from 'react';
import { useStan, saldo, wydatkiMiesiaca } from '@/lib/store';
import { stanFunduszu } from '@/lib/zakupy';
import { useZdalnyPlan } from '@/lib/planStore';
import { DostawcaPlanu } from '@/lib/PlanKontekst';
import { DostawcaZwiniec } from '@/lib/ZwinieciaKontekst';
import { kluczMiesiaca } from '@/lib/plan';
import { EkranLogowania, EkranBrakPlanu } from '@/components/Brama';
import { Miernik } from '@/components/Miernik';
import { Rozdysponowanie } from '@/components/Rozdysponowanie';
import { Kamienie } from '@/components/Kamienie';
import { Wplaty } from '@/components/Wplaty';
import { Budzet } from '@/components/Budzet';
import { Fundusz } from '@/components/Fundusz';
import { Daty } from '@/components/Daty';
import { Konto } from '@/components/Konto';
import { Zakupy } from '@/components/Zakupy';
import { Banki } from '@/components/Banki';

type Widok = 'panel' | 'zakupy' | 'banki';

function Naglowek({
  widok,
  ustawWidok,
}: {
  widok?: Widok;
  ustawWidok?: (w: Widok) => void;
}) {
  return (
    <header className="naglowek pojawia">
      <h1>
        Finansowa <em>Forteca</em>
      </h1>
      {widok && ustawWidok ? (
        <div className="zakladki" role="tablist" aria-label="Widok">
          <button
            className="zakladka"
            role="tab"
            aria-selected={widok === 'panel'}
            onClick={() => ustawWidok('panel')}
          >
            Panel
          </button>
          <button
            className="zakladka"
            role="tab"
            aria-selected={widok === 'zakupy'}
            onClick={() => ustawWidok('zakupy')}
          >
            Zakupy
          </button>
          <button
            className="zakladka"
            role="tab"
            aria-selected={widok === 'banki'}
            onClick={() => ustawWidok('banki')}
          >
            Banki
          </button>
        </div>
      ) : (
        <span className="etykieta">Etap 1</span>
      )}
    </header>
  );
}

export default function Strona() {
  const {
    stan,
    gotowe,
    uid,
    email,
    zwinieteKarty,
    przelaczZwiniecie,
    dodajWplate,
    usunWplate,
    dodajWydatek,
    usunWydatek,
    przelaczKrok,
  } = useStan();

  const { plan, stan: stanPlanu, blad } = useZdalnyPlan(uid);
  const [widok, ustawWidok] = useState<Widok>('panel');

  const klucz = kluczMiesiaca(new Date());

  if (!gotowe) {
    return (
      <main className="powloka">
        <p className="lista-pusta">Wczytywanie…</p>
      </main>
    );
  }

  // Bez zalogowania nie pokazujemy żadnych liczb — plan siedzi w bazie, nie w kodzie.
  if (!uid) {
    return (
      <main className="powloka">
        <Naglowek />
        <EkranLogowania />
      </main>
    );
  }

  if (stanPlanu === 'sprawdzam') {
    return (
      <main className="powloka">
        <Naglowek />
        <p className="lista-pusta">Wczytuję plan…</p>
      </main>
    );
  }

  if (!plan || stanPlanu === 'brak' || stanPlanu === 'blad') {
    return (
      <main className="powloka">
        <Naglowek />
        <EkranBrakPlanu blad={blad} email={email} />
        <Konto email={email} />
      </main>
    );
  }

  return (
    <DostawcaPlanu plan={plan}>
      <DostawcaZwiniec zwiniete={zwinieteKarty} przelacz={przelaczZwiniecie}>
        <main className="powloka">
          <Naglowek widok={widok} ustawWidok={ustawWidok} />

          {widok === 'zakupy' && <Zakupy wydatki={stan.wydatki} usun={usunWydatek} />}

          {widok === 'banki' && <Banki kroki={stan.kroki} przelacz={przelaczKrok} />}

          {/* Trzy niezależne kolumny — każda płynie własną wysokością,
              dzięki czemu nigdzie nie zostaje pusta przestrzeń.
              Lewa: stan i pieniądze. Środkowa: co masz zrobić. Prawa: kontrola. */}
          {widok === 'panel' && (
            <div className="panel">
              {/* Kolejność i rozkład kart nie są przypadkowe. Budżet idzie
                  pierwszy, bo to jedyna karta używana codziennie — reszta
                  odpowiada na pytania zadawane raz w miesiącu. Karty są
                  rozłożone na kolumny o zbliżonej wysokości: siatka nie jest
                  masonry, więc krótsza kolumna zostawia pod sobą pustkę. */}
              <div className="kolumna szeroka">
                <Budzet
                  wydatki={stan.wydatki}
                  wydane={wydatkiMiesiaca(stan, klucz)}
                  kroki={stan.kroki[klucz] ?? {}}
                  dodaj={dodajWydatek}
                  usun={usunWydatek}
                />
                <Miernik saldo={saldo(plan, stan)} />
              </div>

              <div className="kolumna">
                <Rozdysponowanie
                  kroki={stan.kroki[klucz] ?? {}}
                  przelacz={(krokId) => przelaczKrok(klucz, krokId)}
                  wplaty={stan.wplaty}
                  funduszPelny={
                    stanFunduszu(stan.wydatki, plan, stan.kroki).saldo >=
                    (plan.funduszPoziomRoboczy ?? Infinity)
                  }
                />
                <Wplaty wplaty={stan.wplaty} dodaj={dodajWplate} usun={usunWplate} />
              </div>

              <div className="kolumna">
                <Kamienie saldo={saldo(plan, stan)} />
                <Fundusz wydatki={stan.wydatki} kroki={stan.kroki} usun={usunWydatek} />
                <Daty />
              </div>
            </div>
          )}

          <Konto email={email} />
        </main>
      </DostawcaZwiniec>
    </DostawcaPlanu>
  );
}
