import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** Firebase jest opcjonalny — bez konfiguracji apka działa na localStorage. */
export const firebaseWlaczony = Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

async function init() {
  if (!firebaseWlaczony) return null;
  if (app && auth && db) return { app, auth, db };

  const { initializeApp, getApps, getApp } = await import('firebase/app');
  const { getAuth } = await import('firebase/auth');
  const { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } =
    await import('firebase/firestore');

  app = getApps().length ? getApp() : initializeApp(config as Record<string, string>);
  auth = getAuth(app);
  // Trwały cache zamiast ręcznego kopiowania stanu do localStorage:
  // apka wstaje offline, a zapisy zrobione bez sieci Firestore wysyła sam,
  // gdy wróci połączenie. Menedżer wielu kart pozwala mieć apkę otwartą
  // na telefonie i w przeglądarce naraz bez rozjeżdżania się cache.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  return { app, auth, db };
}

/**
 * Sytuacje, w których okienko popup nie ma jak się otworzyć.
 *
 * `popup-closed-by-user` i `cancelled-popup-request` celowo NIE są tutaj:
 * to znaczy, że okno się otworzyło, a człowiek je zamknął. Przeładowanie
 * strony w odpowiedzi na świadomą rezygnację byłoby wrogie.
 */
const POPUP_NIE_DZIALA = new Set([
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
]);

/**
 * Logowanie: najpierw popup, a gdy przeglądarka go nie wpuści — przekierowanie.
 *
 * Popup jest domyślny, bo nie gubi stanu strony. Ale apka dodana do ekranu
 * głównego chodzi w trybie standalone, gdzie systemowa przeglądarka potrafi
 * popup zablokować — i wtedy jedynym wyjściem jest przekierowanie.
 *
 * WARUNEK: przekierowanie domyka się tylko wtedy, gdy `authDomain` wskazuje tę
 * samą domenę co apka. Przy domyślnej domenie `…firebaseapp.com` przeglądarki
 * blokują przeniesienie sesji między domenami i powrót kończy się niczym.
 * Dlatego `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` ma wskazywać domenę hostingu,
 * a w kliencie OAuth (konsola Google Cloud) musi być wcześniej dopisany
 * jej adres `/__/auth/handler` jako autoryzowany identyfikator URI.
 */
export async function zalogujGoogle(): Promise<User | null> {
  const f = await init();
  if (!f) return null;
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import(
    'firebase/auth'
  );
  const dostawca = new GoogleAuthProvider();

  try {
    const wynik = await signInWithPopup(f.auth, dostawca);
    return wynik.user;
  } catch (e) {
    const kod = (e as { code?: string })?.code ?? '';
    if (!POPUP_NIE_DZIALA.has(kod)) throw e;
    // Strona zaraz zniknie — wynik odbierze `dokonczLogowanie()` po powrocie.
    await signInWithRedirect(f.auth, dostawca);
    return null;
  }
}

/** Domyka logowanie po powrocie z przekierowania. Błędy wracają do wywołującego. */
export async function dokonczLogowanie(): Promise<void> {
  const f = await init();
  if (!f) return;
  const { getRedirectResult } = await import('firebase/auth');
  await getRedirectResult(f.auth);
}

export async function wyloguj(): Promise<void> {
  const f = await init();
  if (!f) return;
  const { signOut } = await import('firebase/auth');
  await signOut(f.auth);
}

export async function obserwujUzytkownika(cb: (u: User | null) => void): Promise<() => void> {
  const f = await init();
  if (!f) {
    cb(null);
    return () => {};
  }
  const { onAuthStateChanged } = await import('firebase/auth');
  return onAuthStateChanged(f.auth, cb);
}

/* ── Stan: wpłaty, wydatki, odhaczone kroki ─────────────────
   Każdy wpis to osobny dokument w podkolekcji, nie pole w jednym wielkim
   dokumencie stanu. Powody:

   1. Dopisanie wydatku zapisuje jeden dokument zamiast całego stanu, więc
      telefon i narzędzie z wiersza poleceń przestają się nawzajem kasować.
      Przy poprzednim układzie każdy zapis nadpisywał wszystko naraz.
   2. Limit 1 MiB liczy się na dokument. Przy 146 bajtach na wydatek stary
      układ mieścił ~7200 pozycji — mniej, niż liczy historia rachunku.
   3. Da się pytać bazę o miesiąc albo sklep zamiast pobierać komplet. */

export type NazwaKolekcji = 'wydatki' | 'wplaty' | 'kroki';

/** Nasłuch na żywo. Zwraca funkcję odsubskrybowania. */
export async function subskrybuj<T>(
  uid: string,
  kolekcja: NazwaKolekcji,
  cb: (pozycje: (T & { id: string })[]) => void,
): Promise<() => void> {
  const f = await init();
  if (!f) return () => {};
  const { collection, onSnapshot } = await import('firebase/firestore');

  return onSnapshot(
    collection(f.db, 'uzytkownicy', uid, kolekcja),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }))),
    // Błąd nasłuchu nie może wywrócić apki — najczęściej to brak sieci
    // albo odrzucenie przez reguły. Dane z cache zostają na ekranie.
    (blad) => console.error(`Nasłuch ${kolekcja}:`, blad.message),
  );
}

export async function zapiszPozycje(
  uid: string,
  kolekcja: NazwaKolekcji,
  id: string,
  dane: Record<string, unknown>,
): Promise<void> {
  const f = await init();
  if (!f) return;
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(f.db, 'uzytkownicy', uid, kolekcja, id), dane, { merge: true });
}

export async function usunPozycje(
  uid: string,
  kolekcja: NazwaKolekcji,
  id: string,
): Promise<void> {
  const f = await init();
  if (!f) return;
  const { doc, deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(f.db, 'uzytkownicy', uid, kolekcja, id));
}

/* ── Profil: preferencje UI ──────────────────────────────────
   Jeden dokument `uzytkownicy/{uid}`, nie podkolekcja — to nie dane
   finansowe, tylko drobna preferencja (co jest zwinięte), więc nie
   potrzebuje własnej historii ani osobnych zapytań. `merge: true` na
   zagnieżdżonej mapie aktualizuje tylko podane klucze, więc dwie karty
   zwijane niemal jednocześnie (telefon i przeglądarka) nie kasują się
   nawzajem. */

export async function subskrybujProfil(
  uid: string,
  cb: (dane: Record<string, unknown>) => void,
): Promise<() => void> {
  const f = await init();
  if (!f) {
    cb({});
    return () => {};
  }
  const { doc, onSnapshot } = await import('firebase/firestore');
  return onSnapshot(
    doc(f.db, 'uzytkownicy', uid),
    (snap) => cb(snap.data() ?? {}),
    (blad) => console.error('Nasłuch profilu:', blad.message),
  );
}

export async function zapiszProfil(uid: string, dane: Record<string, unknown>): Promise<void> {
  const f = await init();
  if (!f) return;
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(f.db, 'uzytkownicy', uid), dane, { merge: true });
}

/* ── Plan: kwoty, daty, kroki ───────────────────────────────
   Osobna kolekcja, nie pole w dokumencie stanu. Powód: stan jest
   nadpisywany w całości przy każdej zmianie, więc plan trzymany obok
   niego prędzej czy później zostałby przypadkiem skasowany. Do tego
   plan zmienia się rzadko i ma zupełnie inny cykl życia. */

/**
 * Nasłuch planu. Apka go wyłącznie czyta — zapisuje `npm run baza plan-zapisz`,
 * więc podmiana planu ma się pojawić na ekranie tak samo jak dopisany wydatek.
 */
export async function subskrybujPlan<T>(
  uid: string,
  cb: (plan: T | null) => void,
  przyBledzie: (blad: Error) => void,
): Promise<() => void> {
  const f = await init();
  if (!f) {
    przyBledzie(new Error('Firebase nie jest skonfigurowany — uzupełnij .env.local.'));
    return () => {};
  }
  const { doc, onSnapshot } = await import('firebase/firestore');

  return onSnapshot(
    doc(f.db, 'plany', uid),
    (snap) => cb(snap.exists() ? ((snap.data() as { plan?: T }).plan ?? null) : null),
    (blad) => przyBledzie(blad),
  );
}

