// useGrouping: 'always' — bez tego ICU nie grupuje liczb czterocyfrowych
// i obok siebie wychodzi "3360 zł" oraz "10 000 zł".
const PLN = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  maximumFractionDigits: 0,
  useGrouping: 'always',
});

const PLN_GROSZE = new Intl.NumberFormat('pl-PL', {
  style: 'currency',
  currency: 'PLN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: 'always',
});

export function zl(n: number): string {
  return PLN.format(n);
}

export function zlDokladnie(n: number): string {
  return PLN_GROSZE.format(n);
}

/** Liczba bez symbolu waluty, ze spacjami tysięcy. */
export function liczba(n: number): string {
  return new Intl.NumberFormat('pl-PL', {
    maximumFractionDigits: 0,
    useGrouping: 'always',
  }).format(n);
}

/** Ułamek po polsku: przecinek, nie kropka z `toFixed()`. */
export function ulamek(n: number, miejsca = 1): string {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: miejsca,
    maximumFractionDigits: miejsca,
  }).format(n);
}

/** Odmiana rzeczownika przez liczebnik: 1 miesiąc, 2 miesiące, 5 miesięcy. */
export function odmiana(n: number, jeden: string, dwa: string, piec: string): string {
  const abs = Math.abs(n) % 100;
  const ostatnia = abs % 10;
  if (abs === 1) return jeden;
  if (ostatnia >= 2 && ostatnia <= 4 && (abs < 12 || abs > 14)) return dwa;
  return piec;
}

export function miesiace(n: number): string {
  return `${n} ${odmiana(n, 'miesiąc', 'miesiące', 'miesięcy')}`;
}

export function dni(n: number): string {
  return `${n} ${odmiana(n, 'dzień', 'dni', 'dni')}`;
}
