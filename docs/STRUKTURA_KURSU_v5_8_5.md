# Struktura kursu 5.8.5

## Zakres pakietu 2

Pakiet 2 realizuje etapy 2, 3 i 7 planu:

- model poziomów, modułów i lekcji,
- rozdzielenie źródeł sesji,
- zasady zaliczania i odblokowywania lekcji,
- migrację istniejącego postępu do nowego schematu.

## Pliki

- `js/course-core-v5.8.5.js` – czysta logika katalogu, migracji, budowy zadań i oceny lekcji,
- `data/course-catalog-v5.8.5.js` – katalog A1–B2 i szkielety 10 lekcji pilotażowych A1,
- `js/course-engine-v5.8.5.js` – połączenie modelu kursu z bieżącym stanem aplikacji.

## Stan publikacji

Dziesięć lekcji A1 ma status `draft`. Nie są jeszcze widoczne w interfejsie i nie można ich uruchomić. Chroni to użytkownika przed wejściem do pustych lekcji przed przygotowaniem materiałów.

## Źródła sesji

Stan sesji rozróżnia cztery źródła:

- `course` – lekcja kursu,
- `review` – zaplanowana powtórka,
- `practice` – trening dodatkowy,
- `car` – tryb samochodowy.

Pisanie, słuchanie, mówienie, dialogi i tryb samochodowy korzystają wyłącznie z wcześniej poznanych materiałów. Nowy materiał w zwykłej nauce rozpoczyna się od zadania rozpoznawania.

## Wyniki lekcji

- `mastered` – co najmniej 90%, wykonane wszystkie wymagane etapy i zadanie końcowe,
- `completed` – osiągnięty próg lekcji, domyślnie 70%,
- `review_required` – wynik nie niższy niż 20 punktów procentowych poniżej progu; następna lekcja zostaje odblokowana, a błędy trafiają do powtórki,
- `retry` – wymagane ponowne podejście; następna lekcja pozostaje zablokowana.

Zadanie końcowe jest wymagane, jeśli tak określono w `completionRules`.

## Migracja

Wersja 5.8.5 odczytuje zapis 5.8.4 i starsze obsługiwane zapisy. Zachowuje XP, passę, ustawienia, historię, wyniki materiałów i aktywną sesję. Materiały z `seen > 0` są oznaczane jako wcześniej przedstawione w stanie kursu.
