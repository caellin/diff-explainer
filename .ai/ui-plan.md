# Architektura UI dla PR/Diff Explainer

## 1. Przegląd struktury UI

Aplikacja Diff Explainer to SPA zbudowana na Astro 5 z React 19 dla komponentów interaktywnych. Interfejs użytkownika opiera się na bibliotece shadcn/ui z Tailwind 4 do stylowania. Architektura zakłada podejście desktop-first ze wsparciem dla urządzeń mobilnych.

### Główne założenia:
- **3 główne widoki**: Logowanie, Lista historii (strona główna), Formularz analizy
- **Jeden komponent formularza** obsługujący trzy tryby: `create`, `view`, `edit`
- **Minimalistyczne zarządzanie stanem**: Supabase SDK dla sesji, React useState dla formularzy
- **Współdzielona walidacja**: Schematy Zod między frontend i backend
- **Responsywność**: Desktop (>1024px), Tablet (768-1024px), Mobile (<768px)

### Struktura katalogów komponentów:
```
src/components/
├── ui/                    # shadcn/ui (Button, Input, Card, Table, etc.)
├── auth/                  # Komponenty autoryzacji
├── analysis/              # Komponenty formularza analizy
├── history/               # Komponenty listy historii
└── layout/                # Komponenty layoutu i nawigacji
```

---

## 2. Lista widoków

### 2.1. Widok logowania

| Właściwość | Opis |
|------------|------|
| **Nazwa widoku** | Logowanie |
| **Ścieżka** | `/login` |
| **Główny cel** | Umożliwienie użytkownikowi bezpiecznego zalogowania się do aplikacji |
| **Kluczowe informacje** | Formularz email + hasło, komunikaty błędów walidacji |

#### Kluczowe komponenty:
- **AuthForm** - wrapper dla Supabase Auth UI obsługujący logowanie przez email i hasło

#### Względy UX:
- Prosty, minimalistyczny formularz bez rozpraszaczy
- Natychmiastowa informacja zwrotna przy błędnym logowaniu
- Automatyczne przekierowanie na `/` po pomyślnym zalogowaniu

#### Dostępność:
- Prawidłowe etykiety dla pól formularza
- Obsługa klawiatury (Tab, Enter)
- Komunikaty błędów powiązane z polami przez `aria-describedby`

#### Bezpieczeństwo:
- Supabase Auth zarządza tokenami i sesjami
- Przekierowanie zalogowanych użytkowników na `/`
- Ochrona przed wielokrotnymi nieudanymi próbami logowania (Supabase)

---

### 2.2. Widok listy historii

| Właściwość | Opis |
|------------|------|
| **Nazwa widoku** | Lista historii analiz |
| **Ścieżka** | `/` |
| **Główny cel** | Przegląd wszystkich analiz użytkownika z możliwością filtrowania i nawigacji do szczegółów |
| **Kluczowe informacje** | Nazwa PR, Branch, Status (badge), Data utworzenia |

#### Kluczowe komponenty:
- **Navbar** - górny pasek nawigacji z logo, przyciskiem "Nowa analiza" i "Wyloguj"
- **HistoryFilters** - pole wyszukiwania z przyciskiem + dropdown filtrowania statusu
- **HistoryTable** - tabela z listą analiz, sortowanie po kliknięciu nagłówka
- **StatusBadge** - badge z kolorem odpowiadającym statusowi:
  - `draft` = szary
  - `pending_review` = żółty
  - `completed` = zielony
- **Pagination** - kontrolki paginacji (góra i dół tabeli) z dropdownem liczby wierszy (10/20/50)
- **EmptyState** - stan pustej listy z ikoną i CTA "Utwórz pierwszą analizę"

#### Względy UX:
- Wyszukiwanie uruchamiane przyciskiem (nie as-you-type) dla lepszej kontroli
- Kliknięcie w wiersz prowadzi do szczegółów analizy
- Sortowanie po kolumnach z wizualną indykacją kierunku
- Skeleton loading podczas ładowania danych

#### Dostępność:
- Tabela z prawidłowymi nagłówkami `<th>` i atrybutami `scope`
- Przyciski paginacji z etykietami `aria-label`
- Focus visible na interaktywnych elementach

#### Bezpieczeństwo:
- Middleware Astro przekierowuje niezalogowanych na `/login`
- RLS w Supabase zapewnia dostęp tylko do własnych danych
- Obsługa 401 z przekierowaniem i toast "Sesja wygasła"

#### Responsywność:
| Breakpoint | Zmiany |
|------------|--------|
| Desktop (>1024px) | Wszystkie kolumny widoczne |
| Tablet (768-1024px) | Wszystkie kolumny, kompaktowy pasek |
| Mobile (<768px) | Kolumna Branch ukryta, hamburger menu |

---

### 2.3. Widok formularza analizy (tworzenie)

| Właściwość | Opis |
|------------|------|
| **Nazwa widoku** | Nowa analiza |
| **Ścieżka** | `/analysis/new` |
| **Główny cel** | Utworzenie nowej analizy diffu z wygenerowaniem opisu AI |
| **Kluczowe informacje** | Metadane (PR name, Branch, Ticket), pole diff, wyniki AI |

#### Kluczowe komponenty:
- **AnalysisForm** (tryb `create`) - główny formularz z sekcjami
- **MetadataFields** - pola: PR Name* (wymagane), Branch* (wymagane), Ticket ID (opcjonalne)
- **DiffInput** - textarea monospace z licznikiem linii pod polem
- **AiLoader** - pulsujący loader z komunikatem "Analizuję zmiany..." + informacja o max 60s (spójna z backendowym timeoutem)
- **ResultsSection** - kontener na 3 karty wyników
- **ResultCard** - pojedyncza sekcja wyniku AI (Podsumowanie, Ryzyka, Plan Testu)
- **ActionButtons** - przyciski: Generuj, Zapisz, Kopiuj wszystko

#### Względy UX:
- Jednokrokowy formularz z podziałem na logiczne sekcje
- Licznik linii aktualizowany w czasie rzeczywistym
- Blokada formularza podczas generowania AI (do 60s)
- Toast potwierdzający zapisanie
- Ostrzeżenie `beforeunload` przy niezapisanych zmianach

#### Dostępność:
- Etykiety pól formularza
- Informacja o wymaganych polach (*)
- Komunikaty błędów walidacji inline
- Stan ładowania przekazywany przez `aria-busy`

#### Bezpieczeństwo:
- Walidacja client-side (Zod) + server-side backup
- Limit 1000 linii diffu egzekwowany przed wysłaniem

#### Specyfikacja DiffInput:
| Właściwość | Desktop | Tablet | Mobile |
|------------|---------|--------|--------|
| min-height | 300px | 250px | 200px |
| font-family | monospace | monospace | monospace |
| font-size | 13px | 13px | 13px |
| resize | vertical | vertical | vertical |

---

### 2.4. Widok formularza analizy (podgląd/edycja)

| Właściwość | Opis |
|------------|------|
| **Nazwa widoku** | Szczegóły analizy |
| **Ścieżka** | `/analysis/[id]` |
| **Główny cel** | Przeglądanie, edycja i zarządzanie istniejącą analizą |
| **Kluczowe informacje** | Wszystkie dane analizy + wyniki AI + ocena jakości |

#### Kluczowe komponenty:
- **AnalysisForm** (tryby `view` / `edit`) - ten sam komponent co dla `/analysis/new`
- **QualityRating** - dropdown oceny jakości (dostępny po pierwszym zapisie)
- **ActionButtons** - przyciski: Edytuj/Zapisz, Generuj ponownie, Kopiuj wszystko, Usuń
- **DeleteConfirmDialog** - AlertDialog z potwierdzeniem usunięcia (zawiera nazwę PR)
- **DiffDisplay** - `<pre>` z fontem monospace do wyświetlania diffu (bez syntax highlighting)

#### Względy UX:
- Tryb `view` pokazuje dane tylko do odczytu z przyciskiem "Edytuj"
- Tryb `edit` umożliwia edycję z split view dla markdown
- Generuj ponownie pozwala na retry bez utraty metadanych
- Dialog usuwania wymaga potwierdzenia z nazwą PR
- Skeleton loading podczas ładowania danych

#### Stany przycisków:
| Akcja | Stan disabled | Tekst | Ikona |
|-------|---------------|-------|-------|
| Generuj | Podczas request | "Generowanie..." | Loader2 (animate-spin) |
| Zapisz | Podczas request | "Zapisywanie..." | Loader2 (animate-spin) |
| Usuń | Podczas request | "Usuwanie..." | Loader2 (animate-spin) |

#### Dostępność:
- AlertDialog z focus trap
- Przyciski z aria-label opisującymi akcję
- Stany ładowania komunikowane przez aria-busy

#### Bezpieczeństwo:
- Weryfikacja własności analizy przez API (RLS)
- Potwierdzenie przed destrukcyjną akcją (usunięcie)

---

### 2.5. Strona błędu 404

| Właściwość | Opis |
|------------|------|
| **Nazwa widoku** | Nie znaleziono |
| **Ścieżka** | Dowolna nieistniejąca ścieżka |
| **Główny cel** | Informacja o braku strony i nawigacja powrotna |
| **Kluczowe informacje** | Ikona błędu, komunikat, przycisk powrotu |

#### Kluczowe komponenty:
- Domyślna strona 404 Astro
- Ikona błędu
- Komunikat "Strona nie została znaleziona"
- Przycisk "Wróć do strony głównej" → `/`

---

## 3. Mapa podróży użytkownika

### 3.1. Przepływ główny: Tworzenie nowej analizy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GŁÓWNY PRZEPŁYW UŻYTKOWNIKA                        │
└─────────────────────────────────────────────────────────────────────────────┘

[Start] 
    │
    ▼
┌─────────────┐     nieautoryzowany      ┌─────────────┐
│  Dowolna    │ ────────────────────────▶│   /login    │
│   strona    │                          │  AuthForm   │
└─────────────┘                          └─────────────┘
                                               │
                                         sukces logowania
                                               │
                                               ▼
                                         ┌─────────────┐
                                         │     /       │
                                         │  Historia   │◀──────────────────┐
                                         └─────────────┘                   │
                                               │                           │
                        ┌──────────────────────┼──────────────────────┐    │
                        │                      │                      │    │
                  pusta lista            klik "Nowa            klik w     │
                        │                  analiza"             wiersz    │
                        ▼                      │                      │    │
                  ┌───────────┐                │                      │    │
                  │EmptyState │                │                      │    │
                  │   CTA     │────────────────┤                      │    │
                  └───────────┘                │                      │    │
                                               ▼                      ▼    │
                                         ┌─────────────┐      ┌─────────────┐
                                         │/analysis/new│      │/analysis/[id]│
                                         │   create    │      │    view     │
                                         └─────────────┘      └─────────────┘
                                               │                      │
                                         wypełnia form          moze edytować
                                         + "Generuj"            lub usunąć
                                               │                      │
                                               ▼                      │
                                         ┌─────────────┐              │
                                         │  AiLoader   │              │
                                         │   (60s)     │              │
                                         └─────────────┘              │
                                               │                      │
                                         wynik + "Zapisz"             │
                                               │                      │
                                               ▼                      │
                                         ┌─────────────┐              │
                                         │  /analysis  │──────────────┤
                                         │   [id]      │              │
                                         └─────────────┘              │
                                               │                      │
                                         nawigacja wstecz             │
                                               └──────────────────────┘
```

### 3.2. Szczegółowy przepływ tworzenia analizy

| Krok | Akcja użytkownika | Odpowiedź systemu | Endpoint API |
|------|-------------------|-------------------|--------------|
| 1 | Klika "Nowa analiza" | Nawigacja do `/analysis/new` | - |
| 2 | Wypełnia PR Name, Branch | Walidacja inline | - |
| 3 | Wkleja diff | Licznik linii się aktualizuje | - |
| 4 | Klika "Generuj" | AiLoader (do 60s), blokada formularza | `POST /api/analysis` |
| 5 | Widzi wynik | 3 karty z wynikami AI | - |
| 6 | (Opcjonalnie) edytuje wyniki | Split view dla markdown | - |
| 7 | Klika "Zapisz" | Toast "Zapisano", przekierowanie | `PUT /api/analysis/:id` |
| 8 | Klika "Kopiuj wszystko" | Toast "Skopiowano", schowek | - |

### 3.3. Przepływ edycji istniejącej analizy

| Krok | Akcja użytkownika | Odpowiedź systemu | Endpoint API |
|------|-------------------|-------------------|--------------|
| 1 | Klika wiersz w historii | Nawigacja do `/analysis/[id]` | `GET /api/analysis/:id` |
| 2 | Widzi szczegóły (tryb view) | Skeleton → dane | - |
| 3 | Klika "Edytuj" | Przełączenie na tryb edit | - |
| 4 | Modyfikuje metadane (pr_name, branch_name, ticket_id) i/lub wyniki AI | Walidacja inline | - |
| 5 | Klika "Zapisz" | Toast "Zapisano" | `PUT /api/analysis/:id` |

### 3.4. Przepływ usuwania analizy

| Krok | Akcja użytkownika | Odpowiedź systemu | Endpoint API |
|------|-------------------|-------------------|--------------|
| 1 | Klika "Usuń" | AlertDialog z nazwą PR | - |
| 2 | Klika "Anuluj" | Zamknięcie dialogu | - |
| 2a | Klika "Usuń" (potwierdza) | Loader, Toast "Usunięto" | `DELETE /api/analysis` |
| 3 | - | Przekierowanie na `/` | - |

### 3.5. Przepływ ponownego generowania

| Krok | Akcja użytkownika | Odpowiedź systemu | Endpoint API |
|------|-------------------|-------------------|--------------|
| 1 | Na `/analysis/[id]` klika "Generuj ponownie" | AiLoader (do 60s) | `POST /api/analysis/:id/generate` |
| 2 | Widzi nowy wynik | Aktualizacja 3 kart | - |
| 3 | Klika "Zapisz" | Toast "Zapisano" | `PUT /api/analysis/:id` |

---

## 4. Układ i struktura nawigacji

### 4.1. Nawigacja desktop (>1024px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [Logo/Nazwa]                     [Nowa analiza]           [Wyloguj]     │
└──────────────────────────────────────────────────────────────────────────┘
│                                                                          │
│                            TREŚĆ STRONY                                  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2. Nawigacja tablet (768-1024px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [Logo]                          [Nowa analiza]                [Wyloguj] │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.3. Nawigacja mobile (<768px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            TREŚĆ STRONY                                  │
│                                                                          │
│                                                                          │
│                                                                          │
│                                                                          │
│                                                                          │
│                                                                   ┌────┐ │
│                                                                   │ ☰  │ │
│                                                                   └────┘ │
└──────────────────────────────────────────────────────────────────────────┘
                                                                        │
                                        klik ──────────────────────────▶│
                                                                        ▼
                                                              ┌──────────────┐
                                                              │  Historia    │
                                                              │  Nowa analiza│
                                                              │  ─────────── │
                                                              │  Wyloguj     │
                                                              └──────────────┘
```

- Pływający przycisk hamburger w prawym dolnym rogu
- Menu rozwija się nad przyciskiem
- Zawiera: "Historia" (`/`), "Nowa analiza" (`/analysis/new`), separator, "Wyloguj"

### 4.4. Middleware i ochrona tras

| Ścieżka | Wymagane logowanie | Zachowanie dla niezalogowanych |
|---------|-------------------|-------------------------------|
| `/login` | Nie | Wyświetl formularz logowania |
| `/` | Tak | Przekierowanie na `/login` |
| `/analysis/new` | Tak | Przekierowanie na `/login` |
| `/analysis/[id]` | Tak | Przekierowanie na `/login` |

**Logika middleware Astro:**
1. Sprawdź sesję Supabase
2. Jeśli brak sesji i ścieżka ≠ `/login` → przekierowanie na `/login`
3. Jeśli sesja istnieje i ścieżka = `/login` → przekierowanie na `/`

---

## 5. Kluczowe komponenty

### 5.1. Komponenty autoryzacji

#### AuthForm
- **Lokalizacja**: `src/components/auth/AuthForm.tsx`
- **Cel**: Wrapper dla Supabase Auth UI
- **Użycie**: Strona `/login`
- **Funkcjonalność**:
  - Formularz email + hasło
  - Obsługa błędów logowania
  - Przekierowanie po sukcesie

### 5.2. Komponenty formularza analizy

#### AnalysisForm
- **Lokalizacja**: `src/components/analysis/AnalysisForm.tsx`
- **Cel**: Główny formularz obsługujący tworzenie, podgląd i edycję analiz
- **Props**: `mode: 'create' | 'view' | 'edit'`, `analysisId?: string`
- **Użycie**: `/analysis/new`, `/analysis/[id]`

#### MetadataFields
- **Lokalizacja**: `src/components/analysis/MetadataFields.tsx`
- **Cel**: Pola formularza dla metadanych (PR Name, Branch Name, Ticket ID)
- **Funkcjonalność**: Wszystkie pola są edytowalne przy aktualizacji analizy (pr_name, branch_name, ticket_id)
- **Walidacja**: Zod schema z `src/lib/schemas/analysis.schema.ts`

#### DiffInput
- **Lokalizacja**: `src/components/analysis/DiffInput.tsx`
- **Cel**: Textarea dla diffu z licznikiem linii
- **Funkcjonalność**:
  - Font monospace
  - Licznik linii pod polem
  - Walidacja limitu 1000 linii

#### ResultCard
- **Lokalizacja**: `src/components/analysis/ResultCard.tsx`
- **Cel**: Pojedyncza karta wyniku AI (Card z shadcn/ui)
- **Props**: `title: string`, `content: string`, `onEdit?: (value: string) => void`
- **Funkcjonalność**: Podgląd markdown, split view przy edycji

#### ResultsSection
- **Lokalizacja**: `src/components/analysis/ResultsSection.tsx`
- **Cel**: Kontener na 3 karty wyników (Podsumowanie, Ryzyka, Plan Testu)
- **Layout**: Karty ułożone pionowo z odstępem 16-24px

#### ActionButtons
- **Lokalizacja**: `src/components/analysis/ActionButtons.tsx`
- **Cel**: Zestaw przycisków akcji zależny od trybu formularza
- **Przyciski**: Generuj, Zapisz, Kopiuj wszystko, Generuj ponownie, Usuń

#### AiLoader
- **Lokalizacja**: `src/components/analysis/AiLoader.tsx`
- **Cel**: Pulsujący loader podczas generowania AI
- **Funkcjonalność**:
  - Komunikat "Analizuję zmiany..."
  - Informacja o max 60s oczekiwania
  - Animacja pulsowania

#### QualityRating
- **Lokalizacja**: `src/components/analysis/QualityRating.tsx`
- **Cel**: Dropdown do oceny jakości analizy
- **Widoczność**: Dostępny po pierwszym zapisie analizy

### 5.3. Komponenty historii

#### HistoryTable
- **Lokalizacja**: `src/components/history/HistoryTable.tsx`
- **Cel**: Tabela z listą analiz użytkownika
- **Funkcjonalność**:
  - Sortowanie po kliknięciu nagłówka
  - Kliknięcie wiersza → nawigacja do szczegółów

#### HistoryFilters
- **Lokalizacja**: `src/components/history/HistoryFilters.tsx`
- **Cel**: Pole wyszukiwania + dropdown statusu
- **Funkcjonalność**:
  - Wyszukiwanie po kliknięciu przycisku (nie as-you-type)
  - Filtrowanie po statusie

#### StatusBadge
- **Lokalizacja**: `src/components/history/StatusBadge.tsx`
- **Cel**: Badge z kolorem odpowiadającym statusowi
- **Kolory**: draft=szary, pending_review=żółty, completed=zielony

#### Pagination
- **Lokalizacja**: `src/components/history/Pagination.tsx`
- **Cel**: Kontrolki paginacji
- **Funkcjonalność**:
  - Przyciski prev/next
  - Dropdown liczby wierszy (10/20/50)
  - Wyświetlane na górze i dole tabeli

#### EmptyState
- **Lokalizacja**: `src/components/history/EmptyState.tsx`
- **Cel**: Stan pustej listy historii
- **Funkcjonalność**:
  - Wycentrowany komunikat z ikoną
  - CTA "Utwórz pierwszą analizę" → `/analysis/new`

### 5.4. Komponenty layoutu

#### Navbar
- **Lokalizacja**: `src/components/layout/Navbar.tsx`
- **Cel**: Górny pasek nawigacji (desktop/tablet)
- **Elementy**: Logo, "Nowa analiza", "Wyloguj"

#### MobileMenu
- **Lokalizacja**: `src/components/layout/MobileMenu.tsx`
- **Cel**: Hamburger menu dla mobile
- **Funkcjonalność**:
  - Pływający przycisk w prawym dolnym rogu
  - Rozwijane menu z opcjami nawigacji

#### PageLayout
- **Lokalizacja**: `src/components/layout/PageLayout.tsx`
- **Cel**: Wspólny layout dla wszystkich stron
- **Funkcjonalność**:
  - Warunkowe renderowanie Navbar vs MobileMenu
  - Wrapper dla treści strony

### 5.5. Komponenty shadcn/ui do wykorzystania

| Komponent | Użycie |
|-----------|--------|
| Button | Wszystkie przyciski akcji |
| Input | Pola tekstowe formularza |
| Textarea | Pole diff |
| Card | Sekcje wyników AI |
| Table | Lista historii |
| Select | Dropdown statusu, liczby wierszy, oceny jakości |
| AlertDialog | Potwierdzenie usunięcia |
| Alert | Komunikaty błędów inline |
| Sonner/Toast | Powiadomienia sukcesu/błędu |
| Skeleton | Stany ładowania |
| Badge | Status w tabeli historii |

---

## 6. Obsługa błędów i stany specjalne

### 6.1. Typy błędów i ich obsługa

| Typ błędu | Komponent | Zachowanie |
|-----------|-----------|------------|
| Walidacja formularza | Alert (inline) | Komunikat pod polem, blokada przycisku |
| Błąd API (ogólny) | Toast | Komunikat w prawym górnym rogu |
| Błąd AI (timeout/limit) | Toast + retry | Komunikat + "Generuj ponownie" |
| Sesja wygasła (401) | Toast + redirect | "Sesja wygasła" + przekierowanie na `/login` |
| Nie znaleziono (404) | Strona 404 | Ikona + komunikat + przycisk powrotu |
| Błąd serwera (500) | Toast | Komunikat + opcja retry |

### 6.2. Stany ładowania

| Widok | Komponent loading | Zachowanie |
|-------|-------------------|------------|
| Historia | Skeleton (Table rows) | Placeholder wierszy tabeli |
| Szczegóły analizy | Skeleton (Cards) | Placeholder kart z wynikami |
| Generowanie AI | AiLoader | Pulsujący loader + komunikat |

### 6.3. Ostrzeżenia przed utratą danych

- **Nawigacja poza aplikację**: Event `beforeunload` z natywnym dialogiem przeglądarki
- **Nawigacja wewnątrz SPA**: Własny AlertDialog z pytaniem o porzucenie zmian

### 6.4. Format kopiowania wyników

```markdown
## PR: {pr_name}
**Branch:** {branch_name}
**Zadanie:** {ticket_id}

## Podsumowanie
{summary}

## Ryzyka
{risks}

## Plan Testu
{tests}
```

---

## 7. Mapowanie wymagań na elementy UI

### 7.1. User Stories → Komponenty UI

| US ID | Tytuł | Komponenty UI |
|-------|-------|---------------|
| US-001 | Bezpieczne logowanie | AuthForm, `/login`, Toast błędu, middleware |
| US-002 | Wklejenie diffu i metadanych | MetadataFields, DiffInput, Alert (walidacja) |
| US-003 | Walidacja limitu 1000 linii | DiffInput (licznik), Alert, blokada przycisku |
| US-004 | Generowanie streszczenia, ryzyk i planu testów | AiLoader, ResultsSection, 3x ResultCard |
| US-005 | Zapisanie analizy do historii | ActionButtons (Zapisz), Toast potwierdzenia |
| US-006 | Przegląd listy historii | HistoryTable, Pagination, StatusBadge, HistoryFilters |
| US-007 | Kopiowanie całego wyniku | ActionButtons (Kopiuj), Toast "Skopiowano" |
| US-008 | Edycja zapisanej analizy | AnalysisForm (tryb edit), ActionButtons (Zapisz) |
| US-009 | Usunięcie wpisu z historii | AlertDialog, ActionButtons (Usuń), Toast |
| US-010 | Logowanie zapytań do AI | (backend - brak bezpośredniego UI) |
| US-011 | Obsługa błędów generowania | Toast błędu, ActionButtons (Generuj ponownie) |

### 7.2. Wymagania funkcjonalne → Elementy UI

| Wymaganie | Element UI |
|-----------|------------|
| Formularz diffu (do 1000 linii) | DiffInput z licznikiem |
| Walidacja client-side i server-side | Zod schemas + Alert komponenty |
| Trzy artefakty AI | ResultsSection z 3x ResultCard |
| Przycisk "Kopiuj wszystko" | ActionButtons + Toast |
| Edycja przed zapisem | AnalysisForm (tryb edit), split view markdown |
| Historia z paginacją | HistoryTable + Pagination |
| Filtrowanie po statusie | HistoryFilters (Select) |
| Wyszukiwanie | HistoryFilters (Input + Button) |
| Ocena jakości | QualityRating (Select) |
| Obsługa błędów z retry | Toast + ActionButtons (Generuj ponownie) |

---

## 8. Integracja z API

### 8.1. Mapowanie endpointów na widoki

| Endpoint | Metoda | Widok | Akcja użytkownika |
|----------|--------|-------|-------------------|
| `/api/analysis` | POST | `/analysis/new` | Generuj |
| `/api/analysis/:id/generate` | POST | `/analysis/[id]` | Generuj ponownie |
| `/api/analysis/:id` | PUT | `/analysis/[id]` | Zapisz |
| `/api/analysis/:id` | GET | `/analysis/[id]` | Ładowanie strony |
| `/api/analysis` | DELETE | `/analysis/[id]` | Usuń (z AlertDialog) |
| `/api/analysis/all` | GET | `/` | Ładowanie listy historii |

### 8.2. Zarządzanie stanem

| Typ danych | Rozwiązanie | Uzasadnienie |
|------------|-------------|--------------|
| Sesja użytkownika | Supabase-js SDK | Automatyczne zarządzanie tokenami |
| Dane formularzy | React useState | Prosty, lokalny stan |
| Dane z API | fetch + useState | loading/error/data pattern |
| Stan globalny | Nie wymagany | Każdy widok pobiera dane niezależnie |

### 8.3. Współdzielenie walidacji

- Import schematów Zod z `src/lib/schemas/analysis.schema.ts`
- Walidacja client-side przed wysłaniem requestu
- Walidacja server-side jako backup (te same schematy)
