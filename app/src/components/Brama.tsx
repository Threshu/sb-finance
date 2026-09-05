'use client';

import { useEffect, useState } from 'react';
import { firebaseWlaczony, zalogujGoogle, dokonczLogowanie } from '@/lib/firebase';

/**
 * Kod błędu Firebase na zdanie po polsku. Kod zostaje widoczny — bez niego
 * „spróbuj jeszcze raz" nie mówi nic ani tobie, ani mnie przy diagnozie.
 */
function opiszBlad(e: unknown): string {
  const kod = (e as { code?: string })?.code ?? '';
  const opisy: Record<string, string> = {
    'auth/unauthorized-domain':
      'Ta domena nie jest dopuszczona w Firebase Auth. Dodaj ją w Authentication → Settings → Authorized domains.',
    'auth/operation-not-allowed':
      'Logowanie przez Google jest wyłączone w projekcie. Włącz je w Authentication → Sign-in method.',
    'auth/popup-blocked': 'Przeglądarka zablokowała okienko logowania.',
    'auth/popup-closed-by-user': 'Okno logowania zostało zamknięte.',
    'auth/cancelled-popup-request': 'Logowanie zostało przerwane.',
    'auth/network-request-failed': 'Brak połączenia z siecią.',
  };
  const opis = opisy[kod] ?? 'Logowanie się nie udało.';
  return kod ? `${opis} (${kod})` : opis;
}

/**
 * Ekran przed panelem.
 *
 * Panel nie pokazuje ani jednej kwoty, dopóki plan nie zostanie wczytany
 * z Firestore. Dzięki temu publiczny build nie zawiera żadnych danych —
 * a to on jest serwowany pod adresem, do którego każdy ma dostęp.
 */

export function EkranLogowania() {
  const [zajete, ustawZajete] = useState(false);
  const [blad, ustawBlad] = useState<string | null>(null);

  // Po powrocie z przekierowania (telefon) błąd wyszedłby w próżnię —
  // tutaj go przechwytujemy i pokazujemy.
  useEffect(() => {
    dokonczLogowanie().catch((e: unknown) => ustawBlad(opiszBlad(e)));
  }, []);

  async function zaloguj() {
    ustawZajete(true);
    ustawBlad(null);
    try {
      await zalogujGoogle();
    } catch (e) {
      ustawBlad(opiszBlad(e));
      ustawZajete(false);
    }
  }

  return (
    <section className="karta brama pojawia">
      <span className="etykieta">Dostęp</span>
      <h2 className="brama-tytul">Zaloguj się, żeby zobaczyć plan</h2>
      <p className="notka">
        Kwoty, daty i kroki są przechowywane w twojej bazie, nie w kodzie aplikacji.
        Bez zalogowania ta strona nie zawiera żadnych danych finansowych.
      </p>

      {!firebaseWlaczony ? (
        <p className="notka" style={{ color: 'var(--rust)' }}>
          Firebase nie jest skonfigurowany — uzupełnij <code>.env.local</code>.
        </p>
      ) : (
        <>
          <button className="przycisk" onClick={zaloguj} disabled={zajete} style={{ marginTop: 14 }}>
            {zajete ? 'Łączę…' : 'Zaloguj przez Google'}
          </button>
          {blad && (
            <p className="notka" style={{ color: 'var(--rust)' }}>
              {blad}
            </p>
          )}
        </>
      )}
    </section>
  );
}

/**
 * Zalogowany, ale w bazie nie ma planu albo plan jest niepoprawny.
 *
 * Nie ma tu przycisku, bo plan zmienia się wyłącznie z wiersza poleceń
 * (`npm run baza plan-zapisz`) — apka go tylko czyta. Ekran ma powiedzieć,
 * co się stało, a nie udawać, że da się to naprawić stąd.
 */
export function EkranBrakPlanu({ blad, email }: { blad: string | null; email: string | null }) {
  return (
    <section className="karta brama pojawia">
      <span className="etykieta">Brak planu</span>
      <h2 className="brama-tytul">Nie ma czego pokazać</h2>
      <p className="notka">
        Kwoty, daty i kroki miesiąca siedzą w bazie. Albo ich tam nie ma, albo plan
        nie przeszedł sprawdzenia.
        {email && <> Zalogowany jako {email}.</>}
      </p>
      {blad && (
        <p className="notka" style={{ color: 'var(--rust)' }}>
          {blad}
        </p>
      )}
    </section>
  );
}
