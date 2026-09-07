'use client';

import { useMemo, useState } from 'react';
import { usePlan } from '@/lib/PlanKontekst';
import { Karta } from './Karta';
import { nazwaMiesiaca, kluczMiesiaca, budzetDlaMiesiaca } from '@/lib/plan';
import { zl, zlDokladnie, odmiana } from '@/lib/format';
import {
  KOLOR_TYPU,
  NAZWA_TYPU,
  KATEGORIE,
  KATEGORIA_DOMYSLNA,
  typKategorii,
} from '@/lib/kategorie';
import {
  budzetowe,
  miesiaceZWydatkami,
  odNajnowszych,
  podsumujMiesiac,
  porownajZPoprzednim,
  poprzedniMiesiac,
  prognozaMiesiaca,
  wydatkiZMiesiaca,
  type Wydatek,
} from '@/lib/zakupy';

/* ── Wykres: podział na stałe, zmienne i uznaniowe ──────────
   Jeden pasek złożony z trzech części. Odstęp 2px między nimi robi tło,
   nie obramowanie — dzięki temu granica jest widoczna także przy druku
   i w trybie wysokiego kontrastu. */
function PasekTypow({
  wgTypu,
}: {
  wgTypu: { typ: keyof typeof NAZWA_TYPU; kwota: number; udzial: number }[];
}) {
  const widoczne = wgTypu.filter((t) => t.kwota > 0);
  if (widoczne.length === 0) return null;

  return (
    <>
      <div className="pasek-zlozony" role="img" aria-label="Podział wydatków na stałe, zmienne i uznaniowe">
        {widoczne.map((t) => (
          <span
            key={t.typ}
            style={{ flexGrow: t.kwota, background: KOLOR_TYPU[t.typ] }}
            title={`${NAZWA_TYPU[t.typ]}: ${zl(t.kwota)}`}
          />
        ))}
      </div>
      <div className="legenda">
        {widoczne.map((t) => (
          <span className="legenda-poz" key={t.typ}>
            <span className="kropka" style={{ background: KOLOR_TYPU[t.typ] }} />
            <span className="legenda-nazwa">{NAZWA_TYPU[t.typ]}</span>
            <span className="legenda-kwota mono">
              {zl(t.kwota)} · {Math.round(t.udzial * 100)}%
            </span>
          </span>
        ))}
      </div>
    </>
  );
}

/* ── Wykres: kategorie od największej ───────────────────────
   Poziome słupki, każdy podpisany nazwą i kwotą. Kolor niesie tylko typ
   wydatku i nigdy nie jest jedynym nośnikiem informacji. */
function SlupkiKategorii({
  pozycje,
}: {
  pozycje: { klucz: string; nazwa: string; kwota: number; udzial: number; liczba: number }[];
}) {
  const max = Math.max(...pozycje.map((p) => p.kwota), 1);

  return (
    <div className="slupki">
      {pozycje.map((p) => {
        const typ = typKategorii(p.klucz);
        return (
          <div className="slupek" key={p.klucz}>
            <div className="slupek-glowka">
              <span className="slupek-nazwa">{p.nazwa}</span>
              <span className="slupek-kwota mono">
                {zl(p.kwota)}
                <span className="slupek-udzial"> {Math.round(p.udzial * 100)}%</span>
              </span>
            </div>
            <div className="slupek-tor">
              <span style={{ width: `${(p.kwota / max) * 100}%`, background: KOLOR_TYPU[typ] }} />
            </div>
            <span className="slupek-podpis">
              {NAZWA_TYPU[typ].toLowerCase()} · {p.liczba}{' '}
              {odmiana(p.liczba, 'wydatek', 'wydatki', 'wydatków')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Widok ──────────────────────────────────────────────── */

export function Zakupy({
  wydatki: wszystkie,
  usun,
}: {
  wydatki: Wydatek[];
  usun: (id: string) => void;
}) {
  const plan = usePlan();
  // Ten widok rozlicza budżet bieżący, więc wydatki z funduszu tu nie wchodzą
  // — mają własną kartę na Panelu.
  const wydatki = useMemo(() => budzetowe(wszystkie), [wszystkie]);
  const biezacy = kluczMiesiaca(new Date());
  const [miesiac, ustawMiesiac] = useState(biezacy);
  const [kategoriaFiltr, ustawKategorieFiltr] = useState<string | null>(null);

  const dostepne = useMemo(() => {
    const z = miesiaceZWydatkami(wydatki);
    return z.includes(biezacy) ? z : [biezacy, ...z];
  }, [wydatki, biezacy]);

  const podsumowanie = useMemo(() => podsumujMiesiac(wydatki, miesiac), [wydatki, miesiac]);
  const zmiany = useMemo(() => porownajZPoprzednim(wydatki, miesiac), [wydatki, miesiac]);
  const pozycje = useMemo(
    () => wydatkiZMiesiaca(wydatki, miesiac).sort(odNajnowszych),
    [wydatki, miesiac],
  );

  const indeks = dostepne.indexOf(miesiac);
  const przejdz = (o: number) => {
    const cel = dostepne[indeks + o];
    if (cel) {
      ustawMiesiac(cel);
      ustawKategorieFiltr(null);
    }
  };

  const prognoza = prognozaMiesiaca(podsumowanie);
  const budzet = budzetDlaMiesiaca(plan, miesiac);
  const uznaniowe = podsumowanie.wgTypu.find((t) => t.typ === 'uznaniowy')?.kwota ?? 0;
  const pusty = podsumowanie.liczba === 0;


  /* Kategorie jako zakładki, nie nagłówki w jednej liście — łatwiej znaleźć
     "ile poszło na jedzenie" jednym kliknięciem, niż szukać wzrokiem sekcji
     w długim scrollu. */
  const kolejnoscKategorii = podsumowanie.wgKategorii.map((k) => k.klucz);
  const sumyKategorii = new Map<string, { liczba: number; suma: number }>();
  for (const w of pozycje) {
    const klucz = w.kategoria ?? KATEGORIA_DOMYSLNA;
    const wpis = sumyKategorii.get(klucz) ?? { liczba: 0, suma: 0 };
    sumyKategorii.set(klucz, { liczba: wpis.liczba + 1, suma: wpis.suma + w.kwota });
  }
  const kategorieZakladki = kolejnoscKategorii
    .filter((k) => sumyKategorii.has(k))
    .map((k) => ({
      klucz: k,
      nazwa: KATEGORIE.find((x) => x.id === k)?.nazwa ?? 'Inne',
      ...sumyKategorii.get(k)!,
    }));
  const sumaWszystkich = pozycje.reduce((s, w) => s + w.kwota, 0);

  const listaWidoczna = kategoriaFiltr
    ? pozycje.filter((w) => (w.kategoria ?? KATEGORIA_DOMYSLNA) === kategoriaFiltr)
    : pozycje;

  const nazwaFiltra = kategoriaFiltr
    ? KATEGORIE.find((k) => k.id === kategoriaFiltr)?.nazwa ?? 'Inne'
    : null;

  return (
    <>
      <div className="panel">
        <div className="kolumna szeroka">
          {/* Nagłówek miesiąca — jedna liczba, którą się czyta pierwszą. */}
          <Karta
            id="zakupy-miesiac"
            klasaGlowki="wybor-miesiaca"
            tytul={nazwaMiesiaca(miesiac)}
            przed={
              <button
                className="przycisk cichy"
                onClick={() => przejdz(1)}
                disabled={indeks >= dostepne.length - 1}
                aria-label="Poprzedni miesiąc"
              >
                ‹
              </button>
            }
            dodatek={
              <button
                className="przycisk cichy"
                onClick={() => przejdz(-1)}
                disabled={indeks <= 0}
                aria-label="Następny miesiąc"
              >
                ›
              </button>
            }
          >
            <div className="hero-kwota">
              <span className="duza">{zl(podsumowanie.suma)}</span>
              <span className="cel">z budżetu {zl(budzet)}</span>
            </div>

            {pusty ? (
              <p className="lista-pusta">
                Brak wydatków w tym miesiącu. Dopisz je w karcie Budżet bieżący.
              </p>
            ) : (
              <>
                <p className="hero-podpis">
                  {podsumowanie.liczba}{' '}
                  {odmiana(podsumowanie.liczba, 'wydatek', 'wydatki', 'wydatków')} w{' '}
                  {podsumowanie.dniZWydatkami}{' '}
                  {odmiana(podsumowanie.dniZWydatkami, 'dniu', 'dniach', 'dniach')}
                  {miesiac === biezacy && (
                    <>
                      {' '}· przy tym tempie miesiąc zamknie się na{' '}
                      <strong>{zl(prognoza)}</strong>
                    </>
                  )}
                </p>
                <PasekTypow wgTypu={podsumowanie.wgTypu} />
                <p className="notka">
                  Z {zl(podsumowanie.suma)} w tym miesiącu tylko{' '}
                  <strong style={{ color: 'var(--brass)' }}>{zl(uznaniowe)}</strong> poszło na
                  rzeczy, które mogłeś sobie odpuścić. Reszta to umowy i zakupy konieczne —
                  żeby wydać mniej, musiałbyś wypowiedzieć jakąś umowę, a nie bardziej się pilnować.
                </p>
              </>
            )}
          </Karta>

          {!pusty && (
            <Karta
              id="zakupy-lista"
              opoznienie={320}
              tytul={
                <>
                  Wszystkie wydatki miesiąca
                  {nazwaFiltra && ` · ${nazwaFiltra}`}
                </>
              }
            >
              {kategorieZakladki.length > 1 && (
                <div className="filtr-kategorii">
                  <button
                    className={`chip filtr${kategoriaFiltr === null ? ' wybrany' : ''}`}
                    onClick={() => ustawKategorieFiltr(null)}
                  >
                    Wszystkie
                    <span className="chip-kwota mono">{zl(sumaWszystkich)}</span>
                    <span className="chip-licznik">{pozycje.length}</span>
                  </button>
                  {kategorieZakladki.map((k) => (
                    <button
                      key={k.klucz}
                      className={`chip filtr${kategoriaFiltr === k.klucz ? ' wybrany' : ''}`}
                      onClick={() =>
                        ustawKategorieFiltr(kategoriaFiltr === k.klucz ? null : k.klucz)
                      }
                    >
                      <span
                        className="kropka"
                        style={{ background: KOLOR_TYPU[typKategorii(k.klucz)] }}
                      />
                      {k.nazwa}
                      <span className="chip-kwota mono">{zl(k.suma)}</span>
                      <span className="chip-licznik">{k.liczba}</span>
                    </button>
                  ))}
                </div>
              )}

              {listaWidoczna.length === 0 && (
                <p className="lista-pusta">Nic w tej kategorii.</p>
              )}
              {listaWidoczna.map((w) => (
                <div className="wiersz" key={w.id}>
                  <span className="opis">
                    <span className="glowny">
                      <span
                        className="kropka"
                        style={{ background: KOLOR_TYPU[typKategorii(w.kategoria)] }}
                      />
                      {w.opis}
                    </span>
                    <span className="mono" style={{ fontSize: 11.5 }}>
                      {w.data}
                      {!kategoriaFiltr &&
                        ` · ${KATEGORIE.find((k) => k.id === w.kategoria)?.nazwa ?? 'Inne'}`}
                      {w.sklep && ` · ${w.sklep}`}
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
            </Karta>
          )}
        </div>

        {!pusty && (
          <>
            <div className="kolumna">
              <Karta id="zakupy-kategorie" tytul="Na co idą pieniądze" opoznienie={80}>
                <SlupkiKategorii pozycje={podsumowanie.wgKategorii} />
              </Karta>
            </div>

            <div className="kolumna">
              {zmiany.length > 0 && (
                <Karta
                  id="zakupy-zmiana"
                  tytul={`Zmiana wobec ${nazwaMiesiaca(poprzedniMiesiac(miesiac))}`}
                  opoznienie={260}
                >
                  {zmiany.slice(0, 8).map((z) => (
                    <div className="wiersz" key={z.klucz}>
                      <span className="opis">
                        <span className="glowny">{z.nazwa}</span>
                        {zl(z.wczesniej)} → {zl(z.teraz)}
                      </span>
                      <span className={`wartosc ${z.roznica > 0 ? 'ostrzezenie' : 'dodatnia'}`}>
                        {z.roznica > 0 ? '+' : '−'}
                        {zl(Math.abs(z.roznica))}
                      </span>
                    </div>
                  ))}
                </Karta>
              )}
            </div>

          </>
        )}
      </div>
    </>
  );
}
