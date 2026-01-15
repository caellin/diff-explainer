# API Endpoint Implementation Plan: PUT /api/analysis/:id

## 1. Przegląd punktu końcowego

Endpoint `PUT /api/analysis/:id` służy do aktualizacji i finalizacji istniejącej analizy PR. Jest wykorzystywany w dwóch głównych scenariuszach:

1. **Edycja wyniku AI** - użytkownik modyfikuje wygenerowane przez AI pola `summary`, `risks` lub `tests`
2. **Akceptacja analizy** - użytkownik zatwierdza analizę, zmieniając jej status z `draft` na `accepted`

Endpoint wymaga autoryzacji i dzięki Row Level Security (RLS) użytkownik może modyfikować tylko własne analizy.

## 2. Szczegóły żądania

### Metoda HTTP
`PUT`

### Struktura URL
```
/api/analysis/:id
```

### Parametry URL

| Parametr | Typ | Wymagany | Opis |
|----------|-----|----------|------|
| `id` | UUID | Tak | Unikalny identyfikator analizy |

### Request Body

```json
{
  "pr_name": string,        // Wymagane - nazwa Pull Requesta
  "ai_response": {
    "summary": string,      // Wymagane - podsumowanie zmian (markdown)
    "risks": string,        // Wymagane - potencjalne ryzyka (markdown)
    "tests": string         // Wymagane - sugerowane testy (markdown)
  },
  "status_id": number,      // Wymagane - ID statusu (1=draft, 2=accepted)
  "ticket_id": string       // Opcjonalne - identyfikator ticketa
}
```

### Nagłówki

| Nagłówek | Wartość | Opis |
|----------|---------|------|
| `Content-Type` | `application/json` | Wymagane |
| `Authorization` | `Bearer <token>` | Wymagane - token uwierzytelniający |

## 3. Wykorzystywane typy

### Istniejące typy z `src/types.ts`

```typescript
// Command model (Request Body)
interface UpdateAnalysisCommand {
  pr_name: AnalysisEntity["pr_name"];
  ai_response: AIResponse;
  status_id: AnalysisEntity["status_id"];
  ticket_id?: NonNullable<AnalysisEntity["ticket_id"]>;
}

// Response DTOs
interface AnalysisResponseDTO {
  data: AnalysisDTO;
}

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

interface StatusDTO {
  id: number;
  code: string;
}

interface AIResponse {
  summary: string;
  risks: string;
  tests: string;
}
```

### Nowy schemat walidacji do utworzenia

```typescript
// src/lib/schemas/analysis.schema.ts

const aiResponseSchema = z.object({
  summary: z
    .string({ required_error: "Summary is required" })
    .min(1, "Summary cannot be empty"),
  risks: z
    .string({ required_error: "Risks is required" })
    .min(1, "Risks cannot be empty"),
  tests: z
    .string({ required_error: "Tests is required" })
    .min(1, "Tests cannot be empty"),
});

export const updateAnalysisSchema = z.object({
  pr_name: z
    .string({ required_error: "PR name is required" })
    .min(1, "PR name cannot be empty")
    .trim(),
  ai_response: aiResponseSchema,
  status_id: z
    .number({ required_error: "Status ID is required" })
    .int("Status ID must be an integer")
    .positive("Status ID must be positive"),
  ticket_id: z
    .string()
    .max(VALIDATION_LIMITS.MAX_TICKET_ID_LENGTH, 
         `Ticket ID must be ${VALIDATION_LIMITS.MAX_TICKET_ID_LENGTH} characters or less`)
    .trim()
    .optional(),
});

export type UpdateAnalysisInput = z.infer<typeof updateAnalysisSchema>;
```

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)

```json
{
  "data": {
    "id": "uuid",
    "pr_name": "string",
    "branch_name": "string",
    "diff_content": "string",
    "ai_response": {
      "summary": "string",
      "risks": "string",
      "tests": "string"
    },
    "status": {
      "id": 2,
      "code": "accepted"
    },
    "ticket_id": "string | null",
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}
```

### Error Responses

| Kod | Typ | Przykład odpowiedzi |
|-----|-----|---------------------|
| 400 | Błąd walidacji | `{ "error": "Validation failed", "field_errors": {...}, "status_code": 400 }` |
| 401 | Brak autoryzacji | `{ "error": "Unauthorized", "status_code": 401 }` |
| 404 | Nie znaleziono | `{ "error": "Analysis not found", "status_code": 404 }` |
| 422 | Nieprawidłowy status | `{ "error": "Invalid status_id", "details": "Status does not exist", "status_code": 422 }` |
| 500 | Błąd serwera | `{ "error": "Internal server error", "status_code": 500 }` |

## 5. Przepływ danych

```
┌─────────────────┐
│  Client Request │
│  PUT /api/...   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Astro Handler  │
│  [id].ts        │
│  (PUT method)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Auth Check     │────▶│  401 Unauthorized│
│  (locals.user)  │ No  └─────────────────┘
└────────┬────────┘
         │ Yes
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Parse JSON     │────▶│  400 Invalid JSON│
│  (request.json) │ Err └─────────────────┘
└────────┬────────┘
         │ OK
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Validate UUID  │────▶│  400 Invalid UUID│
│  (uuidSchema)   │ Err └─────────────────┘
└────────┬────────┘
         │ OK
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Validate Body  │────▶│  400 Validation  │
│  (updateSchema) │ Err │      Error       │
└────────┬────────┘     └─────────────────┘
         │ OK
         ▼
┌─────────────────┐
│ AnalysisService │
│ updateAnalysis()│
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Validate       │────▶│  422 Invalid     │
│  status_id      │ Err │     status_id    │
│  (exists in DB) │     └─────────────────┘
└────────┬────────┘
         │ OK
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Update record  │────▶│  404 Not Found   │
│  in pr_analyses │ Err │  (RLS blocked)   │
└────────┬────────┘     └─────────────────┘
         │ OK
         ▼
┌─────────────────┐
│  Fetch updated  │
│  record + status│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Map to DTO     │
│  AnalysisDTO    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  200 OK         │
│  Response       │
└─────────────────┘
```

## 6. Względy bezpieczeństwa

### Uwierzytelnianie
- Endpoint wymaga zalogowanego użytkownika
- Token Bearer jest walidowany przez middleware Astro
- Brak użytkownika w `locals.user` skutkuje błędem 401

### Autoryzacja (Row Level Security)
- Supabase RLS automatycznie filtruje rekordy po `user_id`
- Polityka: `auth.uid() = user_id` dla operacji UPDATE
- Próba aktualizacji cudzej analizy zwróci 0 zaktualizowanych rekordów
- Serwis interpretuje to jako 404 Not Found

### Walidacja danych wejściowych
| Pole | Walidacja | Cel |
|------|-----------|-----|
| `id` (URL) | UUID format | Zapobieganie SQL injection |
| `pr_name` | Non-empty string | Wymagane pole |
| `ai_response.*` | Non-empty strings | Kompletność danych |
| `status_id` | Integer, exists in DB | Integralność danych |
| `ticket_id` | Max 255 chars | Zgodność z DB schema |

### Ochrona przed atakami
- **SQL Injection**: Supabase SDK używa parametryzowanych zapytań
- **XSS**: Dane przechowywane w JSON, sanitizacja przy wyświetlaniu
- **CSRF**: API bezstanowe z tokenem Bearer

## 7. Obsługa błędów

### Tabela błędów

| Scenariusz | Kod HTTP | Komunikat | Akcja |
|------------|----------|-----------|-------|
| Brak tokena autoryzacji | 401 | "Unauthorized" | Przekieruj do logowania |
| Nieprawidłowy JSON | 400 | "Invalid JSON body" | Wyświetl błąd użytkownikowi |
| Nieprawidłowy format UUID | 400 | "Invalid analysis ID format" | Wyświetl błąd |
| Błędy walidacji pól | 400 | "Validation failed" + field_errors | Podświetl błędne pola |
| Analiza nie istnieje | 404 | "Analysis not found" | Przekieruj do listy |
| Analiza należy do innego użytkownika | 404 | "Analysis not found" | Nie ujawniaj istnienia |
| Nieprawidłowy status_id | 422 | "Invalid status_id" | Wyświetl błąd |
| Błąd bazy danych | 500 | "Internal server error" | Zaloguj i wyświetl ogólny błąd |

### Logowanie błędów

```typescript
// Pattern dla logowania błędów
console.error("[PUT /api/analysis/:id] Error description:", {
  analysisId: id,
  userId: user.id,
  error: error.message,
  stack: error.stack
});
```

## 8. Rozważania dotyczące wydajności

### Optymalizacje zapytań

1. **Walidacja status_id w jednym zapytaniu**
   - Sprawdzenie istnienia statusu przed update
   - Alternatywnie: jedno zapytanie z JOIN i obsługą błędu FK

2. **Pobranie zaktualizowanego rekordu**
   - Użycie `.select()` po `.update()` zamiast osobnego SELECT
   - Supabase obsługuje `RETURNING *`

3. **Indeksy**
   - Index na `pr_analyses(id)` - PRIMARY KEY
   - Index na `pr_analyses(user_id)` - dla RLS
   - Index na `analysis_statuses(id)` - PRIMARY KEY

### Przykład zoptymalizowanego zapytania

```typescript
// Aktualizacja z pobraniem zaktualizowanego rekordu
const { data, error } = await supabase
  .from("pr_analyses")
  .update({
    pr_name: command.pr_name,
    ai_response: command.ai_response,
    status_id: command.status_id,
    ticket_id: command.ticket_id ?? null,
  })
  .eq("id", analysisId)
  .select(`
    id, pr_name, branch_name, diff_content, 
    ai_response, ticket_id, created_at, updated_at,
    analysis_statuses!inner(id, code)
  `)
  .single();
```

### Cachowanie
- Endpoint modyfikuje dane, więc brak cache na odpowiedzi
- Rozważyć invalidację cache list analiz (jeśli istnieje)

## 9. Etapy wdrożenia

### Krok 1: Rozszerzenie schematów walidacji

**Plik:** `src/lib/schemas/analysis.schema.ts`

```typescript
// Dodaj schemat dla AIResponse
const aiResponseSchema = z.object({
  summary: z
    .string({ required_error: "Summary is required" })
    .min(1, "Summary cannot be empty"),
  risks: z
    .string({ required_error: "Risks is required" })
    .min(1, "Risks cannot be empty"),
  tests: z
    .string({ required_error: "Tests is required" })
    .min(1, "Tests cannot be empty"),
});

// Dodaj schemat dla UpdateAnalysisCommand
export const updateAnalysisSchema = z.object({
  pr_name: z
    .string({ required_error: "PR name is required" })
    .min(1, "PR name cannot be empty")
    .trim(),
  ai_response: aiResponseSchema,
  status_id: z
    .number({ required_error: "Status ID is required" })
    .int("Status ID must be an integer")
    .positive("Status ID must be positive"),
  ticket_id: z
    .string()
    .max(VALIDATION_LIMITS.MAX_TICKET_ID_LENGTH)
    .trim()
    .optional(),
});

export type UpdateAnalysisInput = z.infer<typeof updateAnalysisSchema>;
```

### Krok 2: Dodanie błędów niestandardowych w serwisie

**Plik:** `src/lib/services/analysis.service.ts`

```typescript
/**
 * Błąd rzucany gdy status_id nie istnieje w bazie.
 */
export class InvalidStatusError extends Error {
  constructor(statusId: number) {
    super(`Invalid status_id: ${statusId}`);
    this.name = "InvalidStatusError";
  }
}
```

### Krok 3: Implementacja metody updateAnalysis w serwisie

**Plik:** `src/lib/services/analysis.service.ts`

Dodaj metodę do klasy `AnalysisService`:

```typescript
/**
 * Aktualizuje istniejącą analizę PR.
 *
 * Proces:
 * 1. Waliduje istnienie status_id w bazie
 * 2. Aktualizuje rekord w pr_analyses
 * 3. Pobiera zaktualizowany rekord z rozwiązanym statusem
 * 4. Mapuje na DTO i zwraca
 *
 * @param analysisId - UUID analizy do aktualizacji
 * @param command - Dane aktualizacji
 * @returns Zaktualizowana analiza jako DTO
 * @throws AnalysisNotFoundError gdy analiza nie istnieje lub nie należy do użytkownika
 * @throws InvalidStatusError gdy status_id nie istnieje w bazie
 */
async updateAnalysis(
  analysisId: string,
  command: UpdateAnalysisCommand
): Promise<AnalysisResponseDTO> {
  // 1. Waliduj status_id
  const { data: status, error: statusError } = await this.supabase
    .from("analysis_statuses")
    .select("id, code")
    .eq("id", command.status_id)
    .single();

  if (statusError || !status) {
    throw new InvalidStatusError(command.status_id);
  }

  // 2. Aktualizuj rekord
  const { data: updated, error: updateError } = await this.supabase
    .from("pr_analyses")
    .update({
      pr_name: command.pr_name,
      ai_response: command.ai_response as unknown as Json,
      status_id: command.status_id,
      ticket_id: command.ticket_id ?? null,
    })
    .eq("id", analysisId)
    .select("id, pr_name, branch_name, diff_content, ai_response, ticket_id, created_at, updated_at")
    .single();

  if (updateError || !updated) {
    // RLS może zwrócić null jeśli rekord nie istnieje lub nie należy do użytkownika
    throw new AnalysisNotFoundError(analysisId);
  }

  // 3. Mapuj na DTO
  return {
    data: {
      id: updated.id,
      pr_name: updated.pr_name,
      branch_name: updated.branch_name,
      diff_content: updated.diff_content,
      ai_response: updated.ai_response as AIResponse,
      status: { id: status.id, code: status.code },
      ticket_id: updated.ticket_id,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    },
  };
}
```

### Krok 4: Utworzenie pliku endpointu

**Plik:** `src/pages/api/analysis/[id]/index.ts`

```typescript
import type { APIRoute } from "astro";
import { AnalysisService, AnalysisNotFoundError, InvalidStatusError } from "../../../../lib/services/analysis.service";
import { uuidParamSchema, updateAnalysisSchema } from "../../../../lib/schemas/analysis.schema";
import type { UpdateAnalysisCommand, APIErrorResponse, ValidationErrorResponse } from "../../../../types";

export const prerender = false;

/**
 * PUT /api/analysis/:id
 *
 * Aktualizuje istniejącą analizę PR.
 *
 * @returns 200 - Analiza zaktualizowana pomyślnie
 * @returns 400 - Błąd walidacji danych wejściowych
 * @returns 401 - Brak autoryzacji
 * @returns 404 - Analiza nie znaleziona
 * @returns 422 - Nieprawidłowy status_id
 * @returns 500 - Błąd serwera
 */
export const PUT: APIRoute = async ({ locals, request, params }) => {
  try {
    // 1. Sprawdź autoryzację
    const user = locals.user;
    if (!user) {
      return createErrorResponse({ error: "Unauthorized", status_code: 401 }, 401);
    }

    // 2. Waliduj parametr :id
    const paramValidation = uuidParamSchema.safeParse(params);
    if (!paramValidation.success) {
      return createErrorResponse(
        { error: "Invalid analysis ID format", status_code: 400 },
        400
      );
    }
    const { id: analysisId } = paramValidation.data;

    // 3. Parsuj body żądania
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse({ error: "Invalid JSON body", status_code: 400 }, 400);
    }

    // 4. Waliduj dane wejściowe
    const validationResult = updateAnalysisSchema.safeParse(body);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of validationResult.error.issues) {
        const field = issue.path.join(".");
        if (!fieldErrors[field]) {
          fieldErrors[field] = [];
        }
        fieldErrors[field].push(issue.message);
      }
      return createValidationErrorResponse(fieldErrors);
    }

    // 5. Wywołaj serwis
    const command: UpdateAnalysisCommand = validationResult.data;
    const analysisService = new AnalysisService(locals.supabase, "");
    const result = await analysisService.updateAnalysis(analysisId, command);

    // 6. Zwróć sukces
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[PUT /api/analysis/:id] Error updating analysis:", error);

    if (error instanceof AnalysisNotFoundError) {
      return createErrorResponse({ error: "Analysis not found", status_code: 404 }, 404);
    }

    if (error instanceof InvalidStatusError) {
      return createErrorResponse(
        { error: "Invalid status_id", details: error.message, status_code: 422 },
        422
      );
    }

    return createErrorResponse(
      { error: "Internal server error", status_code: 500 },
      500
    );
  }
};

function createErrorResponse(error: APIErrorResponse, status: number): Response {
  return new Response(JSON.stringify(error), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createValidationErrorResponse(fieldErrors: Record<string, string[]>): Response {
  const errorResponse: ValidationErrorResponse = {
    error: "Validation failed",
    field_errors: fieldErrors,
    status_code: 400,
  };
  return createErrorResponse(errorResponse, 400);
}
```

### Krok 5: Aktualizacja eksportów

Upewnij się, że nowe typy i błędy są eksportowane:

**Plik:** `src/lib/services/analysis.service.ts`
- Wyeksportuj `InvalidStatusError`
- Dodaj import `UpdateAnalysisCommand` i `AnalysisResponseDTO`

**Plik:** `src/lib/schemas/analysis.schema.ts`
- Wyeksportuj `updateAnalysisSchema` i `UpdateAnalysisInput`

### Krok 6: Testy manualne

Scenariusze do przetestowania:

1. **Sukces (200)**
   ```bash
   curl -X PUT http://localhost:4321/api/analysis/{id} \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{
       "pr_name": "Updated PR Name",
       "ai_response": {
         "summary": "Updated summary",
         "risks": "Updated risks",
         "tests": "Updated tests"
       },
       "status_id": 2
     }'
   ```

2. **Brak autoryzacji (401)** - pomiń nagłówek Authorization

3. **Nieprawidłowy UUID (400)** - użyj `invalid-uuid` jako ID

4. **Błąd walidacji (400)** - wyślij pusty `pr_name`

5. **Analiza nie znaleziona (404)** - użyj nieistniejącego UUID

6. **Nieprawidłowy status_id (422)** - użyj `status_id: 999`

### Krok 7: Przegląd kodu

Checklist przed merge:
- [ ] Wszystkie testy manualne przechodzą
- [ ] Brak błędów lintera
- [ ] Zgodność z wzorcami istniejącego kodu
- [ ] Dokumentacja JSDoc dla publicznych metod
- [ ] Obsługa wszystkich scenariuszy błędów
- [ ] Logowanie błędów w odpowiednich miejscach
