# API Endpoint Implementation Plan: GET /api/analysis/all

## 1. Przegląd punktu końcowego

Endpoint `GET /api/analysis/all` służy do pobierania paginowanej listy zapisanych analiz PR dla zalogowanego użytkownika. Umożliwia filtrowanie po statusie, wyszukiwanie tekstowe w nazwie PR lub brancha oraz sortowanie po dacie utworzenia. Zwraca uproszczoną reprezentację analizy (bez ciężkich pól jak `diff_content` i `ai_response`) dla wydajności.

## 2. Szczegóły żądania

- **Metoda HTTP:** GET
- **Struktura URL:** `/api/analysis/all`
- **Parametry Query:**

| Parametr | Typ | Wymagany | Domyślna wartość | Opis |
|----------|-----|----------|------------------|------|
| `page` | number | Nie | 1 | Numer strony (min: 1) |
| `limit` | number | Nie | 10 | Liczba elementów na stronie (min: 1, max: 100) |
| `status_id` | number | Nie | - | Filtrowanie po ID statusu |
| `search` | string | Nie | - | Unified search - przeszukuje jednocześnie `pr_name` i `branch_name` używając OR (case-insensitive, max: 255 znaków) |
| `sort_field` | string | Nie | 'created_at' | Pole sortowania: 'created_at', 'pr_name' lub 'branch_name' |
| `sort_order` | string | Nie | 'desc' | Kierunek sortowania: 'asc' lub 'desc' |

- **Request Body:** Brak (metoda GET)
- **Nagłówki wymagane:**
  - `Authorization: Bearer <token>` - token JWT z Supabase Auth

## 3. Wykorzystywane typy

### Istniejące typy z `src/types.ts`:

```typescript
// Pojedynczy element listy analiz
interface AnalysisListItemDTO {
  id: string;                    // UUID analizy
  pr_name: string;               // Nazwa pull requesta
  branch_name: string;           // Nazwa brancha
  status: StatusDTO;             // Status analizy { id, code }
  created_at: string;            // Data utworzenia (ISO8601)
}

// Odpowiedź z paginowaną listą
interface AnalysisListResponseDTO {
  data: AnalysisListItemDTO[];   // Lista analiz na stronie
  meta: PaginationMeta;          // Metadane paginacji
}

// Metadane paginacji
interface PaginationMeta {
  total: number;                 // Całkowita liczba rekordów
  page: number;                  // Aktualny numer strony
  limit: number;                 // Liczba elementów na stronie
}

// Parametry zapytania
interface GetAnalysesQuery {
  page?: number;
  limit?: number;
  status_id?: number;
  search?: string;               // Unified search w pr_name i branch_name
  sort_field?: SortField;        // 'created_at' | 'pr_name' | 'branch_name'
  sort_order?: SortDirection;    // 'asc' | 'desc'
}
```

### Nowy schemat walidacji (do dodania w `src/lib/schemas/analysis.schema.ts`):

```typescript
/**
 * Dozwolone pola sortowania dla listy analiz.
 */
export const ALLOWED_SORT_FIELDS = ["created_at", "pr_name", "branch_name"] as const;

// Schema walidacji query parameters
export const getAnalysesQuerySchema = z.object({
  page: z.coerce
    .number()
    .int("Page must be an integer")
    .min(1, "Page must be at least 1")
    .default(1),
  limit: z.coerce
    .number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit cannot exceed 100")
    .default(10),
  status_id: z.coerce
    .number()
    .int("Status ID must be an integer")
    .positive("Status ID must be positive")
    .optional(),
  search: z
    .string()
    .max(255, "Search query must be 255 characters or less")
    .trim()
    .optional(),
  sort_field: z.enum(ALLOWED_SORT_FIELDS).default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});
```

## 4. Szczegóły odpowiedzi

### Sukces (200 OK):

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "pr_name": "Feature: Add user authentication",
      "branch_name": "feature/auth",
      "status": {
        "id": 1,
        "code": "draft"
      },
      "created_at": "2026-01-15T10:30:00.000Z"
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 10
  }
}
```

### Błąd walidacji (400 Bad Request):

```json
{
  "error": "Validation failed",
  "field_errors": {
    "page": ["Page must be at least 1"],
    "limit": ["Limit cannot exceed 100"]
  },
  "status_code": 400
}
```

### Brak autoryzacji (401 Unauthorized):

```json
{
  "error": "Unauthorized",
  "status_code": 401
}
```

### Błąd serwera (500 Internal Server Error):

```json
{
  "error": "Internal server error",
  "details": "Database connection failed",
  "status_code": 500
}
```

## 5. Przepływ danych

```
┌─────────────────┐
│  Klient HTTP    │
│  GET /api/...   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Astro API Route: src/pages/api/analysis/all.ts         │
│  1. Sprawdź autoryzację (locals.user)                   │
│  2. Parsuj query parameters z URL                       │
│  3. Waliduj parametry (Zod schema)                      │
│  4. Wywołaj AnalysisService.getAnalyses()               │
│  5. Zwróć odpowiedź JSON                                │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  AnalysisService.getAnalyses(query)                     │
│  1. Oblicz offset: (page - 1) * limit                   │
│  2. Buduj zapytanie Supabase z dynamicznymi filtrami    │
│  3. Wykonaj COUNT dla total                             │
│  4. Wykonaj SELECT z paginacją i sortowaniem            │
│  5. Mapuj encje na DTO                                  │
│  6. Zwróć AnalysisListResponseDTO                       │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  Supabase (PostgreSQL + RLS)                            │
│  - Tabela: pr_analyses + JOIN analysis_statuses         │
│  - RLS: auth.uid() = user_id                            │
│  - Indeksy: user_id, status_id, pr_name, branch_name    │
└─────────────────────────────────────────────────────────┘
```

### Szczegóły zapytania Supabase:

```typescript
// Bazowe zapytanie z JOIN na status
let query = supabase
  .from("pr_analyses")
  .select(`
    id, pr_name, branch_name, created_at,
    analysis_statuses!inner(id, code)
  `, { count: 'exact' });

// Dynamiczne filtry
if (status_id) {
  query = query.eq("status_id", status_id);
}

if (search) {
  // Unified search - przeszukuje pr_name i branch_name jednocześnie
  // ILIKE = case-insensitive LIKE w PostgreSQL
  query = query.or(`pr_name.ilike.%${search}%,branch_name.ilike.%${search}%`);
}

// Sortowanie po wybranym polu i kierunku
// sort_field: 'created_at' | 'pr_name' | 'branch_name'
// sort_order: 'asc' | 'desc'
query = query
  .order(sort_field, { ascending: sort_order === "asc" })
  .range(offset, offset + limit - 1);
```

**Jak działa unified search:**
1. Użytkownik wpisuje np. "feature"
2. System generuje: `WHERE pr_name ILIKE '%feature%' OR branch_name ILIKE '%feature%'`
3. Zwracane są analizy gdzie "feature" występuje w nazwie PR LUB nazwie brancha
4. Jest to standardowy pattern UX - prostszy dla użytkownika niż wybór pola

## 6. Względy bezpieczeństwa

### 6.1 Autoryzacja
- Weryfikacja tokenu JWT przez middleware Supabase
- Sprawdzenie `locals.user` przed przetwarzaniem żądania
- RLS w PostgreSQL automatycznie filtruje dane do właściciela

### 6.2 Walidacja danych wejściowych
- Wszystkie parametry walidowane przez Zod schema
- Limity paginacji zapobiegają nadmiernemu pobieraniu danych (max 100)
- Długość wyszukiwania ograniczona do 255 znaków
- Użycie `z.coerce` dla konwersji query string na number

### 6.3 Ochrona przed SQL Injection
- Parametryzowane zapytania Supabase (nie raw SQL)
- Metoda `.ilike()` automatycznie escapuje znaki specjalne
- Brak konkatenacji stringów w zapytaniach

### 6.4 Rate Limiting
- Rozważyć implementację rate limiting na poziomie middleware
- Sugerowany limit: 60 żądań/minutę na użytkownika

## 7. Obsługa błędów

| Scenariusz | Kod HTTP | Odpowiedź |
|------------|----------|-----------|
| Brak tokenu autoryzacji | 401 | `{ error: "Unauthorized" }` |
| Nieprawidłowy token JWT | 401 | `{ error: "Unauthorized" }` |
| `page` < 1 | 400 | `{ error: "Validation failed", field_errors: { page: [...] } }` |
| `limit` > 100 | 400 | `{ error: "Validation failed", field_errors: { limit: [...] } }` |
| `status_id` nieprawidłowy typ | 400 | `{ error: "Validation failed", field_errors: { status_id: [...] } }` |
| `search` > 255 znaków | 400 | `{ error: "Validation failed", field_errors: { search: [...] } }` |
| `sort_field` nieprawidłowa wartość | 400 | `{ error: "Validation failed", field_errors: { sort_field: [...] } }` |
| `sort_order` nieprawidłowa wartość | 400 | `{ error: "Validation failed", field_errors: { sort_order: [...] } }` |
| Błąd połączenia z bazą danych | 500 | `{ error: "Internal server error", details: "..." }` |
| Nieoczekiwany błąd serwera | 500 | `{ error: "Internal server error" }` |

### Obsługa pustej listy:
- Pusta lista NIE jest błędem - zwracamy 200 OK z `data: []`
- Metadane zawierają `total: 0`

## 8. Rozważania dotyczące wydajności

### 8.1 Indeksy bazy danych
Istniejące indeksy wspierają wszystkie operacje:
- `idx_pr_analyses_user_id` - filtrowanie RLS
- `idx_pr_analyses_status_id` - filtrowanie po statusie
- `idx_pr_analyses_pr_name` - wyszukiwanie
- `idx_pr_analyses_branch_name` - wyszukiwanie
- `idx_pr_analyses_created_at` - sortowanie

### 8.2 Optymalizacje zapytań
- `{ count: 'exact' }` w Supabase wykonuje COUNT w jednym zapytaniu
- Użycie `.range()` zamiast `.limit().offset()` dla wydajności
- Pobieranie tylko wymaganych kolumn (bez `diff_content`, `ai_response`)
- JOIN z `analysis_statuses` poprzez `!inner` dla rozwiązania statusu

### 8.3 Limity paginacji
- Domyślny limit: 10
- Maksymalny limit: 100
- Zapobiega nadmiernemu obciążeniu bazy danych

### 8.4 Potencjalne wąskie gardła
- Wyszukiwanie tekstowe (ILIKE) może być wolne dla dużych zbiorów danych
- Rozważyć Full-Text Search dla > 10,000 rekordów
- COUNT może być kosztowny - cache'owanie dla często odpytywanych filtrów

## 9. Etapy wdrożenia

### Krok 0: Aktualizacja typów w `src/types.ts`

Plik: `src/types.ts`

Zaktualizować sekcję QUERY PARAMETERS:

```typescript
/**
 * Kierunek sortowania dla listy analiz.
 */
export type SortDirection = "asc" | "desc";

/**
 * Dozwolone pola sortowania dla listy analiz.
 */
export type SortField = "created_at" | "pr_name" | "branch_name";

/**
 * Parametry zapytania dla pobierania listy analiz.
 * Używane w GET /api/analysis/all.
 */
export interface GetAnalysesQuery {
  /** Numer strony (domyślnie 1) */
  page?: number;
  /** Liczba elementów na stronie (domyślnie 10) */
  limit?: number;
  /** Filtrowanie po ID statusu */
  status_id?: StatusEntity["id"];
  /** Unified search - przeszukuje pr_name i branch_name jednocześnie */
  search?: string;
  /** Pole sortowania (domyślnie 'created_at') */
  sort_field?: SortField;
  /** Kierunek sortowania (domyślnie 'desc') */
  sort_order?: SortDirection;
}
```

### Krok 1: Dodanie schematu walidacji

Plik: `src/lib/schemas/analysis.schema.ts`

```typescript
// Dodać na końcu pliku

const MAX_SEARCH_LENGTH = 255;
const MAX_PAGE_LIMIT = 100;

/**
 * Dozwolone pola sortowania dla listy analiz.
 * Odpowiadają kolumnom z indeksami w tabeli pr_analyses.
 */
export const ALLOWED_SORT_FIELDS = ["created_at", "pr_name", "branch_name"] as const;

/**
 * Typ pola sortowania wynikający z dozwolonych wartości.
 */
export type SortField = (typeof ALLOWED_SORT_FIELDS)[number];

/**
 * Schemat walidacji dla parametrów zapytania listy analiz.
 *
 * Waliduje:
 * - page: numer strony (min 1, domyślnie 1)
 * - limit: liczba elementów na stronie (1-100, domyślnie 10)
 * - status_id: opcjonalny filtr po ID statusu
 * - search: unified search w pr_name i branch_name (max 255 znaków)
 * - sort_field: pole sortowania (domyślnie 'created_at')
 * - sort_order: kierunek sortowania (domyślnie 'desc')
 */
export const getAnalysesQuerySchema = z.object({
  page: z.coerce
    .number()
    .int("Page must be an integer")
    .min(1, "Page must be at least 1")
    .default(1),
  limit: z.coerce
    .number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(MAX_PAGE_LIMIT, `Limit cannot exceed ${MAX_PAGE_LIMIT}`)
    .default(10),
  status_id: z.coerce
    .number()
    .int("Status ID must be an integer")
    .positive("Status ID must be positive")
    .optional(),
  search: z
    .string()
    .max(MAX_SEARCH_LENGTH, `Search query must be ${MAX_SEARCH_LENGTH} characters or less`)
    .trim()
    .optional(),
  sort_field: z.enum(ALLOWED_SORT_FIELDS).default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Typ wejściowy dla listy analiz, wynikający ze schematu Zod.
 */
export type GetAnalysesQueryInput = z.infer<typeof getAnalysesQuerySchema>;
```

Aktualizacja `VALIDATION_LIMITS`:
```typescript
export const VALIDATION_LIMITS = {
  MAX_DIFF_LINES,
  MAX_BRANCH_NAME_LENGTH,
  MAX_TICKET_ID_LENGTH,
  MAX_DELETE_IDS,
  MAX_SEARCH_LENGTH,
  MAX_PAGE_LIMIT,
} as const;
```

### Krok 2: Rozszerzenie serwisu AnalysisService

Plik: `src/lib/services/analysis.service.ts`

Dodać import:
```typescript
import type {
  // ... istniejące importy
  GetAnalysesQuery,
  AnalysisListResponseDTO,
  AnalysisListItemDTO,
} from "../../types";
```

Dodać metodę w klasie `AnalysisService`:
```typescript
/**
 * Pobiera paginowaną listę analiz dla użytkownika.
 *
 * Proces:
 * 1. Buduje zapytanie z dynamicznymi filtrami
 * 2. Wykonuje COUNT i SELECT w jednym zapytaniu
 * 3. Mapuje encje na uproszczone DTO
 * 4. Zwraca listę z metadanymi paginacji
 *
 * @param query - Parametry zapytania (paginacja, filtry, sortowanie)
 * @returns Paginowana lista analiz z metadanymi
 * @throws Error gdy operacja bazy danych się nie powiedzie
 *
 * @remarks
 * Parametr `search` implementuje unified search - przeszukuje jednocześnie
 * pola pr_name i branch_name używając OR i ILIKE (case-insensitive).
 */
async getAnalyses(query: GetAnalysesQuery): Promise<AnalysisListResponseDTO> {
  const { 
    page = 1, 
    limit = 10, 
    status_id, 
    search, 
    sort_field = "created_at",
    sort_order = "desc" 
  } = query;
  const offset = (page - 1) * limit;

  // 1. Buduj bazowe zapytanie z JOIN na status
  let dbQuery = this.supabase
    .from("pr_analyses")
    .select(
      `
      id, pr_name, branch_name, created_at,
      analysis_statuses!inner(id, code)
    `,
      { count: "exact" }
    );

  // 2. Dodaj opcjonalne filtry
  if (status_id !== undefined) {
    dbQuery = dbQuery.eq("status_id", status_id);
  }

  // 3. Unified search - przeszukuje pr_name i branch_name jednocześnie
  if (search && search.trim().length > 0) {
    const searchTerm = search.trim();
    // OR condition: matches if search term appears in pr_name OR branch_name
    // ILIKE = case-insensitive LIKE in PostgreSQL
    dbQuery = dbQuery.or(
      `pr_name.ilike.%${searchTerm}%,branch_name.ilike.%${searchTerm}%`
    );
  }

  // 4. Sortowanie po wybranym polu i paginacja
  dbQuery = dbQuery
    .order(sort_field, { ascending: sort_order === "asc" })
    .range(offset, offset + limit - 1);

  // 5. Wykonaj zapytanie
  const { data, count, error } = await dbQuery;

  if (error) {
    throw new Error(`Failed to fetch analyses: ${error.message}`);
  }

  // 6. Mapuj encje na DTO
  const items: AnalysisListItemDTO[] = (data ?? []).map((row) => {
    const status = row.analysis_statuses as { id: number; code: string };
    return {
      id: row.id,
      pr_name: row.pr_name,
      branch_name: row.branch_name,
      status: { id: status.id, code: status.code },
      created_at: row.created_at,
    };
  });

  // 7. Zwróć odpowiedź z metadanymi
  return {
    data: items,
    meta: {
      total: count ?? 0,
      page,
      limit,
    },
  };
}
```

### Krok 3: Utworzenie endpointu API

Plik: `src/pages/api/analysis/all.ts` (nowy plik)

```typescript
import type { APIRoute } from "astro";
import { AnalysisService } from "../../../lib/services/analysis.service";
import { getAnalysesQuerySchema } from "../../../lib/schemas/analysis.schema";
import type { APIErrorResponse, ValidationErrorResponse, GetAnalysesQuery } from "../../../types";

export const prerender = false;

/**
 * GET /api/analysis/all
 *
 * Pobiera paginowaną listę analiz PR dla zalogowanego użytkownika.
 *
 * Wymaga autoryzacji: Bearer token w nagłówku Authorization.
 *
 * Query Parameters:
 * - page: numer strony (domyślnie 1)
 * - limit: liczba elementów na stronie (domyślnie 10, max 100)
 * - status_id: filtrowanie po ID statusu (opcjonalne)
 * - search: unified search - przeszukuje pr_name i branch_name (opcjonalne)
 * - sort_field: pole sortowania 'created_at', 'pr_name', 'branch_name' (domyślnie 'created_at')
 * - sort_order: kierunek sortowania 'asc' lub 'desc' (domyślnie 'desc')
 *
 * @returns 200 - Lista analiz z metadanymi paginacji
 * @returns 400 - Błąd walidacji parametrów
 * @returns 401 - Brak autoryzacji
 * @returns 500 - Błąd serwera
 */
export const GET: APIRoute = async ({ locals, url }) => {
  try {
    // 1. Sprawdź autoryzację
    const user = locals.user;
    if (!user) {
      return createErrorResponse({ error: "Unauthorized", status_code: 401 }, 401);
    }

    // 2. Parsuj query parameters z URL
    const queryParams = Object.fromEntries(url.searchParams.entries());

    // 3. Waliduj parametry
    const validationResult = getAnalysesQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of validationResult.error.issues) {
        const field = issue.path.join(".") || "query";
        if (!fieldErrors[field]) {
          fieldErrors[field] = [];
        }
        fieldErrors[field].push(issue.message);
      }
      return createValidationErrorResponse(fieldErrors);
    }

    // 4. Wywołaj serwis
    const query: GetAnalysesQuery = validationResult.data;
    const analysisService = new AnalysisService(locals.supabase, "");
    const result = await analysisService.getAnalyses(query);

    // 5. Zwróć sukces
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[GET /api/analysis/all] Error fetching analyses:", error);

    return createErrorResponse(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
        status_code: 500,
      },
      500
    );
  }
};

/**
 * Tworzy odpowiedź JSON z błędem.
 */
function createErrorResponse(error: APIErrorResponse, status: number): Response {
  return new Response(JSON.stringify(error), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Tworzy odpowiedź JSON z błędem walidacji.
 */
function createValidationErrorResponse(fieldErrors: Record<string, string[]>): Response {
  const errorResponse: ValidationErrorResponse = {
    error: "Validation failed",
    field_errors: fieldErrors,
    status_code: 400,
  };
  return createErrorResponse(errorResponse, 400);
}
```

### Krok 4: Aktualizacja dokumentacji API

Plik: `src/pages/api/analysis/README.md`

Dodać dokumentację nowego endpointu z przykładami użycia:
- Opis parametrów
- Przykłady zapytań curl
- Przykłady odpowiedzi

### Krok 5: Testowanie

1. **Testy jednostkowe:**
   - Walidacja schematu `getAnalysesQuerySchema`
   - Parsowanie różnych kombinacji parametrów
   - Obsługa wartości domyślnych

2. **Testy integracyjne:**
   - GET z domyślnymi parametrami
   - GET z paginacją (różne strony)
   - GET z filtrowaniem po statusie
   - GET z unified search (wyszukiwanie w pr_name i branch_name)
   - GET z sortowaniem po różnych polach (created_at, pr_name, branch_name)
   - GET z różnymi kierunkami sortowania (asc/desc)
   - GET bez autoryzacji (401)
   - GET z nieprawidłowymi parametrami (400)
   - GET z nieprawidłowym sort_field (400)

3. **Testy manualne:**
   ```bash
   # Podstawowe zapytanie (domyślne wartości)
   curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:4321/api/analysis/all"

   # Z paginacją
   curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:4321/api/analysis/all?page=2&limit=20"

   # Z filtrowaniem po statusie i unified search
   # search przeszukuje jednocześnie pr_name i branch_name
   curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:4321/api/analysis/all?status_id=1&search=feature"

   # Sortowanie po nazwie PR rosnąco
   curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:4321/api/analysis/all?sort_field=pr_name&sort_order=asc"

   # Sortowanie po nazwie brancha malejąco
   curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:4321/api/analysis/all?sort_field=branch_name&sort_order=desc"

   # Kombinacja wszystkich parametrów
   curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:4321/api/analysis/all?page=1&limit=25&status_id=2&search=auth&sort_field=created_at&sort_order=desc"
   ```

### Krok 6: Weryfikacja końcowa

1. Sprawdzenie linterów i typowania TypeScript
2. Weryfikacja poprawności odpowiedzi zgodnie ze specyfikacją
3. Sprawdzenie logów serwera pod kątem błędów
4. Weryfikacja działania RLS (użytkownik widzi tylko swoje analizy)
