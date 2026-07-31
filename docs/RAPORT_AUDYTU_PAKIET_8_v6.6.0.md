# Raport audytu Pakietu 8 — Angielski Daily Trainer 6.6.0

## Wynik

Pakiet 8 zamyka etap stabilizacji kursu A1–A2. Katalog ma schemat 3 i wersję treści `a1-a2-2026.07-r1`.

## Zakres danych

- 24 opublikowane moduły,
- 115 opublikowanych lekcji: 55 A1 i 60 A2,
- 1713 materiałów,
- 1792 unikalne przykłady dwujęzyczne,
- 145 scen dialogowych,
- 55 profili semantycznych dla tematycznych zadań końcowych A2.

## Zmiany stabilizacyjne

- uzupełniono przykłady wszystkich materiałów i usunięto ich powtórzenia,
- ujednolicono podstawowe brytyjskie i amerykańskie warianty pisowni,
- dodano wersjonowanie treści niezależne od wersji aplikacji,
- rozszerzono eksport/import o plik JSON i kontrolę wersji treści,
- dodano politykę prywatności, informacje o mikrofonie i instrukcje kopii,
- poprawiono fokus, etykiety, atrybuty ARIA i obsługę ograniczenia animacji,
- Service Worker odrzuca niepełny cache zamiast instalować uszkodzoną wersję offline.

## Testy automatyczne

- Node: 612/612,
- UI pilotażowe: 42/42,
- pełne A1 UI: 27/27,
- pełne A2 UI: 27/27,
- końcowe UI QA: 15/15,
- audyt A1: PASS,
- audyt A2: PASS,
- końcowy audyt jakości: PASS,
- składnia JavaScript: 32/32.

## Ograniczenia kontroli

Testy Chromium wykorzystują symulowane rozmiary ekranów, w tym 320×568, 390×844, tablet i komputer. Nie zastępują testu mikrofonu, pracy w tle i blokady ekranu na konkretnym telefonie. Automatyczna kontrola CEFR i naturalności nie zastępuje niezależnej recenzji nauczyciela lub metodyka.
