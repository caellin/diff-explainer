# Plan implementacji widoku Listy Historii Analiz

## 1. Przegląd

Widok Listy Historii Analiz stanowi główną stronę aplikacji (`/`), która wyświetla paginowaną listę wszystkich analiz PR użytkownika. Widok umożliwia przeglądanie, filtrowanie i wyszukiwanie wcześniej utworzonych analiz, a także nawigację do szczegółów każdej z nich. Jest to centralny punkt zarządzania historią analiz dla zalogowanego użytkownika.

Główne funkcjonalności:
- Wyświetlanie tabeli z listą analiz (nazwa PR, branch, status, data utworzenia)
- Filtrowanie po statusie (draft, pending_review, completed)
- Wyszukiwanie po nazwie PR lub branchu
- Sortowanie po kolumnach z wizualną indykacją kierunku
- Paginacja z możliwością zmiany liczby wyników na stronę
- Usuwanie analiz bezpośrednio z listy z potwierdzeniem
- Stan pusty z wezwaniem do akcji (CTA) dla nowych użytkowników

## 2. Routing widoku

| Właściwość | Wartość |
|------------|---------|
| Ścieżka | `/` |
| Plik strony | `src/pages/index.astro` |
| Wymagana autoryzacja | Tak |
| Przekierowanie dla niezalogowanych | `/login` |

Middleware Astro sprawdza sesję Supabase i przekierowuje niezalogowanych użytkowników na `/login`.

## 3. Struktura komponentów

```
HistoryPage (index.astro)
└── Layout.astro
    ├── Navbar
    │   ├── Logo
    │   ├── Button ("Nowa analiza")
    │   └── Button ("Wyloguj")
    ├── MobileMenu (widoczne tylko na mobile < 768px)
    │   └── FloatingMenuButton
    └── HistoryView (React, client:load)
        ├── HistoryFilters
        │   ├── Input (search)
        │   ├── Button (search)
        │   └── Select (status filter)
        ├── Pagination (top)
        │   ├── PageInfo
        │   ├── Button (prev)
        │   ├── Button (next)
        │   └── Select (limit)
        ├── HistoryTable | EmptyState | HistoryTableSkeleton
        │   ├── TableHeader (sortable columns)
        │   └── TableRow[]
        │       ├── StatusBadge
        │       └── RowActions
        │           ├── Button (Szczegóły)
        │           └── Button (Usuń)
        ├── Pagination (bottom)
        └── DeleteConfirmDialog (AlertDialog)
```

## 4. Szczegóły komponentów

### 4.1. HistoryView

- **Opis:** Główny kontener React dla widoku historii. Zarządza stanem, pobiera dane z API i koordynuje interakcje między komponentami potomnymi. Obsługuje również logikę usuwania analiz z dialogiem potwierdzenia.
- **Główne elementy:** 
  - `<div>` container z klasami Tailwind
  - Komponenty: `HistoryFilters`, `Pagination` (x2), `HistoryTable` / `EmptyState` / `HistoryTableSkeleton`, `DeleteConfirmDialog`
- **Obsługiwane interakcje:**
  - Inicjalne ładowanie danych przy montowaniu
  - Refetch przy zmianach filtrów, sortowania, paginacji
  - Obsługa nawigacji do szczegółów analizy
  - Obsługa usuwania analizy (otwarcie dialogu, potwierdzenie, wywołanie API)
- **Obsługiwana walidacja:** Brak bezpośredniej walidacji (delegowana do API)
- **Typy:** `AnalysisListResponseDTO`, `GetAnalysesQuery`, `HistoryQueryState`, `DeleteState`
- **Propsy:**
  ```typescript
  interface HistoryViewProps {
    initialStatuses: StatusDTO[];
  }
  ```

### 4.2. HistoryFilters

- **Opis:** Sekcja filtrowania i wyszukiwania. Zawiera pole tekstowe do wyszukiwania i dropdown do filtrowania po statusie.
- **Główne elementy:**
  - `<div>` flex container
  - `<Input>` (shadcn/ui) dla wyszukiwania
  - `<Button>` (shadcn/ui) do uruchomienia wyszukiwania
  - `<Select>` (shadcn/ui) dla filtra statusu
- **Obsługiwane interakcje:**
  - Wpisywanie tekstu w pole wyszukiwania (kontrolowane)
  - Kliknięcie przycisku wyszukiwania → wywołanie `onSearch()`
  - Naciśnięcie Enter w polu wyszukiwania → wywołanie `onSearch()`
  - Zmiana wartości w dropdown statusu → wywołanie `onFiltersChange()`
- **Obsługiwana walidacja:**
  - Maksymalna długość wyszukiwania: 255 znaków (zgodnie z `MAX_SEARCH_LENGTH`)
- **Typy:** `HistoryFiltersState`, `StatusDTO[]`
- **Propsy:**
  ```typescript
  interface HistoryFiltersProps {
    filters: HistoryFiltersState;
    onFiltersChange: (filters: HistoryFiltersState) => void;
    onSearch: () => void;
    statuses: StatusDTO[];
    isLoading: boolean;
  }
  ```

### 4.3. HistoryTable

- **Opis:** Tabela wyświetlająca listę analiz z możliwością sortowania. Każdy wiersz zawiera kolumnę akcji z przyciskami do przejścia do szczegółów i usunięcia analizy.
- **Główne elementy:**
  - `<Table>` (shadcn/ui)
  - `<TableHeader>` z nagłówkami kolumn (klikalny do sortowania) + kolumna "Akcje"
  - `<TableBody>` z wierszami `<TableRow>`
  - Ikony sortowania (ChevronUp/ChevronDown) przy nagłówkach
  - `<StatusBadge>` w kolumnie statusu
  - `<RowActions>` w ostatniej kolumnie z przyciskami "Szczegóły" i "Usuń"
- **Obsługiwane interakcje:**
  - Kliknięcie nagłówka kolumny → zmiana sortowania
  - Kliknięcie przycisku "Szczegóły" → nawigacja do `/analysis/[id]`
  - Kliknięcie przycisku "Usuń" → wywołanie `onDeleteClick(analysis)` (otwiera dialog potwierdzenia)
- **Obsługiwana walidacja:** Brak
- **Typy:** `AnalysisListItemDTO[]`, `HistorySortState`
- **Propsy:**
  ```typescript
  interface HistoryTableProps {
    data: AnalysisListItemDTO[];
    sort: HistorySortState;
    onSortChange: (sort: HistorySortState) => void;
    onRowClick: (id: string) => void;
    onDeleteClick: (analysis: AnalysisListItemDTO) => void;
    deletingId: string | null; // ID aktualnie usuwanej analizy (dla stanu loading)
  }
  ```

### 4.3.1. RowActions

- **Opis:** Komponent zawierający przyciski akcji dla pojedynczego wiersza tabeli.
- **Główne elementy:**
  - `<div>` flex container z gap
  - `<Button>` "Szczegóły" (variant="outline", size="sm") z ikoną `Eye`
  - `<Button>` "Usuń" (variant="destructive", size="sm") z ikoną `Trash2`
- **Obsługiwane interakcje:**
  - Kliknięcie "Szczegóły" → wywołanie `onViewClick()`
  - Kliknięcie "Usuń" → wywołanie `onDeleteClick()`
- **Obsługiwana walidacja:** Brak
- **Typy:** Brak
- **Propsy:**
  ```typescript
  interface RowActionsProps {
    onViewClick: () => void;
    onDeleteClick: () => void;
    isDeleting: boolean;
  }
  ```
- **Stany przycisków:**
  - Przycisk "Usuń" pokazuje `Loader2` (animate-spin) gdy `isDeleting === true`
  - Oba przyciski są `disabled` gdy `isDeleting === true`

### 4.4. StatusBadge

- **Opis:** Badge wyświetlający status analizy z odpowiednim kolorem wizualnym.
- **Główne elementy:**
  - `<Badge>` (shadcn/ui) z wariantowym kolorem
- **Obsługiwane interakcje:** Brak (komponent prezentacyjny)
- **Obsługiwana walidacja:** Brak
- **Typy:** `StatusDTO`
- **Propsy:**
  ```typescript
  interface StatusBadgeProps {
    status: StatusDTO;
  }
  ```
- **Mapowanie kolorów:**
  - `draft` → `variant="secondary"` (szary)
  - `pending_review` → `variant="warning"` (żółty)
  - `completed` → `variant="success"` (zielony)

### 4.5. Pagination

- **Opis:** Kontrolki paginacji wyświetlane na górze i dole tabeli. Zawierają informację o aktualnej stronie, przyciski nawigacji i dropdown do zmiany limitu.
- **Główne elementy:**
  - `<div>` flex container
  - `<span>` z informacją o zakresie wyników (np. "1-10 z 50")
  - `<Button>` prev (disabled gdy `page === 1`)
  - `<Button>` next (disabled gdy `page * limit >= total`)
  - `<Select>` dla limitu (opcje: 10, 20, 50)
- **Obsługiwane interakcje:**
  - Kliknięcie "Poprzednia" → `onPageChange(page - 1)`
  - Kliknięcie "Następna" → `onPageChange(page + 1)`
  - Zmiana limitu → `onLimitChange(newLimit)`, reset strony do 1
- **Obsługiwana walidacja:**
  - Limit musi być z dozwolonego zbioru: `[10, 20, 50]`
  - Page musi być >= 1 i <= totalPages
- **Typy:** `PaginationMeta`
- **Propsy:**
  ```typescript
  interface PaginationProps {
    meta: PaginationMeta;
    limit: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
    isLoading: boolean;
  }
  ```

### 4.6. EmptyState

- **Opis:** Stan pustej listy wyświetlany, gdy użytkownik nie ma żadnych analiz. Zachęca do utworzenia pierwszej analizy.
- **Główne elementy:**
  - `<div>` wycentrowany kontener
  - Ikona (np. `FileText` z lucide-react)
  - `<p>` z komunikatem "Nie masz jeszcze żadnych analiz"
  - `<Button>` jako CTA "Utwórz pierwszą analizę"
- **Obsługiwane interakcje:**
  - Kliknięcie CTA → nawigacja do `/analysis/new`
- **Obsługiwana walidacja:** Brak
- **Typy:** Brak
- **Propsy:**
  ```typescript
  interface EmptyStateProps {
    onCreateClick: () => void;
  }
  ```

### 4.7. HistoryTableSkeleton

- **Opis:** Skeleton loading wyświetlany podczas pobierania danych. Symuluje strukturę tabeli z placeholderami.
- **Główne elementy:**
  - `<Table>` z komponentami `<Skeleton>` (shadcn/ui)
  - 5-10 wierszy placeholder
- **Obsługiwane interakcje:** Brak
- **Obsługiwana walidacja:** Brak
- **Typy:** Brak
- **Propsy:**
  ```typescript
  interface HistoryTableSkeletonProps {
    rows?: number; // domyślnie 10
  }
  ```

### 4.8. Navbar

- **Opis:** Górny pasek nawigacji widoczny na desktop i tablet. Zawiera logo, przycisk nawigacji i wylogowania.
- **Główne elementy:**
  - `<header>` jako kontener
  - Logo/nazwa aplikacji (link do `/`)
  - `<Button>` "Nowa analiza" (link do `/analysis/new`)
  - `<Button>` "Wyloguj" (wywołuje signOut)
- **Obsługiwane interakcje:**
  - Kliknięcie logo → nawigacja do `/`
  - Kliknięcie "Nowa analiza" → nawigacja do `/analysis/new`
  - Kliknięcie "Wyloguj" → Supabase signOut + nawigacja do `/login`
- **Obsługiwana walidacja:** Brak
- **Typy:** Brak
- **Propsy:** Brak (pobiera sesję z kontekstu Supabase)

### 4.9. MobileMenu

- **Opis:** Menu hamburger dla urządzeń mobilnych. Pojawia się jako pływający przycisk w prawym dolnym rogu.
- **Główne elementy:**
  - `<Button>` pływający (fixed position) z ikoną hamburger
  - `<Sheet>` lub `<DropdownMenu>` (shadcn/ui) z opcjami nawigacji
- **Obsługiwane interakcje:**
  - Kliknięcie przycisku → otwarcie menu
  - Kliknięcie opcji menu → nawigacja lub akcja
- **Obsługiwana walidacja:** Brak
- **Typy:** Brak
- **Propsy:** Brak

### 4.10. DeleteConfirmDialog

- **Opis:** Dialog potwierdzenia usunięcia analizy. Wyświetla nazwę PR analizy do usunięcia i wymaga potwierdzenia przed wykonaniem destrukcyjnej akcji.
- **Główne elementy:**
  - `<AlertDialog>` (shadcn/ui)
  - `<AlertDialogContent>` z treścią ostrzeżenia
  - `<AlertDialogTitle>` "Usuń analizę"
  - `<AlertDialogDescription>` z nazwą PR i ostrzeżeniem
  - `<AlertDialogCancel>` przycisk "Anuluj"
  - `<AlertDialogAction>` przycisk "Usuń" (variant="destructive")
- **Obsługiwane interakcje:**
  - Kliknięcie "Anuluj" lub tła → zamknięcie dialogu (`onClose()`)
  - Kliknięcie "Usuń" → wywołanie `onConfirm()` + stan ładowania
  - Naciśnięcie Escape → zamknięcie dialogu
- **Obsługiwana walidacja:** Brak
- **Typy:** `AnalysisListItemDTO`
- **Propsy:**
  ```typescript
  interface DeleteConfirmDialogProps {
    analysis: AnalysisListItemDTO | null;
    isOpen: boolean;
    isDeleting: boolean;
    onClose: () => void;
    onConfirm: () => void;
  }
  ```
- **Treść dialogu:**
  ```
  Tytuł: "Usuń analizę"
  Opis: "Czy na pewno chcesz usunąć analizę "{pr_name}"? 
         Ta operacja jest nieodwracalna."
  ```
- **Stany przycisków:**
  - "Usuń" pokazuje `Loader2` gdy `isDeleting === true`
  - "Usuń" ma tekst "Usuwanie..." gdy `isDeleting === true`
  - Oba przyciski są `disabled` gdy `isDeleting === true`
- **Dostępność:**
  - Focus trap w dialogu
  - Automatyczny focus na "Anuluj" przy otwarciu (bezpieczna opcja)
  - `aria-describedby` dla opisu

## 5. Typy

### 5.1. Typy istniejące (z `src/types.ts`)

```typescript
// Element listy analiz
interface AnalysisListItemDTO {
  id: string;           // UUID
  pr_name: string;
  branch_name: string;
  status: StatusDTO;
  created_at: string;   // ISO8601
}

// Odpowiedź API z listą analiz
interface AnalysisListResponseDTO {
  data: AnalysisListItemDTO[];
  meta: PaginationMeta;
}

// Metadane paginacji
interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

// Status analizy
interface StatusDTO {
  id: number;
  code: string;  // "draft" | "pending_review" | "completed"
}

// Parametry zapytania
interface GetAnalysesQuery {
  page?: number;        // default 1
  limit?: number;       // default 10
  status_id?: number;
  search?: string;
  sort_field?: SortField;
  sort_order?: SortDirection;
}

type SortField = "created_at" | "pr_name" | "branch_name";
type SortDirection = "asc" | "desc";

// Odpowiedzi błędów
interface APIErrorResponse {
  error: string;
  details?: string;
  status_code: number;
}

interface ValidationErrorResponse extends APIErrorResponse {
  field_errors?: Record<string, string[]>;
}
```

### 5.2. Nowe typy dla widoku (ViewModel)

```typescript
// Stan filtrów wyszukiwania i statusu
interface HistoryFiltersState {
  search: string;
  statusId: number | null;
}

// Stan sortowania
interface HistorySortState {
  field: SortField;
  order: SortDirection;
}

// Połączony stan zapytania (dla hooka)
interface HistoryQueryState {
  page: number;
  limit: number;
  filters: HistoryFiltersState;
  sort: HistorySortState;
}

// Stan danych (dla hooka)
interface HistoryDataState {
  data: AnalysisListItemDTO[] | null;
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
}

// Dozwolone wartości limitu
type AllowedLimit = 10 | 20 | 50;

// Mapowanie kodu statusu na wariant Badge
type StatusVariant = "secondary" | "warning" | "success";

// Stan usuwania analizy
interface DeleteState {
  isDialogOpen: boolean;
  analysisToDelete: AnalysisListItemDTO | null;
  isDeleting: boolean;
}

// Command do usuwania (zgodny z API)
interface DeleteAnalysesCommand {
  ids: string[]; // UUID[]
}

// Odpowiedź usuwania (zgodna z API)
interface DeleteAnalysesResponseDTO {
  deleted_count: number;
}
```

## 6. Zarządzanie stanem

### 6.1. Custom Hook: `useHistoryData`

Hook zarządzający stanem widoku historii, pobieraniem danych i synchronizacją z URL.

```typescript
interface UseHistoryDataReturn {
  // Dane
  data: AnalysisListItemDTO[] | null;
  meta: PaginationMeta | null;
  
  // Stan
  isLoading: boolean;
  error: string | null;
  query: HistoryQueryState;
  
  // Stan usuwania
  deleteState: DeleteState;
  
  // Akcje
  setPage: (page: number) => void;
  setLimit: (limit: AllowedLimit) => void;
  setFilters: (filters: HistoryFiltersState) => void;
  setSort: (sort: HistorySortState) => void;
  search: () => void;
  refetch: () => void;
  
  // Akcje usuwania
  openDeleteDialog: (analysis: AnalysisListItemDTO) => void;
  closeDeleteDialog: () => void;
  confirmDelete: () => Promise<void>;
}
```

**Logika hooka:**
1. Inicjalizuje stan z URL search params (jeśli dostępne)
2. Synchronizuje zmiany stanu z URL search params
3. Wywołuje `fetchAnalyses()` przy zmianach `page`, `limit`, `sort` lub po wywołaniu `search()`
4. Obsługuje stany ładowania i błędów
5. Reset strony do 1 przy zmianie filtrów lub limitu
6. Zarządza stanem dialogu usuwania (`DeleteState`)
7. Po potwierdzeniu usuwania wywołuje API i odświeża listę

### 6.2. Stan lokalny komponentów

| Komponent | Stan | Opis |
|-----------|------|------|
| HistoryFilters | `searchInput: string` | Kontrolowany input wyszukiwania (nie synchronizowany z API do momentu kliknięcia przycisku) |
| MobileMenu | `isOpen: boolean` | Stan otwarcia menu mobilnego |
| HistoryView | `deleteState: DeleteState` | Stan dialogu usuwania (zarządzany przez hook) |

### 6.3. Przepływ danych

```
URL Search Params (source of truth dla query state)
        ↓
useHistoryData (hook)
        ↓ fetch
API /api/analysis/all
        ↓ response
HistoryDataState (data, meta, isLoading, error)
        ↓ props
HistoryView → HistoryFilters, HistoryTable, Pagination
```

## 7. Integracja API

### 7.1. Endpoint pobierania listy

| Właściwość | Wartość |
|------------|---------|
| URL | `GET /api/analysis/all` |
| Autoryzacja | Cookie sesji Supabase (automatycznie) |

### 7.2. Parametry żądania

```typescript
// Query parameters
interface GetAnalysesQuery {
  page: number;          // min: 1, default: 1
  limit: number;         // min: 1, max: 100, default: 10
  status_id?: number;    // opcjonalny, positive integer
  search?: string;       // opcjonalny, max 255 znaków
  sort_field?: string;   // "created_at" | "pr_name" | "branch_name", default: "created_at"
  sort_order?: string;   // "asc" | "desc", default: "desc"
}
```

### 7.3. Odpowiedź sukcesu (200)

```typescript
interface AnalysisListResponseDTO {
  data: AnalysisListItemDTO[];
  meta: PaginationMeta;
}
```

### 7.4. Odpowiedzi błędów

| Status | Typ | Opis |
|--------|-----|------|
| 400 | `ValidationErrorResponse` | Nieprawidłowe parametry query |
| 401 | `APIErrorResponse` | Brak autoryzacji / sesja wygasła |
| 500 | `APIErrorResponse` | Błąd serwera |

### 7.5. Funkcja fetch dla listy

```typescript
async function fetchAnalyses(query: GetAnalysesQuery): Promise<AnalysisListResponseDTO> {
  const params = new URLSearchParams();
  
  params.set('page', String(query.page ?? 1));
  params.set('limit', String(query.limit ?? 10));
  
  if (query.status_id) params.set('status_id', String(query.status_id));
  if (query.search) params.set('search', query.search);
  if (query.sort_field) params.set('sort_field', query.sort_field);
  if (query.sort_order) params.set('sort_order', query.sort_order);
  
  const response = await fetch(`/api/analysis/all?${params.toString()}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch analyses');
  }
  
  return response.json();
}
```

### 7.6. Endpoint usuwania

| Właściwość | Wartość |
|------------|---------|
| URL | `DELETE /api/analysis` |
| Autoryzacja | Cookie sesji Supabase (automatycznie) |

### 7.7. Ciało żądania usuwania

```typescript
interface DeleteAnalysesCommand {
  ids: string[]; // Tablica UUID analiz do usunięcia
}
```

**Walidacja:**
- `ids` musi być niepustą tablicą
- Maksymalnie 100 elementów na raz
- Każdy element musi być prawidłowym UUID

### 7.8. Odpowiedź sukcesu usuwania (200)

```typescript
interface DeleteAnalysesResponseDTO {
  deleted_count: number;
}
```

### 7.9. Odpowiedzi błędów usuwania

| Status | Typ | Opis |
|--------|-----|------|
| 400 | `ValidationErrorResponse` | Nieprawidłowe body (brak ids, nieprawidłowe UUID) |
| 401 | `APIErrorResponse` | Brak autoryzacji / sesja wygasła |
| 404 | `APIErrorResponse` | Analiza nie znaleziona lub brak uprawnień |
| 500 | `APIErrorResponse` | Błąd serwera |

### 7.10. Funkcja usuwania

```typescript
async function deleteAnalysis(id: string): Promise<DeleteAnalysesResponseDTO> {
  const response = await fetch('/api/analysis', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids: [id] }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete analysis');
  }
  
  return response.json();
}
```

## 8. Interakcje użytkownika

| Interakcja | Komponent | Rezultat |
|------------|-----------|----------|
| Wejście na stronę | HistoryView | Wyświetlenie skeleton → fetch danych → wyświetlenie tabeli lub empty state |
| Wpisanie tekstu w pole wyszukiwania | HistoryFilters | Aktualizacja lokalnego stanu input (nie wywołuje API) |
| Kliknięcie przycisku "Szukaj" | HistoryFilters | Aktualizacja filtrów w hooku → fetch z nowym `search` → reset strony do 1 |
| Naciśnięcie Enter w polu wyszukiwania | HistoryFilters | Jak wyżej |
| Zmiana statusu w dropdown | HistoryFilters | Aktualizacja filtrów → fetch z nowym `status_id` → reset strony do 1 |
| Kliknięcie nagłówka kolumny | HistoryTable | Toggle kierunku sortowania (lub zmiana pola) → fetch |
| Kliknięcie przycisku "Szczegóły" w wierszu | RowActions | Nawigacja do `/analysis/[id]` |
| Kliknięcie przycisku "Usuń" w wierszu | RowActions | Otwarcie `DeleteConfirmDialog` z danymi analizy |
| Kliknięcie "Anuluj" w dialogu usuwania | DeleteConfirmDialog | Zamknięcie dialogu, brak zmian |
| Kliknięcie "Usuń" w dialogu usuwania | DeleteConfirmDialog | Stan ładowania → wywołanie API → toast sukcesu → refetch listy → zamknięcie dialogu |
| Kliknięcie "Poprzednia" | Pagination | `page - 1` → fetch |
| Kliknięcie "Następna" | Pagination | `page + 1` → fetch |
| Zmiana limitu | Pagination | Nowy limit → reset strony do 1 → fetch |
| Kliknięcie "Nowa analiza" | Navbar | Nawigacja do `/analysis/new` |
| Kliknięcie "Wyloguj" | Navbar | Supabase signOut → nawigacja do `/login` |
| Kliknięcie CTA w EmptyState | EmptyState | Nawigacja do `/analysis/new` |

## 9. Warunki i walidacja

### 9.1. Warunki po stronie klienta

| Warunek | Komponent | Wpływ na UI |
|---------|-----------|-------------|
| `search.length > 255` | HistoryFilters | Input pokazuje błąd, przycisk szukaj zablokowany |
| `page === 1` | Pagination | Przycisk "Poprzednia" zablokowany |
| `page * limit >= total` | Pagination | Przycisk "Następna" zablokowany |
| `data.length === 0 && !isLoading` | HistoryView | Wyświetl EmptyState zamiast tabeli |
| `isLoading` | HistoryView | Wyświetl HistoryTableSkeleton |
| `deleteState.isDeleting` | RowActions | Przycisk "Usuń" pokazuje loader, oba przyciski zablokowane |
| `deleteState.isDeleting` | DeleteConfirmDialog | Oba przyciski zablokowane, "Usuń" pokazuje loader |
| `deleteState.analysisToDelete !== null` | DeleteConfirmDialog | Dialog jest widoczny |

### 9.2. Walidacja parametrów (zgodność z API)

| Parametr | Warunek | Wartość domyślna |
|----------|---------|------------------|
| `page` | integer >= 1 | 1 |
| `limit` | integer 1-100 | 10 |
| `status_id` | positive integer (opcjonalny) | brak |
| `search` | string max 255 znaków | brak |
| `sort_field` | "created_at" \| "pr_name" \| "branch_name" | "created_at" |
| `sort_order` | "asc" \| "desc" | "desc" |

### 9.3. Synchronizacja z URL

Stan query powinien być synchronizowany z URL search params dla:
- Możliwości udostępniania linków z filtrami
- Zachowania stanu przy nawigacji przeglądarki (back/forward)
- Odtworzenia stanu po odświeżeniu strony

## 10. Obsługa błędów

### 10.1. Błąd 401 (Unauthorized)

**Przyczyna:** Sesja wygasła lub brak autoryzacji.

**Obsługa:**
1. Wyświetl toast z komunikatem "Sesja wygasła. Zaloguj się ponownie."
2. Przekieruj na `/login`
3. Opcjonalnie zapisz aktualny URL do powrotu po zalogowaniu

### 10.2. Błąd 400 (Validation Error)

**Przyczyna:** Nieprawidłowe parametry query (nie powinno wystąpić przy prawidłowej implementacji).

**Obsługa:**
1. Zaloguj błąd do konsoli
2. Wyświetl toast z komunikatem "Wystąpił błąd. Spróbuj ponownie."
3. Reset do domyślnych parametrów query

### 10.3. Błąd 500 (Server Error)

**Przyczyna:** Błąd po stronie serwera.

**Obsługa:**
1. Wyświetl toast z komunikatem "Błąd serwera. Spróbuj ponownie później."
2. Wyświetl przycisk "Spróbuj ponownie" w miejscu tabeli
3. Zachowaj aktualne parametry query

### 10.4. Błąd sieci (Network Error)

**Przyczyna:** Brak połączenia z serwerem.

**Obsługa:**
1. Wyświetl toast z komunikatem "Brak połączenia z serwerem."
2. Wyświetl przycisk "Spróbuj ponownie" w miejscu tabeli

### 10.5. Stan pusty (Empty State)

**Przyczyna:** Użytkownik nie ma żadnych analiz.

**Obsługa:**
1. Wyświetl komponent `EmptyState` z ikoną i komunikatem
2. CTA "Utwórz pierwszą analizę" prowadzi do `/analysis/new`

**Uwaga:** Rozróżnienie między "brak wyników dla filtrów" a "brak analiz w ogóle":
- `total === 0 && !hasActiveFilters` → EmptyState z CTA
- `total === 0 && hasActiveFilters` → Komunikat "Brak wyników dla podanych kryteriów" z przyciskiem "Wyczyść filtry"

### 10.6. Błąd usuwania (DELETE)

**Przyczyna:** Błąd podczas próby usunięcia analizy.

**Obsługa dla różnych kodów błędów:**

| Status | Komunikat | Akcja |
|--------|-----------|-------|
| 401 | "Sesja wygasła. Zaloguj się ponownie." | Przekierowanie na `/login` |
| 404 | "Analiza nie została znaleziona." | Zamknięcie dialogu, refetch listy |
| 400 | "Nieprawidłowe żądanie." | Zamknięcie dialogu |
| 500 | "Błąd serwera. Spróbuj ponownie później." | Zamknięcie dialogu (dialog można otworzyć ponownie) |
| Network | "Brak połączenia z serwerem." | Zamknięcie dialogu |

**Przepływ obsługi błędu:**
1. Ustaw `isDeleting = false`
2. Wyświetl toast z odpowiednim komunikatem błędu
3. Zamknij dialog (oprócz 401, gdzie następuje przekierowanie)
4. Dla 404: automatycznie odśwież listę (element mógł być usunięty w innej sesji)

### 10.7. Sukces usuwania

**Obsługa:**
1. Wyświetl toast z komunikatem "Analiza została usunięta"
2. Zamknij dialog
3. Odśwież listę (refetch)
4. Jeśli usunięto ostatni element na stronie > 1, przejdź do poprzedniej strony

## 11. Kroki implementacji

### Krok 1: Przygotowanie typów i stałych
1. Dodać nowe typy ViewModel do `src/types.ts` lub osobnego pliku `src/types/history.types.ts`
2. Zdefiniować stałe: `ALLOWED_LIMITS = [10, 20, 50]`, `STATUS_VARIANTS`

### Krok 2: Implementacja custom hooka `useHistoryData`
1. Utworzyć plik `src/hooks/useHistoryData.ts`
2. Zaimplementować logikę zarządzania stanem
3. Zaimplementować synchronizację z URL search params
4. Zaimplementować funkcję `fetchAnalyses`
5. Dodać obsługę stanów ładowania i błędów

### Krok 3: Implementacja komponentu StatusBadge
1. Utworzyć plik `src/components/history/StatusBadge.tsx`
2. Zaimplementować mapowanie kodu statusu na wariant Badge
3. Dodać polskie etykiety statusów (draft → "Szkic", pending_review → "Do przeglądu", completed → "Zakończona")

### Krok 4: Implementacja komponentu Pagination
1. Utworzyć plik `src/components/history/Pagination.tsx`
2. Użyć komponentów shadcn/ui: Button, Select
3. Zaimplementować logikę blokowania przycisków
4. Dodać aria-labels dla dostępności

### Krok 5: Implementacja komponentu HistoryTableSkeleton
1. Utworzyć plik `src/components/history/HistoryTableSkeleton.tsx`
2. Użyć komponentów shadcn/ui: Table, Skeleton
3. Symulować strukturę tabeli z placeholderami

### Krok 6: Implementacja komponentu HistoryTable i RowActions
1. Utworzyć plik `src/components/history/HistoryTable.tsx`
2. Utworzyć plik `src/components/history/RowActions.tsx`
3. Użyć komponentów shadcn/ui: Table, TableHeader, TableBody, TableRow, TableCell, Button
4. Dodać ikony sortowania w nagłówkach
5. Dodać kolumnę "Akcje" z przyciskami "Szczegóły" i "Usuń"
6. Zaimplementować obsługę kliknięcia przycisków akcji
7. Zintegrować StatusBadge
8. Zapewnić prawidłowe atrybuty dostępności (scope, aria-sort)
9. Dodać stan ładowania dla przycisku "Usuń" podczas usuwania

### Krok 7: Implementacja komponentu HistoryFilters
1. Utworzyć plik `src/components/history/HistoryFilters.tsx`
2. Użyć komponentów shadcn/ui: Input, Button, Select
3. Zaimplementować kontrolowany input wyszukiwania
4. Dodać obsługę Enter w polu wyszukiwania
5. Zaimplementować dropdown statusu z opcją "Wszystkie"

### Krok 8: Implementacja komponentu EmptyState
1. Utworzyć plik `src/components/history/EmptyState.tsx`
2. Dodać ikonę, komunikat i przycisk CTA
3. Obsłużyć wariant dla braku wyników filtrowania

### Krok 9: Implementacja komponentu DeleteConfirmDialog
1. Utworzyć plik `src/components/history/DeleteConfirmDialog.tsx`
2. Użyć komponentów shadcn/ui: AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
3. Zaimplementować wyświetlanie nazwy PR w treści dialogu
4. Dodać stan ładowania dla przycisku "Usuń"
5. Zapewnić focus trap i obsługę Escape
6. Dodać odpowiednie aria-labels

### Krok 10: Implementacja głównego komponentu HistoryView
1. Utworzyć plik `src/components/history/HistoryView.tsx`
2. Zintegrować hook `useHistoryData`
3. Skomponować komponenty potomne (w tym DeleteConfirmDialog)
4. Zaimplementować logikę warunkowego renderowania (loading/error/empty/data)
5. Dodać obsługę nawigacji
6. Zintegrować logikę usuwania z dialogiem potwierdzenia

### Krok 11: Implementacja komponentów nawigacji
1. Zaimplementować `Navbar` (`src/components/layout/Navbar.tsx`)
2. Zaimplementować `MobileMenu` (`src/components/layout/MobileMenu.tsx`)
3. Dodać responsywność z Tailwind (ukrywanie na odpowiednich breakpointach)

### Krok 12: Aktualizacja strony Astro
1. Zmodyfikować `src/pages/index.astro`
2. Dodać import i użycie Layout
3. Dodać `HistoryView` z dyrektywą `client:load`
4. Przekazać początkowe dane (jeśli potrzebne - SSR)

### Krok 13: Implementacja toastów i powiadomień
1. Skonfigurować Sonner (toast library z shadcn/ui)
2. Dodać toasty dla błędów i akcji
3. Dodać toast sukcesu dla usunięcia analizy
4. Dodać toasty błędów dla operacji usuwania

### Krok 14: Testowanie responsywności
1. Przetestować widok na desktop (>1024px)
2. Przetestować widok na tablet (768-1024px)
3. Przetestować widok na mobile (<768px)
4. Zweryfikować ukrywanie kolumny branch na mobile
5. Zweryfikować responsywność kolumny akcji

### Krok 15: Testowanie dostępności
1. Zweryfikować nawigację klawiaturą
2. Sprawdzić aria-labels i aria-sort
3. Przetestować z czytnikiem ekranu
4. Zweryfikować focus visible
5. Zweryfikować focus trap w dialogu usuwania

### Krok 16: Integracja i testy e2e
1. Przetestować pełny flow: zalogowanie → lista → filtrowanie → szczegóły
2. Przetestować obsługę błędów (symulacja 401, 500)
3. Przetestować stan pusty
4. Zweryfikować synchronizację URL
5. Przetestować flow usuwania: kliknięcie "Usuń" → dialog → potwierdzenie → toast → odświeżenie listy
6. Przetestować anulowanie usuwania
7. Przetestować błędy usuwania (symulacja 404, 500)
