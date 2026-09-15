'use client';

import {
  kluczMiesiaca,
  nazwaDaty,
  dniDo,
  stanPromocji,
  wyplatyPromocji,
  promocjaAktywna,
  zostaloZPromocji,
  czyOdebrana,
  miesiacWyplaty,
  type Promocja,
} from '@/lib/plan';
import { usePlan } from '@/lib/PlanKontekst';
import { Karta } from './Karta';
import { PasekPostepu, PrzyciskKroku } from './Checklista';
import { KrokiMiesiaca } from './KrokiMiesiaca';
import { Daty } from './Daty';
import { zl, dni, odmiana } from '@/lib/format';

type Kroki = Record<string, Record<string, boolean>>;

/**
 * Ile pieniędzy wisi w bankach i kiedy wpada najbliższa transza.
 * Ta jedna liczba jest powodem istnienia całej zakładki — przy kilku bankach
 * ginęła między checklistami warunków.
 */
function Podsumowanie({ kroki }: { kroki: Kroki }) {
  const plan = usePlan();
  const { lacznie, odebrane, zostalo, najblizsza } = stanPromocji(plan, kroki);
  const udzial = lacznie > 0 ? (odebrane / lacznie) * 100 : 0;

  return (
    <Karta id="banki-podsumowanie" tytul="Do odebrania z promocji">
      <p className="hero-kwota mono">{zl(zostalo)}</p>
      <p className="hero-podpis">
        {odebrane > 0
          ? `odebrane ${zl(odebrane)} z ${zl(lacznie)}`
          : `z ${zl(lacznie)} rozpisanych w planie`}
      </p>

      <div className="pasek" aria-hidden="true">
        <span style={{ width: `${udzial}%` }} />
      </div>

      {najblizsza ? (
        <div className="wiersz">
          <span className="opis">
            <span className="glowny">Najbliższa wypłata</span>
            {najblizsza.bank} — {najblizsza.za}
          </span>
          <span className="wartosc akcent">
            <span style={{ display: 'block' }} className="mono">
              {zl(najblizsza.kwota)}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>
              do {nazwaDaty(najblizsza.do)}
            </span>
          </span>
        </div>
      ) : (
        <p className="lista-pusta">Wszystko odebrane.</p>
      )}
    </Karta>
  );
}

/** Jedna promocja: co robić w tym miesiącu i ile z niej jeszcze wpadnie. */
function KartaPromocji({
  promocja,
  kroki,
  opoznienie,
}: {
  promocja: Promocja;
  kroki: Kroki;
  opoznienie: number;
}) {
  const klucz = kluczMiesiaca(new Date());
  const aktywna = promocjaAktywna(promocja, klucz);
  const { kwota, sztuk } = zostaloZPromocji(promocja, kroki);
  const zebrane = promocja.wyplaty.length - sztuk;

  // Przed startem okna warunków nie ma czego pilnować — a to najczęstsze
  // źródło paniki: konto założone we wrześniu, warunki biegną od października.
  const przedStartem = Boolean(promocja.od && promocja.od > klucz);
  const poKoncu = Boolean(promocja.do && promocja.do < klucz);

  return (
    <Karta
      id={`promocja-${promocja.id}`}
      tytul={promocja.bank}
      opoznienie={opoznienie}
      dodatek={<span className="mono kwota-znacznik">{zl(kwota)}</span>}
    >
      <p className="notka">
        {promocja.nazwa}
        {promocja.konto && ` · ${promocja.konto}`}
      </p>

      <PasekPostepu zrobione={zebrane} wszystkie={promocja.wyplaty.length} />
      <p className="hero-podpis">
        {zebrane} z {promocja.wyplaty.length}{' '}
        {odmiana(promocja.wyplaty.length, 'transza', 'transze', 'transz')} odebrane
      </p>

      <div className="faza">
        <span className="faza-tytul">
          {przedStartem
            ? `Warunki ruszają ${promocja.od}`
            : poKoncu
              ? 'Warunki zakończone — czekasz na wypłaty'
              : 'Co miesiąc'}
        </span>
        <ul className="warunki">
          {promocja.warunki.map((w, i) => (
            <li key={i} data-nieaktywna={!aktywna}>
              {w}
            </li>
          ))}
        </ul>
      </div>

      {promocja.uwaga && <p className="uwaga">{promocja.uwaga}</p>}
    </Karta>
  );
}

/**
 * Oś czasu wszystkich transz, ze wszystkich banków naraz.
 *
 * Odhaczenie zapisuje się tak samo jak krok miesiąca — pod kluczem miesiąca,
 * w którym wypada termin. Dzięki temu nie trzeba było nowego magazynu ani
 * nowej ścieżki w regułach Firestore.
 */
function Harmonogram({
  kroki,
  przelacz,
}: {
  kroki: Kroki;
  przelacz: (klucz: string, id: string) => void;
}) {
  const plan = usePlan();
  const dzis = new Date();
  const wyplaty = wyplatyPromocji(plan);

  return (
    <Karta id="banki-harmonogram" tytul="Harmonogram wypłat" opoznienie={160}>
      {wyplaty.length === 0 && <p className="lista-pusta">Brak promocji w planie.</p>}

      <div className="lista-wyplat">
      {wyplaty.map((w) => {
        const odebrana = czyOdebrana(w, kroki);
        const zostalo = dniDo(w.do, dzis);
        const spoznona = !odebrana && zostalo < 0;

        return (
          <PrzyciskKroku
            key={w.id}
            zrobione={odebrana}
            przelacz={() => przelacz(miesiacWyplaty(w), w.id)}
          >
              <span className="krok-glowka">
                <span className="tytul">{w.bank}</span>
                <span className="mono kwota-znacznik">{zl(w.kwota)}</span>
                <span className="kiedy">{w.za}</span>
              </span>

              <span className="podpis">
                do {nazwaDaty(w.do)}
                {!odebrana &&
                  (spoznona
                    ? ` · termin minął ${dni(-zostalo)} temu`
                    : zostalo === 0
                      ? ' · dziś'
                      : ` · za ${dni(zostalo)}`)}
              </span>

              {spoznona && (
                <span className="uwaga">
                  Sprawdź konto. Jeśli nie wpłynęło — reklamacja u banku.
                </span>
              )}
          </PrzyciskKroku>
        );
      })}
      </div>
    </Karta>
  );
}

export function Banki({
  kroki,
  przelacz,
}: {
  kroki: Kroki;
  przelacz: (klucz: string, id: string) => void;
}) {
  const plan = usePlan();
  const promocje = plan.promocje ?? [];
  const klucz = kluczMiesiaca(new Date());

  if (promocje.length === 0) {
    return (
      <div className="panel">
        <div className="kolumna szeroka">
          <Karta id="banki-brak" tytul="Promocje bankowe">
            <p className="lista-pusta">
              Plan nie ma jeszcze sekcji „promocje". Dodaj ją przez
              <span className="mono"> npm run baza plan-popraw</span>.
            </p>
          </Karta>
        </div>
      </div>
    );
  }

  // Promocje na przemian do dwóch kolumn — przy pięciu bankach jedna kolumna
  // rośnie w nieskończoność, a panel ma trzy i tak.
  const lewa = promocje.filter((_, i) => i % 2 === 0);
  const prawa = promocje.filter((_, i) => i % 2 === 1);

  return (
    <div className="panel">
      <div className="kolumna szeroka">
        <Podsumowanie kroki={kroki} />
        <KrokiMiesiaca
          kroki={kroki[klucz] ?? {}}
          przelacz={(krokId) => przelacz(klucz, krokId)}
        />
      </div>

      <div className="kolumna">
        {lewa.map((p, i) => (
          <KartaPromocji key={p.id} promocja={p} kroki={kroki} opoznienie={80 + i * 60} />
        ))}
      </div>

      <div className="kolumna">
        {prawa.map((p, i) => (
          <KartaPromocji key={p.id} promocja={p} kroki={kroki} opoznienie={110 + i * 60} />
        ))}
        <Daty zakres="bank" />
      </div>

      {/* Harmonogram dostaje własny wiersz na pełną szerokość: przy trzech
          bankach ma dwadzieścia parę transz i w kolumnie rozciągał siatkę
          tak, że obok zostawała pusta połowa ekranu. */}
      <div className="kolumna pelna">
        <Harmonogram kroki={kroki} przelacz={przelacz} />
      </div>
    </div>
  );
}
