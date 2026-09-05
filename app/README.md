# Forteca

Aplikacja PWA do prowadzenia budowy poduszki bezpieczeństwa — jeden panel
z saldem, checklistą miesiąca i codziennym zapisem wydatków.

Next.js 15 (eksport statyczny) · React 19 · Firebase Auth + Firestore ·
Firebase Hosting.

## Główna zasada: w kodzie nie ma danych

Build jest statyczny i stoi na hostingu **bez żadnej autoryzacji** — każdy,
kto zna adres, czyta wszystkie pliki. Dlatego w repozytorium nie ma ani jednej
kwoty, daty, nazwy banku czy konta.

Wszystko to siedzi w Firestore, pod dokumentem właściciela, chronione regułami.
Aplikacja plan **wyłącznie czyta**. Przed zalogowaniem nie pokazuje żadnej liczby,
bo nie ma skąd jej wziąć.

Zasada obowiązuje też etykiety w komponentach. Nazwa źródła dochodu albo banku
wpisana „tymczasowo" w JSX jest nazwą opublikowaną w internecie.

## Uruchomienie

```bash
npm install
cp .env.example .env.local   # i uzupełnij danymi z konsoli Firebase
npm run dev
```

Konfiguracja Firebase jest wymagana — bez niej aplikacja pokaże ekran logowania
i nic poza tym.

### Projekt Firebase

1. Załóż projekt na [console.firebase.google.com](https://console.firebase.google.com)
2. **Authentication → Sign-in method → Google** — włącz
3. **Firestore Database** — utwórz w trybie produkcyjnym
4. Dodaj aplikację internetową i skopiuj konfigurację SDK do `.env.local`
5. Wgraj reguły bezpieczeństwa:

```bash
npx firebase deploy --only firestore:rules
```

Bez punktu 5 dane byłyby dostępne dla każdej zalogowanej osoby. Reguły
w [`firestore.rules`](firestore.rules) dopuszczają wyłącznie własne dokumenty.

## Struktura danych

```
uzytkownicy/{uid}                  profil: preferencje UI
uzytkownicy/{uid}/wydatki/{id}     jeden wydatek = jeden dokument
uzytkownicy/{uid}/wplaty/{id}
uzytkownicy/{uid}/kroki/{RRRR-MM}  odhaczone kroki miesiąca
plany/{uid}                        plan: kwoty, daty, kroki
```

Jeden wydatek to jeden dokument, nie pole w wielkim dokumencie stanu. Dzięki
temu zapis z telefonu i z wiersza poleceń nie kasują się nawzajem, a limit
1 MiB liczy się na wydatek, nie na całą historię.

Aplikacja nasłuchuje zmian na żywo (`onSnapshot`) — zapis z drugiego urządzenia
pojawia się od razu, bez odświeżania. Za offline odpowiada trwały cache
Firestore: aplikacja wstaje bez sieci, a zapisy zrobione offline wychodzą same
po powrocie połączenia.

## Wiersz poleceń

```bash
npm run baza stan                     # co jest w bazie
npm run baza wydatki 2026-09          # wydatki miesiąca
npm run baza plan                     # zrzut planu
npm run baza plan-zapisz plan.json    # podmiana planu (robi kopię starego)
npm run baza dodaj '{"kwota":12.99,"opis":"kawa","kategoria":"spozywcze"}'
```

Wymaga klucza konta serwisowego — domyślnie `~/.sekrety/sb-finance-firestore.json`
albo ścieżka w `GOOGLE_APPLICATION_CREDENTIALS`. **Klucz omija `firestore.rules`**,
więc trzyma się go poza repozytorium.

Zmiana planu to jedyna droga zmiany kwot i dat:

```
npm run baza plan > plan.json  →  edytujesz  →  npm run baza plan-zapisz plan.json
```

Plik pośredni kasuje się po zapisie — zostawiony zaraz zacznie kłamać.
Kształt planu sprawdza `sprawdzPlan` przy każdym wczytaniu, więc zły plan
zobaczysz jako komunikat, a nie jako pustą stronę.

## Wdrożenie

```bash
npm run build
npx firebase deploy --only hosting
```

`npm run sprawdz-wyciek` chodzi automatycznie przed wdrożeniem: bierze każdy
tekst z planu w bazie i szuka go w `out/`. Trafienie oznacza, że dana z bazy
weszła do publicznych plików — wtedy deploy staje. Etykiety raz uznane za
ogólne (nagłówki kart, identyfikatory kroków) są wypisane w samym skrypcie.

Po wejściu na adres z telefonu: menu przeglądarki → „Dodaj do ekranu głównego".
Ikonę i tryb pełnoekranowy opisuje [`public/manifest.json`](public/manifest.json).

## Układ kodu

| Ścieżka | Co robi |
|---|---|
| `src/lib/plan.ts` | typy planu, walidacja, projekcja, kamienie milowe |
| `src/lib/store.ts` | stan aplikacji: nasłuch Firestore i zapisy |
| `src/lib/planStore.ts` | nasłuch planu właściciela |
| `src/lib/firebase.ts` | Firebase ładowany dynamicznie, cały dostęp do bazy |
| `src/lib/zakupy.ts` | podsumowania miesiąca, prognoza, fundusz nieregularny |
| `src/lib/kategorie.ts` | kategorie wydatków, podział na typy, kolory |
| `src/lib/sugestie.ts` | podpowiedzi formularza liczone z historii |
| `src/components/Karta.tsx` | zwijana karta panelu — jedyne miejsce z tą logiką |
| `baza.mjs` | dostęp do Firestore z wiersza poleceń |
| `sprawdz-wyciek.mjs` | kontrola, czy plan nie trafił do publicznego buildu |

Funkcje liczące w `plan.ts` i `zakupy.ts` są czyste i przyjmują plan jawnie
jako argument — nic nie sięga po niego globalnie.

## Sprawdzenie przed commitem

```bash
npx tsc --noEmit
npm run build
```
