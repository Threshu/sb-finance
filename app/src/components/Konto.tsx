'use client';

import { useState } from 'react';
import { zalogujGoogle, wyloguj } from '@/lib/firebase';

export function Konto({ email }: { email: string | null }) {
  const [zajete, ustawZajete] = useState(false);
  const [blad, ustawBlad] = useState<string | null>(null);

  async function przelacz() {
    ustawZajete(true);
    ustawBlad(null);
    try {
      if (email) await wyloguj();
      else await zalogujGoogle();
    } catch {
      ustawBlad('Nie udało się. Spróbuj jeszcze raz.');
    } finally {
      ustawZajete(false);
    }
  }

  return (
    <div className="stopka">
      <span className="etykieta">{email ? `Zsynchronizowane · ${email}` : 'Niezalogowany'}</span>
      <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {blad && <span className="notka" style={{ margin: 0, color: 'var(--rust)' }}>{blad}</span>}
        <button className="przycisk cichy" onClick={przelacz} disabled={zajete}>
          {email ? 'Wyloguj' : 'Zaloguj przez Google'}
        </button>
      </span>
    </div>
  );
}
