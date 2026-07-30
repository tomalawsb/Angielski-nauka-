# Struktura kodu 5.8.4

Wersja 5.8.4 porządkuje kod bez zmiany sposobu działania aplikacji.

- `index.html` – interfejs aplikacji.
- `css/` – style.
- `data/` – baza materiałów i dialogów.
- `js/app-state-*` – wspólne stałe oraz stan.
- `js/storage-*` – migracje, import, walidacja i localStorage.
- `js/review-engine-*` – kolejki nauki i powtórek.
- `js/exercise-engine-*` – sesje oraz ocenianie odpowiedzi.
- `js/speech-*` – rozpoznawanie i synteza mowy.
- `js/car-mode-*` – tryb samochodowy.
- `js/statistics-*` – renderowanie planu i statystyk.
- `js/app-*` – uruchomienie aplikacji.
- `tests/` – testy automatyczne i przeglądarkowe.

Pliki są nadal zwykłymi skryptami przeglądarkowymi ładowanymi w ustalonej kolejności. Nie wprowadzono bundlera ani zależności zewnętrznych, aby zachować prosty tryb wdrażania PWA.
