# API Endpoint Implementation Plan: POST /api/analysis

## 1. Przegląd punktu końcowego

Endpoint `POST /api/analysis` tworzy nowy draft analizy PR i **wykonuje pierwszą analizę AI**. Jest to pierwszy i główny krok w przepływie generowania opisów PR - zapisuje diff i metadane, ustanawia identyfikator (UUID), wywołuje AI do analizy diffa, loguje żądanie AI, i zwraca kompletną odpowiedź z wygenerowanym opisem.

**Kluczowe cechy:**
- Waliduje długość `diff_content` (max 1000 linii)
- Tworzy rekord w tabeli `pr_analyses` ze statusem `draft` (status_id = 1)
- **Wykonuje żądanie do OpenRouter AI** w celu wygenerowania analizy diffa
- **Loguje żądanie AI** w tabeli `ai_request_logs`
- **Aktualizuje rekord** z wygenerowaną odpowiedzią AI
- Zwraca kompletną odpowiedź zawierającą `ai_response`
- Wymaga uwierzytelnienia użytkownika

## 2. Szczegóły żądania

- **Metoda HTTP:** POST
- **Struktura URL:** `/api/analysis`
- **Nagłówki wymagane:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>` (JWT z Supabase Auth)

### Parametry

**Wymagane:**
| Parametr | Typ | Opis | Walidacja |
|----------|-----|------|-----------|
| `pr_name` | string | Nazwa Pull Requesta | Niepusty string |
| `branch_name` | string | Nazwa brancha źródłowego | Niepusty string, max 255 znaków |
| `diff_content` | string | Surowa zawartość diffa git | Niepusty string, max 1000 linii |

**Opcjonalne:**
| Parametr | Typ | Opis | Walidacja |
|----------|-----|------|-----------|
| `ticket_id` | string | Identyfikator ticketa (np. JIRA) | Max 255 znaków |

### Request Body

```json
{
  "pr_name": "feat: add user authentication",
  "branch_name": "feature/user-auth",
  "ticket_id": "PROJ-123",
  "diff_content": "diff --git a/src/auth.ts b/src/auth.ts\n..."
}
```

## 3. Wykorzystywane typy

### DTOs i Command Modele z `src/types.ts`

```typescript
// Command Model (Request Body)
interface CreateAnalysisCommand {
  pr_name: AnalysisEntity["pr_name"];
  branch_name: AnalysisEntity["branch_name"];
  ticket_id?: NonNullable<AnalysisEntity["ticket_id"]>;
  diff_content: AnalysisEntity["diff_content"];
}

// AI Response (generowana przez AI)
interface AIResponse {
  summary: string;  // Podsumowanie zmian w formacie markdown
  risks: string;    // Potencjalne ryzyka w formacie markdown
  tests: string;    // Sugerowane testy w formacie markdown
}

// Response DTO
interface CreateAnalysisResponseDTO {
  data: {
    id: AnalysisEntity["id"];
    status: StatusDTO;
    ai_response: AIResponse;
    created_at: AnalysisEntity["created_at"];
  };
}

// Status DTO
type StatusDTO = Pick<StatusEntity, "id" | "code">;
```

### Typy bazodanowe

```typescript
// Z src/db/database.types.ts - TablesInsert<"pr_analyses">
interface PrAnalysesInsert {
  ai_response: Json;
  branch_name: string;
  created_at?: string;
  diff_content: string;
  id?: string;
  pr_name: string;
  status_id: number;
  ticket_id?: string | null;
  updated_at?: string;
  user_id: string;
}

// Z src/db/database.types.ts - TablesInsert<"ai_request_logs">
interface AiRequestLogsInsert {
  analysis_id?: string | null;
  created_at?: string;
  error_message?: string | null;
  id?: string;
  model: string;
  status_code: number;
  token_usage: number;
  user_id?: string | null;
}
```

### Nowe typy dla OpenRouter AI

```typescript
// Konfiguracja OpenRouter
interface OpenRouterConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

// Odpowiedź z OpenRouter API
interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    total_tokens: number;
  };
}

// Wynik wywołania AI serwisu
interface AIGenerationResult {
  response: AIResponse;
  tokenUsage: number;
  model: string;
}
```

## 4. Szczegóły odpowiedzi

### Success Response (201 Created)

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": {
      "id": 1,
      "code": "draft"
    },
    "ai_response": {
      "summary": "## Podsumowanie\n\nTen PR dodaje funkcjonalność uwierzytelniania użytkowników...",
      "risks": "## Potencjalne ryzyka\n\n- Brak walidacji tokenu JWT...",
      "tests": "## Sugerowane testy\n\n1. Test logowania z poprawnymi danymi..."
    },
    "created_at": "2026-01-14T12:00:00.000Z"
  }
}
```

### Error Responses

| Status Code | Opis | Przykład Response |
|-------------|------|-------------------|
| 400 | Nieprawidłowe dane wejściowe | `{ "error": "Validation failed", "field_errors": { "pr_name": ["Required"] }, "status_code": 400 }` |
| 401 | Brak autoryzacji | `{ "error": "Unauthorized", "status_code": 401 }` |
| 500 | Błąd serwera / Błąd AI | `{ "error": "AI generation failed", "details": "Service unavailable", "status_code": 500 }` |
| 503 | Serwis AI niedostępny | `{ "error": "AI service unavailable", "details": "OpenRouter timeout", "status_code": 503 }` |

## 5. Przepływ danych

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│   Client    │────▶│  API Route   │────▶│AnalysisService │────▶│  AIService   │────▶│  OpenRouter  │
│             │     │ /api/analysis│     │                 │     │              │     │     API      │
└─────────────┘     └──────────────┘     └─────────────────┘     └──────────────┘     └──────────────┘
       │                   │                      │                      │                    │
       │  POST request     │                      │                      │                    │
       │  + JWT token      │                      │                      │                    │
       │──────────────────▶│                      │                      │                    │
       │                   │                      │                      │                    │
       │                   │  1. Validate JWT     │                      │                    │
       │                   │  (middleware)        │                      │                    │
       │                   │                      │                      │                    │
       │                   │  2. Parse & validate │                      │                    │
       │                   │     request body     │                      │                    │
       │                   │─────────────────────▶│                      │                    │
       │                   │                      │                      │                    │
       │                   │  3. createAnalysis() │                      │                    │
       │                   │─────────────────────▶│                      │                    │
       │                   │                      │                      │                    │
       │                   │                      │  4. INSERT draft     │                    │
       │                   │                      │     (ai_response={}) │                    │
       │                   │                      │─────────────────────▶│ Supabase           │
       │                   │                      │                      │                    │
       │                   │                      │  5. generateAnalysis │                    │
       │                   │                      │─────────────────────▶│                    │
       │                   │                      │                      │  6. POST /chat     │
       │                   │                      │                      │─────────────────────▶
       │                   │                      │                      │                    │
       │                   │                      │                      │  7. AI Response    │
       │                   │                      │                      │◀────────────────────
       │                   │                      │                      │                    │
       │                   │                      │  8. Parse response   │                    │
       │                   │                      │◀─────────────────────│                    │
       │                   │                      │                      │                    │
       │                   │                      │  9. Log to           │                    │
       │                   │                      │     ai_request_logs  │                    │
       │                   │                      │─────────────────────▶│ Supabase           │
       │                   │                      │                      │                    │
       │                   │                      │  10. UPDATE          │                    │
       │                   │                      │      pr_analyses     │                    │
       │                   │                      │─────────────────────▶│ Supabase           │
       │                   │                      │                      │                    │
       │                   │  11. Return result   │                      │                    │
       │                   │◀─────────────────────│                      │                    │
       │                   │                      │                      │                    │
       │  12. 201 Created  │                      │                      │                    │
       │◀──────────────────│                      │                      │                    │
```

### Szczegółowy przepływ:

1. **Middleware** - weryfikuje JWT token i ustawia `supabase` client oraz `user` w `context.locals`
2. **API Route** - parsuje body żądania i wywołuje walidację Zod
3. **Walidacja** - sprawdza wymagane pola i constraint na `diff_content` (max 1000 linii)
4. **AnalysisService.createAnalysis()** - orchestruje cały proces:
   - **4a.** Tworzy draft w bazie z pustym `ai_response = {}`
   - **4b.** Wywołuje `AIService.generateAnalysis()` z diff_content
   - **4c.** Loguje żądanie AI do `ai_request_logs` (sukces lub błąd)
   - **4d.** Aktualizuje `pr_analyses` z wygenerowaną odpowiedzią
5. **Response** - formatuje odpowiedź zgodnie z `CreateAnalysisResponseDTO`

## 6. Względy bezpieczeństwa

### Uwierzytelnianie
- Wymagany JWT token w nagłówku `Authorization: Bearer <token>`
- Token weryfikowany przez Supabase Auth w middleware
- Brak tokenu lub nieprawidłowy token → 401 Unauthorized

### Autoryzacja
- Row Level Security (RLS) w PostgreSQL zapewnia, że użytkownik może tylko tworzyć rekordy ze swoim `user_id`
- `user_id` pobierany jest z sesji auth, nie z request body (zapobiega spoofing)
- Klucz API OpenRouter przechowywany w zmiennych środowiskowych serwera

### Walidacja danych wejściowych
- Wszystkie pola walidowane przez schemat Zod
- Sanityzacja inputów przed zapisem do bazy
- Limity długości zgodne ze schematem bazy danych:
  - `branch_name`: max 255 znaków
  - `ticket_id`: max 255 znaków
  - `diff_content`: max 1000 linii

### Ochrona przed atakami
- **SQL Injection**: Supabase client używa parametryzowanych zapytań
- **XSS**: Dane przechowywane jako surowy tekst, escapowanie przy renderowaniu
- **CSRF**: API bezstanowe, oparte na tokenach JWT
- **Prompt Injection**: Diff content przekazywany do AI jako surowe dane, nie jako instrukcje (prompt na backendzie, formularz musi być walidowany czy zawiera odpowiedni typ danych - git diff)

### Bezpieczeństwo klucza API
- `OPENROUTER_API_KEY` przechowywany wyłącznie w zmiennych środowiskowych
- Nigdy nie eksponowany w response ani logach
- Dostęp tylko po stronie serwera

## 7. Obsługa błędów

### Scenariusze błędów

| Scenariusz | HTTP Status | Error Response | Akcja logowania |
|------------|-------------|----------------|-----------------|
| Brak tokenu JWT | 401 | `{ "error": "Unauthorized", "status_code": 401 }` | - |
| Nieprawidłowy token JWT | 401 | `{ "error": "Unauthorized", "status_code": 401 }` | - |
| Brak wymaganego pola | 400 | `{ "error": "Validation failed", "field_errors": {...}, "status_code": 400 }` | - |
| `diff_content` > 1000 linii | 400 | `{ "error": "Validation failed", "field_errors": { "diff_content": ["..."] }, "status_code": 400 }` | - |
| Błąd tworzenia draftu w DB | 500 | `{ "error": "Failed to create analysis", "status_code": 500 }` | `console.error` |
| OpenRouter API timeout | 503 | `{ "error": "AI service unavailable", "details": "Request timeout", "status_code": 503 }` | `ai_request_logs` z error |
| OpenRouter API error (4xx/5xx) | 500 | `{ "error": "AI generation failed", "details": "...", "status_code": 500 }` | `ai_request_logs` z error |
| Nieprawidłowy format odpowiedzi AI | 500 | `{ "error": "AI response parsing failed", "status_code": 500 }` | `ai_request_logs` z error |
| Błąd aktualizacji analizy | 500 | `{ "error": "Failed to save AI response", "status_code": 500 }` | `console.error` |

### Strategia obsługi błędów AI

Gdy wystąpi błąd AI, analiza **nadal pozostaje zapisana** jako draft z pustym `ai_response`:
1. Draft jest już utworzony w bazie
2. Błąd AI jest logowany do `ai_request_logs` z `error_message`
3. Użytkownik otrzymuje błąd, ale może ponowić generację przez endpoint `/api/analysis/:id/generate`

### Strategia logowania błędów
- Błędy 4xx: logowanie na poziomie `warn` (oczekiwane błędy użytkownika)
- Błędy 5xx: logowanie na poziomie `error` z pełnym stack trace
- Wszystkie żądania AI (sukces i błąd) logowane do `ai_request_logs`
- Nie eksponować szczegółów wewnętrznych błędów w odpowiedziach produkcyjnych

## 8. Rozważania dotyczące wydajności

### Charakterystyka czasowa
- **Żądania AI są wolne**: typowy czas odpowiedzi OpenRouter to 2-15 sekund
- **Timeout**: Ustawić timeout na 60 sekund dla żądań AI
- **Brak cache**: Każde żądanie generuje nową analizę

### Optymalizacje
- **Wczesny INSERT**: Draft zapisywany przed wywołaniem AI (fail-safe)
- **Indeksy**: Tabela `pr_analyses` ma indeks na `user_id` i `created_at`
- **Brak JOIN przy tworzeniu**: Znamy status z góry (id=1, code="draft")

### Potencjalne wąskie gardła
- **OpenRouter API**: Główne wąskie gardło - zależność od zewnętrznego serwisu
- **Duże diffy**: Więcej tokenów = dłuższy czas przetwarzania przez AI
- **Rate limiting OpenRouter**: Może wymagać kolejkowania w przyszłości

### Rekomendacje
- Ustawić timeout na poziomie HTTP (60s) dla tego endpointu
- Rozważyć implementację progress/streaming w przyszłości
- Monitorować zużycie tokenów i koszty
- Rozważyć async processing dla dużych diffów w przyszłej wersji

## 9. Etapy wdrożenia

### Krok 1: Utworzenie struktury katalogów

Utworzyć brakujące katalogi:
```
src/
├── lib/
│   ├── schemas/         # NOWY - schematy walidacji Zod
│   └── services/        # NOWY - serwisy biznesowe
├── pages/
│   └── api/             # NOWY - API routes
│       └── analysis/
```

### Krok 2: Rozszerzenie typów Supabase Client

Zaktualizować `src/db/supabase.client.ts` o eksport typu:

```typescript
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.ts";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

export type SupabaseClientType = SupabaseClient<Database>;
```

### Krok 3: Aktualizacja middleware dla autoryzacji

Zaktualizować `src/middleware/index.ts`:

```typescript
import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../db/database.types.ts";

export const onRequest = defineMiddleware(async (context, next) => {
  const supabaseUrl = import.meta.env.SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.SUPABASE_KEY;
  
  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Extract token from Authorization header
  const authHeader = context.request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { data: { user } } = await supabase.auth.getUser(token);
    context.locals.user = user;
  }

  context.locals.supabase = supabase;
  return next();
});
```

### Krok 4: Utworzenie schematu walidacji Zod

Utworzyć `src/lib/schemas/analysis.schema.ts`:

```typescript
import { z } from "zod";

const MAX_DIFF_LINES = 1000;
const MAX_BRANCH_NAME_LENGTH = 255;
const MAX_TICKET_ID_LENGTH = 255;

/**
 * Liczy liczbę linii w stringu.
 */
function countLines(text: string): number {
  if (!text) return 0;
  return text.split("\n").length;
}

export const createAnalysisSchema = z.object({
  pr_name: z
    .string({ required_error: "PR name is required" })
    .min(1, "PR name cannot be empty"),
  branch_name: z
    .string({ required_error: "Branch name is required" })
    .min(1, "Branch name cannot be empty")
    .max(MAX_BRANCH_NAME_LENGTH, `Branch name must be ${MAX_BRANCH_NAME_LENGTH} characters or less`),
  ticket_id: z
    .string()
    .max(MAX_TICKET_ID_LENGTH, `Ticket ID must be ${MAX_TICKET_ID_LENGTH} characters or less`)
    .optional(),
  diff_content: z
    .string({ required_error: "Diff content is required" })
    .min(1, "Diff content cannot be empty")
    .refine(
      (val) => countLines(val) <= MAX_DIFF_LINES,
      `Diff content exceeds ${MAX_DIFF_LINES} lines limit`
    ),
});

export type CreateAnalysisInput = z.infer<typeof createAnalysisSchema>;
```

### Krok 5: Utworzenie serwisu AI (OpenRouter)

Utworzyć `src/lib/services/openrouter.service.ts`:

```typescript
import type { AIResponse } from "../../types";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const REQUEST_TIMEOUT_MS = 60000; // 60 seconds

interface OpenRouterChatResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export interface AIGenerationResult {
  response: AIResponse;
  tokenUsage: number;
  model: string;
  statusCode: number;
}

export interface AIGenerationError {
  message: string;
  statusCode: number;
  tokenUsage: number;
  model: string;
}

const SYSTEM_PROMPT = `You are an expert code reviewer. Analyze the provided git diff and generate a comprehensive PR description.

Your response MUST be a valid JSON object with exactly these three fields:
- "summary": A markdown-formatted summary of what changes were made and why
- "risks": A markdown-formatted list of potential risks, breaking changes, or concerns
- "tests": A markdown-formatted list of suggested tests to verify the changes

Be concise but thorough. Focus on the most important aspects of the changes.`;

function buildUserPrompt(diffContent: string, prName: string, branchName: string, ticketId?: string): string {
  let prompt = `Please analyze this PR and generate a description.

PR Name: ${prName}
Branch: ${branchName}`;

  if (ticketId) {
    prompt += `\nTicket: ${ticketId}`;
  }

  prompt += `\n\nGit Diff:\n\`\`\`diff\n${diffContent}\n\`\`\``;

  return prompt;
}

function parseAIResponse(content: string): AIResponse {
  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(content);
    if (
      typeof parsed.summary === "string" &&
      typeof parsed.risks === "string" &&
      typeof parsed.tests === "string"
    ) {
      return parsed as AIResponse;
    }
  } catch {
    // If JSON parsing fails, try to extract from markdown code block
    const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      if (
        typeof parsed.summary === "string" &&
        typeof parsed.risks === "string" &&
        typeof parsed.tests === "string"
      ) {
        return parsed as AIResponse;
      }
    }
  }

  throw new Error("Failed to parse AI response: invalid format");
}

export class OpenRouterService {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    if (!apiKey) {
      throw new Error("OpenRouter API key is required");
    }
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateAnalysis(
    diffContent: string,
    prName: string,
    branchName: string,
    ticketId?: string
  ): Promise<AIGenerationResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "HTTP-Referer": import.meta.env.SITE_URL || "http://localhost:4321",
          "X-Title": "PR Diff Explainer",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(diffContent, prName, branchName, ticketId) },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw {
          message: `OpenRouter API error: ${response.status} ${response.statusText}`,
          statusCode: response.status,
          tokenUsage: 0,
          model: this.model,
          details: errorText,
        } as AIGenerationError;
      }

      const data = (await response.json()) as OpenRouterChatResponse;
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw {
          message: "Empty response from AI",
          statusCode: 500,
          tokenUsage: data.usage?.total_tokens || 0,
          model: this.model,
        } as AIGenerationError;
      }

      const aiResponse = parseAIResponse(content);

      return {
        response: aiResponse,
        tokenUsage: data.usage?.total_tokens || 0,
        model: this.model,
        statusCode: 200,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw {
          message: "AI request timeout",
          statusCode: 504,
          tokenUsage: 0,
          model: this.model,
        } as AIGenerationError;
      }

      // Re-throw AIGenerationError as-is
      if ((error as AIGenerationError).statusCode) {
        throw error;
      }

      throw {
        message: error instanceof Error ? error.message : "Unknown AI error",
        statusCode: 500,
        tokenUsage: 0,
        model: this.model,
      } as AIGenerationError;
    }
  }
}
```

### Krok 6: Utworzenie serwisu analizy

Utworzyć `src/lib/services/analysis.service.ts`:

```typescript
import type { SupabaseClientType } from "../../db/supabase.client";
import type { 
  CreateAnalysisCommand, 
  CreateAnalysisResponseDTO, 
  StatusDTO,
  AIResponse 
} from "../../types";
import { OpenRouterService, type AIGenerationError } from "./openrouter.service";

// Stały status dla draftu
const DRAFT_STATUS: StatusDTO = { id: 1, code: "draft" };

export class AnalysisService {
  private readonly openRouterService: OpenRouterService;

  constructor(
    private readonly supabase: SupabaseClientType,
    openRouterApiKey: string
  ) {
    this.openRouterService = new OpenRouterService(openRouterApiKey);
  }

  /**
   * Tworzy nową analizę, generuje opis przez AI i zwraca kompletny wynik.
   */
  async createAnalysis(
    command: CreateAnalysisCommand,
    userId: string
  ): Promise<CreateAnalysisResponseDTO> {
    // 1. Utwórz draft z pustym ai_response
    const { data: draft, error: insertError } = await this.supabase
      .from("pr_analyses")
      .insert({
        pr_name: command.pr_name,
        branch_name: command.branch_name,
        ticket_id: command.ticket_id ?? null,
        diff_content: command.diff_content,
        user_id: userId,
        status_id: DRAFT_STATUS.id,
        ai_response: {}, // Empty placeholder
      })
      .select("id, created_at")
      .single();

    if (insertError || !draft) {
      throw new Error(`Failed to create analysis draft: ${insertError?.message}`);
    }

    // 2. Generuj analizę przez AI
    let aiResponse: AIResponse;
    try {
      const result = await this.openRouterService.generateAnalysis(
        command.diff_content,
        command.pr_name,
        command.branch_name,
        command.ticket_id
      );

      aiResponse = result.response;

      // 3a. Loguj sukces do ai_request_logs
      await this.logAIRequest({
        analysisId: draft.id,
        userId,
        model: result.model,
        tokenUsage: result.tokenUsage,
        statusCode: result.statusCode,
        errorMessage: null,
      });

      // 4. Zaktualizuj analizę z odpowiedzią AI
      const { error: updateError } = await this.supabase
        .from("pr_analyses")
        .update({ ai_response: aiResponse })
        .eq("id", draft.id);

      if (updateError) {
        console.error("Failed to update analysis with AI response:", updateError);
        // Nie rzucamy błędu - analiza została utworzona, tylko update nie powiódł się
      }
    } catch (error) {
      const aiError = error as AIGenerationError;

      // 3b. Loguj błąd do ai_request_logs
      await this.logAIRequest({
        analysisId: draft.id,
        userId,
        model: aiError.model || "unknown",
        tokenUsage: aiError.tokenUsage || 0,
        statusCode: aiError.statusCode || 500,
        errorMessage: aiError.message,
      });

      // Re-throw z kontekstem
      throw new Error(`AI generation failed: ${aiError.message}`);
    }

    // 5. Zwróć odpowiedź
    return {
      data: {
        id: draft.id,
        status: DRAFT_STATUS,
        ai_response: aiResponse,
        created_at: draft.created_at,
      },
    };
  }

  /**
   * Loguje żądanie AI do tabeli ai_request_logs.
   */
  private async logAIRequest(params: {
    analysisId: string;
    userId: string;
    model: string;
    tokenUsage: number;
    statusCode: number;
    errorMessage: string | null;
  }): Promise<void> {
    const { error } = await this.supabase.from("ai_request_logs").insert({
      analysis_id: params.analysisId,
      user_id: params.userId,
      model: params.model,
      token_usage: params.tokenUsage,
      status_code: params.statusCode,
      error_message: params.errorMessage,
    });

    if (error) {
      // Log but don't throw - logging failure shouldn't break the main flow
      console.error("Failed to log AI request:", error);
    }
  }
}
```

### Krok 7: Utworzenie API route

Utworzyć `src/pages/api/analysis/index.ts`:

```typescript
import type { APIRoute } from "astro";
import { AnalysisService } from "../../../lib/services/analysis.service";
import { createAnalysisSchema } from "../../../lib/schemas/analysis.schema";
import type { CreateAnalysisCommand, APIErrorResponse, ValidationErrorResponse } from "../../../types";

export const prerender = false;

export const POST: APIRoute = async ({ locals, request }) => {
  try {
    // 1. Sprawdź autoryzację
    const user = locals.user;
    if (!user) {
      const errorResponse: APIErrorResponse = {
        error: "Unauthorized",
        status_code: 401,
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Parsuj body żądania
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      const errorResponse: APIErrorResponse = {
        error: "Invalid JSON body",
        status_code: 400,
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Waliduj dane wejściowe
    const validationResult = createAnalysisSchema.safeParse(body);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of validationResult.error.issues) {
        const field = issue.path.join(".");
        if (!fieldErrors[field]) {
          fieldErrors[field] = [];
        }
        fieldErrors[field].push(issue.message);
      }

      const errorResponse: ValidationErrorResponse = {
        error: "Validation failed",
        field_errors: fieldErrors,
        status_code: 400,
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 4. Sprawdź klucz API OpenRouter
    const openRouterApiKey = import.meta.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      console.error("OPENROUTER_API_KEY is not configured");
      const errorResponse: APIErrorResponse = {
        error: "AI service not configured",
        status_code: 503,
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 5. Wywołaj serwis
    const command: CreateAnalysisCommand = validationResult.data;
    const analysisService = new AnalysisService(locals.supabase, openRouterApiKey);
    const result = await analysisService.createAnalysis(command, user.id);

    // 6. Zwróć sukces
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating analysis:", error);

    // Determine appropriate status code based on error
    let statusCode = 500;
    let errorMessage = "Internal server error";

    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        statusCode = 504;
        errorMessage = "AI service timeout";
      } else if (error.message.includes("AI generation failed")) {
        statusCode = 502;
        errorMessage = "AI generation failed";
      }
    }

    const errorResponse: APIErrorResponse = {
      error: errorMessage,
      details: error instanceof Error ? error.message : "Unknown error",
      status_code: statusCode,
    };
    return new Response(JSON.stringify(errorResponse), {
      status: statusCode,
      headers: { "Content-Type": "application/json" },
    });
  }
};
```

### Krok 8: Aktualizacja typów dla Astro locals

Zaktualizować `src/env.d.ts`:

```typescript
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "./db/database.types";

declare namespace App {
  interface Locals {
    supabase: SupabaseClient<Database>;
    user: User | null;
  }
}
```

### Krok 9: Konfiguracja zmiennych środowiskowych

Dodać do `.env`:

```env
# Supabase
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-anon-key

# OpenRouter AI
OPENROUTER_API_KEY=your-openrouter-api-key

# Optional: Site URL for OpenRouter referer header
SITE_URL=http://localhost:4321
```

### Krok 10: Instalacja zależności

```bash
npm install zod
```

### Krok 11: Testowanie endpointu

Przykładowe żądanie cURL:

```bash
curl -X POST http://localhost:4321/api/analysis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "pr_name": "feat: add user authentication",
    "branch_name": "feature/user-auth",
    "ticket_id": "PROJ-123",
    "diff_content": "diff --git a/src/auth.ts b/src/auth.ts\n+export const auth = () => {};"
  }'
```

Oczekiwana odpowiedź (201):

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": { "id": 1, "code": "draft" },
    "ai_response": {
      "summary": "## Podsumowanie\n\nDodano nową funkcję uwierzytelniania...",
      "risks": "## Potencjalne ryzyka\n\n- Funkcja jest pusta...",
      "tests": "## Sugerowane testy\n\n1. Test eksportu funkcji auth..."
    },
    "created_at": "2026-01-14T12:00:00.000Z"
  }
}
```

### Krok 12: Weryfikacja

Checklist weryfikacyjna:
- [ ] Endpoint zwraca 201 dla poprawnego żądania z ai_response
- [ ] Endpoint zwraca 401 bez tokenu autoryzacji
- [ ] Endpoint zwraca 400 dla brakujących wymaganych pól
- [ ] Endpoint zwraca 400 gdy diff_content przekracza 1000 linii
- [ ] Endpoint zwraca 503 gdy brak OPENROUTER_API_KEY
- [ ] Rekord jest poprawnie zapisywany w `pr_analyses`
- [ ] `status_id` jest ustawione na 1 (draft)
- [ ] `ai_response` zawiera wygenerowaną analizę
- [ ] `user_id` jest poprawnie przypisany z sesji
- [ ] Żądanie AI jest logowane do `ai_request_logs` (sukces)
- [ ] Błędy AI są logowane do `ai_request_logs` (error)
- [ ] RLS działa poprawnie

## 10. Struktura plików

Po implementacji struktura katalogów powinna wyglądać następująco:

```
src/
├── db/
│   ├── database.types.ts
│   └── supabase.client.ts      # Zaktualizowany o typ eksport
├── env.d.ts                     # Zaktualizowany o Locals
├── lib/
│   ├── schemas/
│   │   └── analysis.schema.ts  # NOWY
│   ├── services/
│   │   ├── analysis.service.ts # NOWY
│   │   └── openrouter.service.ts # NOWY
│   └── utils.ts
├── middleware/
│   └── index.ts                 # Zaktualizowany
├── pages/
│   ├── api/
│   │   └── analysis/
│   │       └── index.ts        # NOWY
│   └── index.astro
└── types.ts                     # Zaktualizowany (CreateAnalysisResponseDTO)
```
