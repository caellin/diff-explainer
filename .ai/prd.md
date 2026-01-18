# Dokument wymagań produktu (PRD) - Diff Explainer

## 1. Przegląd produktu

Produkt jest aplikacją webową Astro + React + Tailwind, która pomaga autorom PR-ów szybko przygotować opis zmian, listę ryzyk i plan testów na podstawie wklejonego diffu git. MVP skupia się na pracy indywidualnych użytkowników, zapewnia prosty mechanizm logowania oraz historię zapisanych analiz przechowywaną w Supabase.

Główne cele:

- Skrócenie czasu tworzenia opisów PR bez utraty jakości informacji potrzebnych recenzentom.
- Ujednolicenie struktury opisów i checklist testowych między zespołami.
- Zapewnienie możliwości audytu wcześniejszych analiz wraz z kontekstem diffu i oceną jakości.

Docelowi użytkownicy:

- Autor PR – generuje opis i test plan.

Założenia delivery:

- Zakres = pojedyncze diffy wklejane ręcznie do 1000 linii.
- Backend Supabase (auth, storage, logowanie zapytań) + integracja z wybranym modelem AI (konfiguracja per zapytanie).
- Termin gotowego MVP: 31.01.2026; prace po godzinach, brak zdefiniowanych sprintów.

## 2. Problem użytkownika

Ręczne analizowanie diffów i pisanie opisów PR-ów jest czasochłonne, przez co opisy bywają lakoniczne lub nieistniejące. Recenzenci muszą wtedy samodzielnie przeklikiwać diff, identyfikować ryzyka i ustalać sposoby testowania, co spowalnia code review i zwiększa ryzyko wprowadzenia regresji. Zespół potrzebuje narzędzia, które:

- Zmniejszy próg wejścia dla autorów PR-ów, automatyzując powtarzalną część pracy.
- Zapewni spójny format informacji (opis, ryzyka, test plan, metadane) dostępny z historii.

## 3. Wymagania funkcjonalne

1. Formularz przyjmujący wklejony tekst w formacie git diff, z polem tekstowym do 1000 linii.
2. Walidacja po stronie klienta i serwera: liczba linii, format diffu, wymagane metadane (autor, branch, nazwa PR), opcjonalne pole numeru zadania.
3. Triggerowanie inferencji AI po poprawnym przesłaniu formularza, z obsługą modeli konfigurowalnych per zapytanie.
4. Generowanie trzech artefaktów na jednej odpowiedzi: streszczenie zmian, lista ryzyk oraz plan testów (checklista).
5. Wyświetlenie wyniku wraz z przyciskiem „Kopiuj wszystko” i możliwością drobnej edycji przed zapisem.
6. Zapis całej analizy (diff, wynik AI, metadane, status jakości, identyfikator modelu, użytkownik) w Supabase po zatwierdzeniu przez użytkownika.
7. Historia analiz ograniczona do zalogowanego użytkownika: paginowana lista, podgląd szczegółów, data utworzenia, status jakości.
8. CRUD historii: edycja opisu/ryzyk/testów, aktualizacja metadanych, usuwanie wpisów, podgląd pełnego diffu.
9. Filtrowanie historii po statusie jakości (zaakceptowana / wymaga poprawek) oraz wyszukiwanie po nazwie PR lub branchu.
10. Ocena jakości przez dropdown, dostępna dla autora po ponownym przeglądzie.
11. Logowanie zapytań: dla każdego wywołania AI zapisywane są user ID, model, timestamp, referencja do rekordu analizy oraz ewentualny kod błędu.
12. Autoryzacja: użycie Supabase Auth, sesje ograniczające dostęp tylko do własnych analiz; brak ról zaawansowanych w MVP.
13. Obsługa błędów i retry: komunikat o błędzie z opcją ponownego wysłania, jeśli AI zwróci błąd lub przekroczony zostanie limit linii.
14. Telemetria: metryki czasu odpowiedzi AI i sukcesów/porazek dostępne w logach Supabase/Edge Functions.

## 4. Granice produktu

- W zakresie: ręczne wklejanie diffu git; AI generowanie opisów i test planu; prosta historia z CRUD i filtrowaniem; ocena jakości; kopiowanie wyniku; logowanie zapytań.
- Poza zakresem MVP: integracje API z GitHub/GitLab/Bitbucket, zaawansowane UI diffów (syntax highlight, side-by-side), współdzielenie wpisów, role administracyjne, wersjonowanie pojedynczych wpisów, notyfikacje i wskaźniki progresu, konfiguracje promptów per zespół, limity dziennych zapytań (tylko przygotowanie techniczne).
- Założenia: użytkownicy mają istniejące konta Supabase; przepustowość do 60 s na wygenerowanie odpowiedzi jest akceptowalna; brak potrzeby pamiętania ustawień formularza między sesjami; dane przechowywane w regionie EU.
- Zależności: Supabase (auth, storage, SQL, Edge Functions), dostawca AI (OpenAI/Anthropic tbd), CI/CD pipeline uruchamiający build Astro + testy e2e, środowisko hostingu (np. Vercel/Supabase Functions).
- Nierozstrzygnięte kwestie: metodologia agregacji ocen jakości, szczegółowy harmonogram kamieni milowych przed 31.01.2026, pełna lista testów manualnych/automatycznych oraz definicja przyszłych limitów zapytań.

## 5. Historyjki użytkowników

ID: US-001
Tytuł: Bezpieczne logowanie
Opis: Jako autor PR chcę zalogować się przez Supabase Auth, aby uzyskać dostęp tylko do własnych analiz.
Kryteria akceptacji:

- Użytkownik widzi formularz logowania i otrzymuje informację o błędnym loginie/haśle.
- Po zalogowaniu sesja przechowuje token umożliwiający pobieranie tylko własnych wpisów.
- Wylogowanie usuwa sesję i przekierowuje do ekranu logowania.

ID: US-002
Tytuł: Wklejenie diffu i metadanych
Opis: Jako autor PR chcę wkleić diff i uzupełnić metadane (autor, branch, nazwa PR, opcjonalny numer zadania), aby przekazać AI pełny kontekst.
Kryteria akceptacji:

- Formularz nie pozwala wysłać pustych wymaganych pól.
- Pole diff dopuszcza wyłącznie tekst git diff.
- Metadane są zapisywane wraz z analizą.

ID: US-003
Tytuł: Walidacja limitu 1000 linii
Opis: Jako autor PR chcę zostać poinformowany, gdy przekroczę limit 1000 linii diffu, aby dopasować zakres do możliwości systemu.
Kryteria akceptacji:

- Licznik linii aktualizuje się po wklejeniu lub edycji diffu.
- Próba wysłania z >1000 linii blokuje przycisk i pokazuje komunikat z instrukcją skrócenia diffu.
- Walidacja jest ponownie wykonywana na backendzie i zwraca błąd w przypadku obejścia klienta.

ID: US-004
Tytuł: Generowanie streszczenia, ryzyk i planu testów
Opis: Jako autor PR chcę otrzymać od AI trzy sekcje (opis, ryzyka, plan testów), abym mógł szybko udostępnić je recenzentom.
Kryteria akceptacji:

- Po wysłaniu formularza pojawia się stan oczekiwania (do 60 s tolerowane bez wskaźnika postępu).
- Odpowiedź zawiera wszystkie trzy sekcje w spójnym formacie markdown.
- W razie błędu użytkownik widzi komunikat i przycisk „Spróbuj ponownie”.

ID: US-005
Tytuł: Zapisanie analizy do historii
Opis: Jako autor PR chcę zapisać kompletny wynik wraz z diffem, aby mieć możliwość powrotu do niego później.
Kryteria akceptacji:

- Po akceptacji wynik trafia do Supabase z referencją do użytkownika i modelu AI.
- Użytkownik otrzymuje potwierdzenie zapisu.
- Błędy zapisu są komunikowane z możliwością ponownego spróbowania.

ID: US-006
Tytuł: Przegląd listy historii
Opis: Jako autor chcę przeglądać listę wcześniejszych analiz, aby szybko wrócić do dowolnego wpisu.
Kryteria akceptacji:

- Lista pokazuje nazwę PR, branch, status jakości, datę utworzenia.
- Można otworzyć szczegóły z pełnym diffem i wynikiem AI.
- Dane są ograniczone tylko do zalogowanego użytkownika.

ID: US-007
Tytuł: Kopiowanie całego wyniku
Opis: Jako autor chcę skopiować całe streszczenie jednym kliknięciem, aby wkleić je do opisu PR-a.
Kryteria akceptacji:

- Przycisk „Kopiuj wszystko” kopiuje opis, ryzyka i plan testów wraz z metadanymi.
- Po kliknięciu użytkownik dostaje krótkie potwierdzenie (np. toast „Skopiowano”).
- Funkcja działa zarówno na świeżo wygenerowanym wyniku, jak i w historii.

ID: US-008
Tytuł: Edycja zapisanej analizy
Opis: Jako autor chcę edytować zapisane streszczenie lub metadane, aby poprawić treść przed udostępnieniem.
Kryteria akceptacji:

- Edycja odbywa się w tym samym formularzu i zapisuje zmiany w Supabase.
- Historia pokazuje informację o ostatniej edycji (timestamp).
- Walidacje formularza obowiązują także przy edycji.

ID: US-009
Tytuł: Usunięcie wpisu z historii
Opis: Jako autor chcę usunąć zapis, który jest nieaktualny, aby utrzymać porządek w historii.
Kryteria akceptacji:

- System prosi o potwierdzenie przed usunięciem.
- Po usunięciu wpis znika z listy bez odświeżania strony.
- Usunięcia są możliwe tylko dla właściciela wpisu.

ID: US-010
Tytuł: Logowanie zapytań do AI
Opis: Jako właściciel produktu chcę mieć log zapytań (user, model, timestamp, wynik) w bazie, aby móc audytować zużycie i diagnozować błędy.
Kryteria akceptacji:

- Każde wywołanie zapisuje rekord w dedykowanej tabeli.
- Nieudane zapytania zawierają kod błędu i wiadomość diagnostyczną.
- Logi można powiązać z konkretnym wpisem historii poprzez identyfikator analizy.

ID: US-011
Tytuł: Obsługa błędów generowania
Opis: Jako autor chcę widzieć jasny komunikat, gdy AI zwróci błąd, aby móc poprawić dane lub spróbować ponownie.
Kryteria akceptacji:

- Komunikat informuje o przyczynie (limit linii, timeout, błąd modelu) jeśli jest dostępna.
- Użytkownik może zainicjować retry bez ponownego wklejania diffu.
- Błędne próby są także zapisywane w logach zapytań.

## 6. Metryki sukcesu

1. Użytkownik może przejść pełny flow (logowanie → wklejenie diffu → generowanie → zapis → podgląd historii) w czasie krótszym niż 5 minut; potwierdzone testem e2e.
2. Minimum 90 procent prób generowania kończy się sukcesem bez ręcznej interwencji w ciągu tygodnia od wdrożenia.
3. CRUD historii działa deterministycznie: brak błędów w logach dotyczących odczytu/zapisu/edycji/usuwania przy testach regresyjnych.
4. Pipeline CI/CD przechodzi automatycznie dla każdego push/PR na główną gałąź, uruchamiając build i testy użytkownika głównego scenariusza.
5. Średni czas odpowiedzi AI poniżej 60 s; wszystkie zapytania i błędy są rejestrowane z identyfikatorem użytkownika i modelu.
