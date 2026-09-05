'use client';

import {
  poPodatkach,
  kluczMiesiaca,
  obciazeniaMiesiaca,
  resztaNaPoduszke,
  krokiRozdysponowania,
} from '@/lib/plan';
import { usePlan } from '@/lib/PlanKontekst';
import { Karta } from './Karta';
import { zl, odmiana } from '@/lib/format';

/**
 * Skąd biorą się pieniądze i dokąd idą — od faktury do kont docelowych.
 * To jest odpowiedź na pytanie „o co tu właściwie chodzi".
 *
 * Nazwy kont i opisy pochodzą WYŁĄCZNIE z planu. Wcześniej były wpisane
 * na sztywno w tym pliku i przez to trafiały do publicznego buildu —
 * kwot tam nie było, ale było widać, w jakich bankach trzymasz pieniądze.
 */
export function Przeplyw() {
  const plan = usePlan();
  const klucz = kluczMiesiaca(new Date());
  const zostaje = poPodatkach(plan, klucz);

  // Przelewy wychodzące z konta, na które wpływa faktura.
  const przelewy = krokiRozdysponowania(plan, klucz)
    .filter((k) => k.skad === plan.przeplyw.konto && k.dokad && k.kwota !== undefined)
    .map((k) => ({
      tytul: k.tytul,
      konto: k.dokad as string,
      kwota: k.kwota === null ? resztaNaPoduszke(plan) : (k.kwota as number),
    }));

  const rozdysponowane = przelewy.reduce((s, p) => s + p.kwota, 0);
  const roznica = zostaje - rozdysponowane;

  return (
    <Karta
      id="przeplyw"
      tytul="Przepływ miesiąca"
      opoznienie={60}
      dodatek={<span className="mono licznik">{plan.przeplyw.zrodlo}</span>}
    >
      <div className="przeplyw">
        <div className="etap zrodlo">
          <span className="mono etap-kwota">{zl(plan.przeplyw.kwotaBrutto)}</span>
          <span className="etap-opis">wpływa na {plan.przeplyw.konto}</span>
        </div>

        <div className="etap odjecia">
          <span className="etap-naglowek">Najpierw odkładasz — to nie są twoje pieniądze</span>
          {obciazeniaMiesiaca(plan, klucz).map((o) => (
            <div className="wiersz-przeplyw" key={o.nazwa}>
              <span className="opis">{o.nazwa}</span>
              <span className="mono wartosc">
                {o.kwota === 0 ? '—' : `− ${zl(o.kwota)}`}
                <span className="termin">{o.termin}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="etap zostaje">
          <span className="mono etap-kwota akcent">{zl(zostaje)}</span>
          <span className="etap-opis">zostaje do rozdysponowania</span>
        </div>

        <div className="etap rozdzial">
          <span className="etap-naglowek">
            {przelewy.length}{' '}
            {odmiana(przelewy.length, 'przelew', 'przelewy', 'przelewów')} z tego konta
          </span>
          {przelewy.map((p, i) => (
            <div
              className={`wiersz-przeplyw ${i === przelewy.length - 1 ? 'cel' : 'neutralny'}`}
              key={p.konto + p.tytul}
            >
              <span className="opis">
                <span className="glowny">{p.konto}</span>
                {p.tytul}
              </span>
              <span className="mono wartosc">{zl(p.kwota)}</span>
            </div>
          ))}
        </div>

        {Math.abs(roznica) >= 50 && (
          <p className="notka roznica">
            {roznica > 0
              ? `Nieprzypisane: ${zl(roznica)}. Dorzuć do poduszki albo sprawdź, czy szacunki podatków są aktualne.`
              : `Brakuje ${zl(-roznica)}. Szacunki podatków są zaniżone albo faktura była niższa.`}
          </p>
        )}
      </div>
    </Karta>
  );
}
