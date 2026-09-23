# 07-przekazanie

Formularz do uzupełnienia przez uczestnika.

## Stan ukończony

- Krok 1 z `src/ocena.mjs`: zatwierdzony wniosek obowiązujący w chwili `teraz` z limitem wyższym niż baza — działa, w tym warianty:
  - brak wniosku → baza,
  - granice okresu: `teraz == od` obowiązuje, `teraz == do` nie obowiązuje (koniec wyłączony),
  - status inny niż `zatwierdzony` (`oczekuje`, `odrzucony`, `cofniety`) nie obowiązuje,
  - limit bazowy `0` jest poprawnie obsługiwany,
  - wniosek z `limitGrosze` mniejszym lub równym bazie nie podnosi limitu (zwraca bazę, bez błędu),
  - brak `zatwierdzil` przy statusie innym niż `zatwierdzony` nie powoduje błędu,
  - funkcja nie mutuje danych wejściowych.
- Testy: 12 z 19 w `test/ocena.node.mjs` przechodzą (patrz sekcja niżej).

## Stan nieukończony

Walidacja danych wejściowych z pkt. 7 BRIEF (`funkcja ma dać jawny błąd, nie ciche przejście w zgodę`) — obecnie `ocenLimit` nic nie rzuca, więc 7 testów failuje:
- ten sam `autor` i `zatwierdzil` przy zgodzie,
- ujemna kwota (`limitBazowyGrosze < 0`),
- kwota niecałkowita (`wykorzystanieGrosze` z ułamkiem),
- nieznany status wniosku (spoza czterech dozwolonych),
- pusty `zatwierdzil` przy statusie `zatwierdzony`,
- niepoprawny format `teraz` (nie ISO 8601 / bez `Z`),
- okres wniosku z `od >= do`.

Trzeba dopisać walidację na początku `ocenLimit` (najpewniej rzucanie `Error` z opisem) i sprawdzić, czy nie psuje to już przechodzących przypadków.

## Ostatnia komenda i wynik

```
cd laboratorium/limity
node --test test/ocena.node.mjs
```
Wynik: 12 pass, 7 fail — wszystkie 7 failujących to brakująca walidacja (patrz „Stan nieukończony”), nie regresje logiki limitu czasowego.

## Pliki do przeczytania

- [laboratorium/limity/BRIEF.md](../BRIEF.md) — uzgodniony zakres MVP i przykłady odbioru (zwłaszcza pkt 1, 4–7 dot. walidacji).
- [laboratorium/limity/src/ocena.mjs](../src/ocena.mjs) — implementacja, krok 1 (bez walidacji błędnych danych).
- [laboratorium/limity/test/ocena.node.mjs](../test/ocena.node.mjs) — 19 testów; 7 ostatnich (od „autor i zatwierdzajacy to ta sama osoba…” do „okres wniosku z od >= do…”) opisuje brakującą walidację.

## Następny krok i punkt zatrzymania

Następny krok: dodać walidację wejścia w `ocenLimit` zgodnie z pkt. 7 BRIEF (rzucanie błędu dla: błędnej kwoty, nieznanego statusu, pustego wymaganego identyfikatora, tego samego autora/zatwierdzającego, niepoprawnego czasu, `od >= do`), tak by 7 failujących testów zaczęło przechodzić bez psucia pozostałych 12.

Punkt zatrzymania: żadna walidacja nie została jeszcze dopisana do `src/ocena.mjs` — praca zatrzymała się na etapie testów opisujących oczekiwane błędy (czerwone testy, zgodnie z TDD, przed implementacją).
