# API Endpoint Implementation Plan: GET /api/analysis/:id

## 1. Przegląd punktu końcowego

Endpoint `GET /api/analysis/:id` służy do pobierania pełnych szczegółów konkretnej analizy PR. Zwraca kompletne dane analizy wraz z rozwiązanym statusem (jako obiekt zamiast samego ID). Endpoint jest chroniony autoryzacją i RLS - użytkownik może pobierać tylko własne analizy.

## 2. Szczegóły żądania

- **Metoda HTTP:** GET
- **Struktura URL:** `/api/analysis/:id`
- **Parametry:**
  - **Wymagane:**
    - `id` (path parameter) - UUID analizy do pobrania
  - **Opcjonalne:** Brak
- **Request Body:** Brak (metoda GET)
- **Nagłówki:**
  - `Authorization: Bearer <token>` - wymagany token sesji Supabase

## 3. Wykorzystywane typy

### Istniejące typy (src/types.ts)

```typescript
// DTO odpowiedzi - wrapper dla danych analizy
interface AnalysisResponseDTO {
  data: AnalysisDTO;
}

// Pełne DTO analizy
interface AnalysisDTO {
  id: string;
  pr_name: string;
  branch_name: string;
  diff_content: string;
  ai_response: AIResponse | EmptyAIResponse;
  status: StatusDTO;
  ticket_id: string | null;
  created_at: string;
  updated_at: string;
}

// DTO statusu
interface StatusDTO {
  id: number;
  code: string;
}

// Format odpowiedzi błędu
interface APIErrorResponse {
  error: string;
  details?: string;
  status_code: number;
}
```

### Istniejące schematy walidacji (src/lib/schemas/analysis.schema.ts)

```typescript
// Schemat walidacji UUID parametru
const uuidParamSchema = z.object({
  id: z.string().uuid("Invalid analysis ID format - must be a valid UUID"),
});
```

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "pr_name": "Add user authentication",
    "branch_name": "feature/user-auth",
    "diff_content": "diff --git a/src/auth.ts...",
    "ai_response": {
      "summary": "This PR implements...",
      "risks": "Potential security...",
      "tests": "1. Test login flow..."
    },
    "status": {
      "id": 1,
      "code": "draft"
    },
    "ticket_id": "JIRA-123",
    "created_at": "2026-01-15T10:30:00.000Z",
    "updated_at": "2026-01-15T10:35:00.000Z"
  }
}
```

### Błędy

| Kod | Opis | Przykładowa odpowiedź |
|-----|------|----------------------|
| 400 | Nieprawidłowy format UUID | `{ "error": "Invalid analysis ID format", "details": "...", "status_code": 400 }` |
| 401 | Brak autoryzacji | `{ "error": "Unauthorized", "status_code": 401 }` |
| 404 | Analiza nie znaleziona | `{ "error": "Analysis not found", "status_code": 404 }` |
| 500 | Błąd serwera | `{ "error": "Internal server error", "status_code": 500 }` |

## 5. Przepływ danych

```
┌─────────────────────────────────────────────────────────────────┐
│                        REQUEST                                   │
│  GET /api/analysis/550e8400-e29b-41d4-a716-446655440000         │
│  Authorization: Bearer <token>                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 1. AUTORYZACJA (middleware)                      │
│  - Weryfikacja tokena przez Supabase                            │
│  - Ustawienie user w locals                                      │
│  - Jeśli brak → 401 Unauthorized                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 2. WALIDACJA PARAMETRÓW                          │
│  - uuidParamSchema.safeParse(params)                            │
│  - Jeśli błąd → 400 Bad Request                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 3. POBRANIE DANYCH (AnalysisService)            │
│  - SELECT z pr_analyses JOIN analysis_statuses                  │
│  - RLS automatycznie filtruje do user_id                        │
│  - Jeśli brak danych → 404 Not Found                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 4. MAPOWANIE NA DTO                              │
│  - Konwersja encji na AnalysisDTO                               │
│  - Rozwinięcie status_id → { id, code }                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        RESPONSE                                  │
│  200 OK                                                          │
│  { "data": { ... AnalysisDTO ... } }                            │
└─────────────────────────────────────────────────────────────────┘
```

### Interakcja z bazą danych

Zapytanie SQL (realizowane przez Supabase SDK):

```sql
SELECT 
  pa.id, pa.pr_name, pa.branch_name, pa.diff_content, 
  pa.ai_response, pa.ticket_id, pa.created_at, pa.updated_at,
  ast.id as status_id, ast.code as status_code
FROM pr_analyses pa
INNER JOIN analysis_statuses ast ON pa.status_id = ast.id
WHERE pa.id = :analysisId
-- RLS automatycznie dodaje: AND pa.user_id = auth.uid()
```

## 6. Względy bezpieczeństwa

### Autoryzacja

- Endpoint wymaga zalogowanego użytkownika
- Token sesji przekazywany w nagłówku `Authorization: Bearer <token>`
- Middleware weryfikuje token i ustawia `locals.user`

### Row Level Security (RLS)

- Tabela `pr_analyses` ma włączony RLS
- Polityka: `auth.uid() = user_id`
- Użytkownik może pobrać tylko własne analizy
- Próba pobrania cudzej analizy zwraca 404 (nie 403) dla bezpieczeństwa

### Walidacja danych

- Parametr `id` walidowany jako UUID przez Zod
- Zapobiega SQL injection i nieprawidłowym zapytaniom

### Ochrona przed IDOR

- Insecure Direct Object Reference chronione przez RLS
- Nawet znając UUID cudzej analizy, użytkownik nie może jej pobrać

## 7. Obsługa błędów

### Hierarchia obsługi błędów w endpoint

```typescript
try {
  // 1. Sprawdź autoryzację → 401
  // 2. Waliduj UUID → 400
  // 3. Pobierz z serwisu → może rzucić AnalysisNotFoundError
  // 4. Zwróć sukces → 200
} catch (error) {
  if (error instanceof AnalysisNotFoundError) → 404
  else → 500 (z logowaniem błędu)
}
```

### Scenariusze błędów

| Scenariusz | Wykrycie | Kod | Odpowiedź |
|------------|----------|-----|-----------|
| Brak tokena Authorization | middleware + locals.user check | 401 | `{ "error": "Unauthorized" }` |
| Token wygasły/nieprawidłowy | middleware | 401 | `{ "error": "Unauthorized" }` |
| ID nie jest UUID | uuidParamSchema | 400 | `{ "error": "Invalid analysis ID format" }` |
| Analiza nie istnieje | Supabase zwraca null | 404 | `{ "error": "Analysis not found" }` |
| Analiza należy do innego użytkownika | RLS blokuje dostęp | 404 | `{ "error": "Analysis not found" }` |
| Błąd połączenia z bazą | Supabase error | 500 | `{ "error": "Internal server error" }` |

## 8. Rozważania dotyczące wydajności

### Optymalizacje zapytań

- Użycie indeksu na `pr_analyses.id` (PRIMARY KEY)
- JOIN z `analysis_statuses` jest szybki (mała tabela słownikowa)
- RLS korzysta z indeksu na `user_id`

### Rozmiar odpowiedzi

- Pole `diff_content` może być duże (do 1000 linii)
- Rozważyć kompresję gzip dla odpowiedzi (konfiguracja serwera)

### Caching

- Endpoint zwraca dane mutowalne - cache nie jest zalecany
- Jeśli potrzebny, użyć krótki TTL i cache-control: private

## 9. Etapy wdrożenia

### Krok 1: Dodaj metodę getAnalysisById do AnalysisService

**Plik:** `src/lib/services/analysis.service.ts`

```typescript
/**
 * Pobiera pojedynczą analizę po ID.
 *
 * @param analysisId - UUID analizy do pobrania
 * @returns Analiza jako DTO z rozwiązanym statusem
 * @throws AnalysisNotFoundError gdy analiza nie istnieje lub nie należy do użytkownika
 */
async getAnalysisById(analysisId: string): Promise<AnalysisResponseDTO> {
  // 1. Pobierz analizę z JOIN na status
  const { data, error } = await this.supabase
    .from("pr_analyses")
    .select(`
      id, pr_name, branch_name, diff_content, ai_response, 
      ticket_id, created_at, updated_at,
      analysis_statuses!inner(id, code)
    `)
    .eq("id", analysisId)
    .single();

  // 2. Obsłuż błędy
  if (error || !data) {
    throw new AnalysisNotFoundError(analysisId);
  }

  // 3. Mapuj na DTO
  const status = data.analysis_statuses as { id: number; code: string };
  
  return {
    data: {
      id: data.id,
      pr_name: data.pr_name,
      branch_name: data.branch_name,
      diff_content: data.diff_content,
      ai_response: data.ai_response as AIResponse,
      status: { id: status.id, code: status.code },
      ticket_id: data.ticket_id,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
  };
}
```

### Krok 2: Dodaj handler GET do istniejącego pliku endpoint

**Plik:** `src/pages/api/analysis/[id]/index.ts`

Dodaj eksport `GET` obok istniejącego `PUT`:

```typescript
import type { APIRoute } from "astro";
import { AnalysisService, AnalysisNotFoundError } from "../../../../lib/services/analysis.service";
import { uuidParamSchema } from "../../../../lib/schemas/analysis.schema";
import type { APIErrorResponse } from "../../../../types";

export const prerender = false;

/**
 * GET /api/analysis/:id
 *
 * Pobiera pełne szczegóły konkretnej analizy PR.
 *
 * @returns 200 - Analiza pobrana pomyślnie
 * @returns 400 - Nieprawidłowy format UUID
 * @returns 401 - Brak autoryzacji
 * @returns 404 - Analiza nie znaleziona
 * @returns 500 - Błąd serwera
 */
export const GET: APIRoute = async ({ locals, params }) => {
  try {
    // 1. Sprawdź autoryzację
    const user = locals.user;
    if (!user) {
      return createErrorResponse({ error: "Unauthorized", status_code: 401 }, 401);
    }

    // 2. Waliduj parametr :id (UUID)
    const paramValidation = uuidParamSchema.safeParse(params);
    if (!paramValidation.success) {
      return createErrorResponse(
        {
          error: "Invalid analysis ID format",
          details: paramValidation.error.issues[0]?.message,
          status_code: 400,
        },
        400
      );
    }
    const { id: analysisId } = paramValidation.data;

    // 3. Pobierz analizę z serwisu
    const analysisService = new AnalysisService(locals.supabase, "");
    const result = await analysisService.getAnalysisById(analysisId);

    // 4. Zwróć sukces
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[GET /api/analysis/:id] Error fetching analysis:", error);

    if (error instanceof AnalysisNotFoundError) {
      return createErrorResponse({ error: "Analysis not found", status_code: 404 }, 404);
    }

    return createErrorResponse({ error: "Internal server error", status_code: 500 }, 500);
  }
};

// ... istniejący kod PUT i funkcje pomocnicze ...
```

### Krok 3: Refaktoryzacja funkcji pomocniczych

Funkcja `createErrorResponse` jest już zdefiniowana w pliku dla handlera PUT. Upewnij się, że jest współdzielona między GET i PUT (bez duplikacji).

### Krok 4: Testy manualne

Przetestuj endpoint za pomocą curl lub Postman:

```bash
# Sukces - istniejąca analiza
curl -X GET http://localhost:4321/api/analysis/[valid-uuid] \
  -H "Authorization: Bearer [token]"

# 400 - nieprawidłowy UUID
curl -X GET http://localhost:4321/api/analysis/not-a-uuid \
  -H "Authorization: Bearer [token]"

# 401 - brak autoryzacji
curl -X GET http://localhost:4321/api/analysis/[valid-uuid]

# 404 - nieistniejąca analiza
curl -X GET http://localhost:4321/api/analysis/00000000-0000-0000-0000-000000000000 \
  -H "Authorization: Bearer [token]"
```

### Krok 5: Weryfikacja zgodności ze specyfikacją

Sprawdź, czy odpowiedź zawiera wszystkie wymagane pola:
- `id` (UUID)
- `pr_name` (string)
- `diff_content` (string)
- `ai_response` (obiekt z summary, risks, tests)
- `status` (obiekt z id i code)
- `created_at` (ISO8601)
- `updated_at` (ISO8601)

Dodatkowe pola w implementacji (zgodne z `AnalysisDTO`):
- `branch_name` (string)
- `ticket_id` (string | null)

## 10. Checklist implementacji

- [ ] Dodać metodę `getAnalysisById` do `AnalysisService`
- [ ] Dodać eksport `GET` w `src/pages/api/analysis/[id]/index.ts`
- [ ] Upewnić się, że funkcje pomocnicze nie są zduplikowane
- [ ] Przetestować wszystkie scenariusze błędów (401, 400, 404, 500)
- [ ] Przetestować scenariusz sukcesu (200)
- [ ] Zweryfikować strukturę odpowiedzi zgodną ze specyfikacją
- [ ] Sprawdzić działanie RLS (próba pobrania cudzej analizy)
