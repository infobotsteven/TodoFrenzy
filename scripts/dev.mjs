// Uruchamia serwer (tsx watch) i frontend (Vite) razem. Port API jest tu wymuszony na 3000 (na niego wskazuje proxy Vite),
// żeby zmienna PORT ustawiona przez środowisko (np. narzędzie uruchamiające podgląd z portem frontendu) nie przestawiła serwera.
import concurrently from 'concurrently';

const { result } = concurrently(
  [
    { name: 'server', command: 'npm run dev -w server', prefixColor: 'blue', env: { PORT: '3000' } },
    { name: 'client', command: 'npm run dev -w client', prefixColor: 'green' },
  ],
  { killOthersOn: ['failure', 'success'] },
);
result.catch(() => process.exit(1));
