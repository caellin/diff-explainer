# API Endpoint Implementation Plan: POST /api/analysis/:id/generate

## 1. Przegląd punktu końcowego

Endpoint `POST /api/analysis/:id/generate` służy do wyzwolenia generowania opisu PR przez AI dla istniejącej analizy (draftu). Jest to operacja regeneracji, która pozwala użytkownikowi ponownie wygenerować opis AI bez konieczności tworzenia nowej analizy.

**Główne funkcje:**
- Pobiera istniejącą analizę z bazy danych na podstawie `:id`
- Weryfikuje, czy użytkownik jest właścicielem analizy
- Wywołuje serwis AI z zapisanym `diff_content`
- Loguje żądanie AI do tabeli `ai_request_logs` z powiązaniem do `analysis_id`
- Aktualizuje rekord analizy z nową odpowiedzią AI
- Zwraca wygenerowany opis w formacie markdown

## 2. Szczegóły żądania

### Metoda HTTP
`POST`

### Struktura URL
```
/api/analysis/:id/generate
```

### Parametry

| Typ | Nazwa | Typ danych | Wymagany | Opis |
|-----|-------|------------|----------|------|
| Path | `id` | UUID | ✅ Tak | Identyfikator istniejącej analizy |

### Request Body
```json
{}
```
Puste ciało żądania. W przyszłości może zawierać opcjonalne parametry konfiguracyjne (np. wybór modelu AI).

### Nagłówki

| Nagłówek | Wartość | Wymagany |
|----------|---------|----------|
| `Authorization` | `Bearer <jwt_token>` | ✅ Tak |
| `Content-Type` | `application/json` | Opcjonalny |

## 3. Wykorzystywane typy

### Istniejące typy (z `src/types.ts`)

```typescript
// DTO odpowiedzi - już zdefiniowane
interface GenerateAnalysisResponseDTO {
  data: AIResponse;
}

// Struktura odpowiedzi AI - już zdefiniowana
interface AIResponse {
  summary: string;
  risks: string;
  tests: string;
}

// Encja analizy - już zdefiniowana
type AnalysisEntity = Tables<"pr_analyses">;
```

### Nowy schemat walidacji (do dodania w `src/lib/schemas/analysis.schema.ts`)

```typescript
import { z } from "zod";

/**
 * Schemat walidacji parametru UUID dla endpointów z :id.
 */
export const uuidParamSchema = z.object({
  id: z.string().uuid("Invalid analysis ID format - must be a valid UUID"),
});

export type UUIDParam = z.infer<typeof uuidParamSchema>;
```

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

```json
{
  "data": {
    "summary": "## Podsumowanie\n\nTen PR wprowadza...",
    "risks": "## Potencjalne ryzyka\n\n1. ...",
    "tests": "## Sugerowane testy\n\n1. ..."
  }
}
```

### Kody statusu

| Kod | Opis | Kiedy |
|-----|------|-------|
| 200 | OK | Generowanie zakończone sukcesem |
| 400 | Bad Request | Nieprawidłowy format UUID |
| 401 | Unauthorized | Brak lub nieprawidłowy token JWT |
| 404 | Not Found | Analiza nie istnieje lub nie należy do użytkownika |
| 429 | Too Many Requests | Przekroczony limit żądań AI |
| 500 | Internal Server Error | Błąd bazy danych |
| 502 | Bad Gateway | Błąd generowania AI |
| 503 | Service Unavailable | Serwis AI niedostępny |
| 504 | Gateway Timeout | Timeout żądania AI |

### Struktura odpowiedzi błędu

```json
{
  "error": "Human-readable error message",
  "details": "Technical details for debugging",
  "status_code": 404
}
```

## 5. Przepływ danych

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Żądanie klienta                                  │
│                POST /api/analysis/:id/generate                          │
│                Authorization: Bearer <token>                            │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     1. Middleware (onRequest)                           │
│  • Tworzy instancję Supabase client                                     │
│  • Weryfikuje JWT token                                                 │
│  • Ustawia context.locals.user i context.locals.supabase                │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  2. API Route Handler (POST)                            │
│  • Sprawdza czy user istnieje (401 jeśli nie)                          │
│  • Waliduje :id jako UUID (400 jeśli nieprawidłowy)                    │
│  • Sprawdza klucz API OpenRouter (503 jeśli brak)                      │
│  • Tworzy instancję AnalysisService                                     │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              3. AnalysisService.generateForExisting()                   │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 3a. Pobierz analizę z bazy danych                                  │ │
│  │     SELECT id, diff_content, pr_name, branch_name, ticket_id       │ │
│  │     FROM pr_analyses WHERE id = :id                                │ │
│  │     → 404 jeśli nie znaleziono (RLS automatycznie filtruje)        │ │
│  └────────────────────────────┬───────────────────────────────────────┘ │
│                               │                                         │
│                               ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 3b. Wywołaj OpenRouterService.generateAnalysis()                   │ │
│  │     → Generuje summary, risks, tests w markdown                    │ │
│  │     → Zwraca model, tokenUsage, statusCode                         │ │
│  └────────────────────────────┬───────────────────────────────────────┘ │
│                               │                                         │
│                               ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 3c. Loguj żądanie AI (sukces lub błąd)                             │ │
│  │     INSERT INTO ai_request_logs (analysis_id, user_id, model,      │ │
│  │       token_usage, status_code, error_message)                     │ │
│  │     → Błąd logowania NIE przerywa przepływu                        │ │
│  └────────────────────────────┬───────────────────────────────────────┘ │
│                               │                                         │
│                               ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 3d. Aktualizuj analizę z odpowiedzią AI                            │ │
│  │     UPDATE pr_analyses SET ai_response = {...} WHERE id = :id      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    4. Odpowiedź do klienta                              │
│                       200 OK                                            │
│  { "data": { "summary": "...", "risks": "...", "tests": "..." } }      │
└─────────────────────────────────────────────────────────────────────────┘
```

## 6. Względy bezpieczeństwa

### 6.1 Uwierzytelnianie
- **Wymagany:** Token JWT w nagłówku `Authorization: Bearer <token>`
- **Weryfikacja:** Middleware weryfikuje token przez `supabase.auth.getUser(token)`
- **Błąd:** Zwraca `401 Unauthorized` gdy token jest nieprawidłowy lub wygasły

### 6.2 Autoryzacja
- **Row Level Security (RLS):** Polityka `auth.uid() = user_id` automatycznie filtruje wyniki
- **Weryfikacja właściciela:** Użytkownik może tylko regenerować swoje własne analizy
- **Izolacja:** Każde żądanie tworzy nową instancję klienta Supabase z kontekstem użytkownika

### 6.3 Walidacja danych wejściowych
- **UUID:** Walidacja formatu za pomocą Zod schema
- **Brak SQL Injection:** Supabase client używa prepared statements

### 6.4 Rate Limiting
- **Limit żądań AI:** OpenRouter może zwrócić 429 przy przekroczeniu limitu
- **Propagacja:** Kod 429 jest propagowany do klienta

### 6.5 Ochrona przed nadużyciami
- **Logowanie:** Wszystkie żądania AI są logowane z `analysis_id` i `user_id`
- **Audyt:** Możliwość śledzenia kosztów per użytkownik

## 7. Obsługa błędów

### 7.1 Scenariusze błędów

| Scenariusz | Kod HTTP | Komunikat | Akcja |
|------------|----------|-----------|-------|
| Brak tokenu JWT | 401 | "Unauthorized" | Zwróć odpowiedź błędu |
| Nieprawidłowy format UUID | 400 | "Invalid analysis ID format" | Zwróć odpowiedź błędu |
| Analiza nie znaleziona | 404 | "Analysis not found" | Zwróć odpowiedź błędu |
| Analiza należy do innego użytkownika | 404 | "Analysis not found" | RLS zwraca null, traktuj jako 404 |
| Brak klucza OpenRouter API | 503 | "AI service not configured" | Zwróć odpowiedź błędu |
| Błąd bazy danych | 500 | "Internal server error" | Loguj błąd, zwróć odpowiedź |
| Rate limit AI | 429 | "Too many requests - rate limit exceeded" | Loguj do ai_request_logs, zwróć odpowiedź |
| Timeout AI | 504 | "AI service timeout" | Loguj do ai_request_logs, zwróć odpowiedź |
| Błąd serwisu AI | 502 | "AI generation failed" | Loguj do ai_request_logs, zwróć odpowiedź |
| Serwis AI niedostępny | 503 | "AI service unavailable" | Loguj do ai_request_logs, zwróć odpowiedź |

### 7.2 Logowanie błędów AI

**KRYTYCZNE:** Każde żądanie AI musi być zalogowane do `ai_request_logs`, niezależnie od wyniku:

```typescript
await this.logAIRequest({
  analysisId: analysisId,
  userId: userId,
  model: error.model || "unknown",
  tokenUsage: error.tokenUsage || 0,
  statusCode: error.statusCode || 500,
  errorMessage: error.message,
});
```

### 7.3 Funkcja mapowania błędów

Wykorzystać istniejącą funkcję `mapErrorToResponse()` z rozszerzeniem dla błędów 404:

```typescript
function mapErrorToResponse(error: unknown): { statusCode: number; message: string; details: string } {
  // ... istniejąca logika ...
  
  if (errorMsg.includes("not found")) {
    statusCode = 404;
    message = "Analysis not found";
  }
}
```

## 8. Rozważania dotyczące wydajności

### 8.1 Optymalizacje zapytań
- **Minimalne SELECT:** Pobieraj tylko potrzebne kolumny (`id`, `diff_content`, `pr_name`, `branch_name`, `ticket_id`)
- **Pojedyncze zapytanie:** Użyj `.single()` zamiast `.first()` dla lepszej wydajności

### 8.2 Timeout AI
- **Konfigurowalny timeout:** Rozważ dodanie timeout dla żądań do OpenRouter - 60s
- **Graceful degradation:** W przypadku timeout, zapisz częściowy wynik jeśli możliwe

### 8.3 Asynchroniczne logowanie
- **Non-blocking:** Logowanie do `ai_request_logs` nie powinno blokować odpowiedzi
- **Fire-and-forget:** Błąd logowania nie przerywa głównego przepływu

### 8.4 Potencjalne wąskie gardła
- **Żądania AI:** Każde żądanie może trwać kilka sekund
- **Brak cache:** Każde wywołanie generuje nową odpowiedź AI
- **Limit rozmiaru:** `diff_content` max 1000 linii (walidowane przy tworzeniu)

## 9. Etapy wdrożenia

### Krok 1: Dodaj schemat walidacji UUID

**Plik:** `src/lib/schemas/analysis.schema.ts`

```typescript
/**
 * Schemat walidacji parametru UUID.
 * Używany dla endpointów z parametrem :id w URL.
 */
export const uuidParamSchema = z.object({
  id: z.string().uuid("Invalid analysis ID format - must be a valid UUID"),
});

export type UUIDParam = z.infer<typeof uuidParamSchema>;
```

### Krok 2: Rozszerz AnalysisService

**Plik:** `src/lib/services/analysis.service.ts`

Dodaj nową metodę `generateForExisting()`:

```typescript
/**
 * Wynik pobierania analizy do regeneracji.
 */
interface AnalysisForGeneration {
  id: string;
  diff_content: string;
  pr_name: string;
  branch_name: string;
  ticket_id: string | null;
}

/**
 * Błąd gdy analiza nie została znaleziona.
 */
export class AnalysisNotFoundError extends Error {
  constructor(analysisId: string) {
    super(`Analysis not found: ${analysisId}`);
    this.name = "AnalysisNotFoundError";
  }
}

/**
 * Regeneruje opis AI dla istniejącej analizy.
 *
 * Proces:
 * 1. Pobiera analizę z bazy danych
 * 2. Wywołuje serwis AI z zapisanym diff_content
 * 3. Loguje żądanie AI (sukces lub błąd)
 * 4. Aktualizuje rekord z nową odpowiedzią AI
 * 5. Zwraca wygenerowaną odpowiedź
 *
 * @param analysisId - UUID analizy do regeneracji
 * @param userId - ID zalogowanego użytkownika
 * @returns Odpowiedź AI z summary, risks, tests
 * @throws AnalysisNotFoundError gdy analiza nie istnieje
 * @throws Error gdy generowanie AI się nie powiedzie
 */
async generateForExisting(analysisId: string, userId: string): Promise<GenerateAnalysisResponseDTO> {
  // 1. Pobierz analizę z bazy
  const { data: analysis, error: fetchError } = await this.supabase
    .from("pr_analyses")
    .select("id, diff_content, pr_name, branch_name, ticket_id")
    .eq("id", analysisId)
    .single();

  if (fetchError || !analysis) {
    throw new AnalysisNotFoundError(analysisId);
  }

  // 2. Generuj analizę przez AI
  let aiResponse: AIResponse;
  try {
    const result = await this.openRouterService.generateAnalysis(
      analysis.diff_content,
      analysis.pr_name,
      analysis.branch_name,
      analysis.ticket_id ?? undefined
    );

    aiResponse = result.response;

    // 3a. Loguj sukces
    await this.logAIRequest({
      analysisId: analysis.id,
      userId,
      model: result.model,
      tokenUsage: result.tokenUsage,
      statusCode: result.statusCode,
      errorMessage: null,
    });

    // 4. Aktualizuj analizę
    const { error: updateError } = await this.supabase
      .from("pr_analyses")
      .update({ ai_response: aiResponse as unknown as Json })
      .eq("id", analysis.id);

    if (updateError) {
      console.error("[AnalysisService] Failed to update analysis with AI response:", updateError);
    }
  } catch (error) {
    const aiError = error as AIGenerationError;

    // 3b. Loguj błąd
    await this.logAIRequest({
      analysisId: analysis.id,
      userId,
      model: aiError.model || "unknown",
      tokenUsage: aiError.tokenUsage || 0,
      statusCode: aiError.statusCode || 500,
      errorMessage: aiError.message,
    });

    throw new Error(`AI generation failed: ${aiError.message}`);
  }

  // 5. Zwróć odpowiedź
  return {
    data: aiResponse,
  };
}
```

### Krok 3: Utwórz plik route handler

**Plik:** `src/pages/api/analysis/[id]/generate.ts`

```typescript
import type { APIRoute } from "astro";

import { AnalysisService, AnalysisNotFoundError } from "../../../../lib/services/analysis.service";
import { uuidParamSchema } from "../../../../lib/schemas/analysis.schema";
import type { APIErrorResponse } from "../../../../types";

export const prerender = false;

/**
 * POST /api/analysis/:id/generate
 *
 * Regeneruje opis AI dla istniejącej analizy.
 *
 * @returns 200 - Generowanie zakończone sukcesem
 * @returns 400 - Nieprawidłowy format UUID
 * @returns 401 - Brak autoryzacji
 * @returns 404 - Analiza nie znaleziona
 * @returns 429 - Rate limit przekroczony
 * @returns 502 - Błąd generowania AI
 * @returns 503 - Serwis AI niedostępny
 * @returns 504 - Timeout serwisu AI
 */
export const POST: APIRoute = async ({ locals, params }) => {
  try {
    // 1. Sprawdź autoryzację
    const user = locals.user;
    if (!user) {
      return createErrorResponse({ error: "Unauthorized", status_code: 401 }, 401);
    }

    // 2. Waliduj parametr :id
    const validationResult = uuidParamSchema.safeParse({ id: params.id });
    if (!validationResult.success) {
      return createErrorResponse(
        {
          error: "Invalid analysis ID format",
          details: validationResult.error.issues[0]?.message,
          status_code: 400,
        },
        400
      );
    }

    // 3. Sprawdź klucz API OpenRouter
    const openRouterApiKey = import.meta.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      console.error("[POST /api/analysis/:id/generate] OPENROUTER_API_KEY is not configured");
      return createErrorResponse({ error: "AI service not configured", status_code: 503 }, 503);
    }

    // 4. Wywołaj serwis
    const analysisService = new AnalysisService(locals.supabase, openRouterApiKey);
    const result = await analysisService.generateForExisting(validationResult.data.id, user.id);

    // 5. Zwróć sukces
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[POST /api/analysis/:id/generate] Error:", error);

    // Obsługa AnalysisNotFoundError
    if (error instanceof AnalysisNotFoundError) {
      return createErrorResponse({ error: "Analysis not found", status_code: 404 }, 404);
    }

    const { statusCode, message, details } = mapErrorToResponse(error);
    return createErrorResponse({ error: message, details, status_code: statusCode }, statusCode);
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
 * Mapuje błąd na odpowiedni kod HTTP i komunikat.
 */
function mapErrorToResponse(error: unknown): { statusCode: number; message: string; details: string } {
  let statusCode = 500;
  let message = "Internal server error";
  let details = "Unknown error";

  if (error instanceof Error) {
    details = error.message;
    const errorMsg = error.message.toLowerCase();

    if (errorMsg.includes("timeout")) {
      statusCode = 504;
      message = "AI service timeout";
    } else if (errorMsg.includes("unavailable") || errorMsg.includes("503")) {
      statusCode = 503;
      message = "AI service unavailable";
    } else if (errorMsg.includes("rate limit") || errorMsg.includes("429")) {
      statusCode = 429;
      message = "Too many requests - rate limit exceeded";
    } else if (errorMsg.includes("ai generation failed")) {
      statusCode = 502;
      message = "AI generation failed";
    }
  }

  return { statusCode, message, details };
}
```

### Krok 4: Aktualizuj typy (jeśli potrzebne)

**Plik:** `src/types.ts`

Typy są już zdefiniowane. Upewnij się, że `GenerateAnalysisResponseDTO` jest eksportowany:

```typescript
// Już istnieje:
export interface GenerateAnalysisResponseDTO {
  data: AIResponse;
}
```

### Krok 5: Aktualizuj eksporty serwisu

**Plik:** `src/lib/services/analysis.service.ts`

Dodaj eksport klasy błędu:

```typescript
export { AnalysisNotFoundError };
```

### Krok 6: Testy manualne

1. **Test sukcesu:**
   ```bash
   curl -X POST http://localhost:4321/api/analysis/{valid-uuid}/generate \
     -H "Authorization: Bearer {jwt_token}" \
     -H "Content-Type: application/json"
   ```

2. **Test 401 - brak tokenu:**
   ```bash
   curl -X POST http://localhost:4321/api/analysis/{uuid}/generate
   ```

3. **Test 400 - nieprawidłowy UUID:**
   ```bash
   curl -X POST http://localhost:4321/api/analysis/invalid-id/generate \
     -H "Authorization: Bearer {jwt_token}"
   ```

4. **Test 404 - nieistniejąca analiza:**
   ```bash
   curl -X POST http://localhost:4321/api/analysis/00000000-0000-0000-0000-000000000000/generate \
     -H "Authorization: Bearer {jwt_token}"
   ```

5. **Test 429 - rate limit (użyj MOCK_ERROR_429 w diff):**
   - Najpierw utwórz analizę z diff zawierającym `MOCK_ERROR_429`
   - Następnie wywołaj generate

### Krok 7: Weryfikacja logowania AI

Sprawdź, czy wpisy są tworzone w tabeli `ai_request_logs`:

```sql
SELECT * FROM ai_request_logs 
WHERE analysis_id = '{uuid}' 
ORDER BY created_at DESC;
```

## 10. Checklist przed wdrożeniem

- [ ] Schemat `uuidParamSchema` dodany do `analysis.schema.ts`
- [ ] Metoda `generateForExisting()` dodana do `AnalysisService`
- [ ] Klasa `AnalysisNotFoundError` utworzona i eksportowana
- [ ] Plik `src/pages/api/analysis/[id]/generate.ts` utworzony
- [ ] Import `GenerateAnalysisResponseDTO` działa poprawnie
- [ ] Testy manualne przeszły pomyślnie
- [ ] Wpisy w `ai_request_logs` są tworzone poprawnie
- [ ] Linter nie zgłasza błędów
- [ ] Dokumentacja README zaktualizowana (opcjonalnie)
