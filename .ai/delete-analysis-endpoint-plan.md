# API Endpoint Implementation Plan: DELETE /api/analysis

## 1. Przegląd punktu końcowego

Endpoint służy do trwałego usuwania jednej lub wielu analiz PR w jednym żądaniu. Umożliwia użytkownikowi zarządzanie historią swoich analiz poprzez masowe usuwanie niepotrzebnych rekordów. Operacja jest nieodwracalna, ale powiązane logi AI (`ai_request_logs`) zostają zachowane z `analysis_id` ustawionym na `NULL`.

Zabezpieczenia:
- Wymagana autoryzacja (Bearer token)
- RLS automatycznie ogranicza operację do analiz należących do zalogowanego użytkownika
- Limit maksymalnej liczby IDs w jednym żądaniu

## 2. Szczegóły żądania

- **Metoda HTTP:** DELETE
- **Struktura URL:** `/api/analysis`
- **Nagłówki:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>` (wymagany)

### Parametry

**Wymagane:**
| Parametr | Typ | Opis |
|----------|-----|------|
| `ids` | `string[]` | Tablica UUID analiz do usunięcia. Min 1, max 100 elementów. |

**Opcjonalne:**
Brak

### Request Body

```json
{
  "ids": ["550e8400-e29b-41d4-a716-446655440000", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"]
}
```

## 3. Wykorzystywane typy

### Command Model (Request)

Istniejący typ w `src/types.ts`:

```typescript
/**
 * Command model do usuwania wielu analiz.
 * Używany w DELETE /api/analysis.
 */
export interface DeleteAnalysesCommand {
  /** Lista UUID analiz do usunięcia */
  ids: AnalysisEntity["id"][];
}
```

### Response DTO

Istniejący typ w `src/types.ts`:

```typescript
/**
 * DTO odpowiedzi po usunięciu analiz.
 * Zwracane przez DELETE /api/analysis.
 */
export interface DeleteAnalysesResponseDTO {
  /** Liczba usuniętych analiz */
  deleted_count: number;
}
```

### Schemat walidacji Zod

Nowy schemat do dodania w `src/lib/schemas/analysis.schema.ts`:

```typescript
/**
 * Schemat walidacji dla usuwania analiz.
 * 
 * Waliduje:
 * - ids: niepusta tablica UUID, max 100 elementów
 */
export const deleteAnalysesSchema = z.object({
  ids: z
    .array(z.string().uuid("Each ID must be a valid UUID"))
    .min(1, "At least one analysis ID is required")
    .max(100, "Cannot delete more than 100 analyses at once"),
});

export type DeleteAnalysesInput = z.infer<typeof deleteAnalysesSchema>;
```

## 4. Szczegóły odpowiedzi

### Sukces (200 OK)

```json
{
  "deleted_count": 2
}
```

**Uwaga:** `deleted_count` może być mniejszy niż liczba przekazanych IDs, jeśli:
- Niektóre ID nie istnieją
- Niektóre analizy nie należą do użytkownika (RLS blokuje)

### Błędy

| Kod | Scenariusz | Przykładowa odpowiedź |
|-----|------------|----------------------|
| 400 | Nieprawidłowy JSON | `{"error": "Invalid JSON body", "status_code": 400}` |
| 400 | Błąd walidacji | `{"error": "Validation failed", "field_errors": {"ids": ["At least one analysis ID is required"]}, "status_code": 400}` |
| 401 | Brak autoryzacji | `{"error": "Unauthorized", "status_code": 401}` |
| 500 | Błąd bazy danych | `{"error": "Internal server error", "details": "...", "status_code": 500}` |

## 5. Przepływ danych

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DELETE /api/analysis                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Sprawdź autoryzację (locals.user)                                        │
│    └─ Brak użytkownika → 401 Unauthorized                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. Parsuj body żądania (request.json())                                     │
│    └─ Błąd parsowania → 400 Invalid JSON                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. Waliduj dane wejściowe (deleteAnalysesSchema.safeParse)                  │
│    └─ Błąd walidacji → 400 Validation failed + field_errors                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. Wywołaj AnalysisService.deleteAnalyses(ids)                              │
│    ├─ DELETE FROM pr_analyses WHERE id IN (...) z RLS                       │
│    └─ Błąd Supabase → 500 Internal server error                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. Zwróć odpowiedź sukcesu                                                  │
│    { "deleted_count": N }                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Interakcja z bazą danych

1. **Tabela `pr_analyses`:**
   - Wykonanie DELETE z filtrem `id IN (...)` 
   - RLS automatycznie dodaje warunek `user_id = auth.uid()`
   - Supabase zwraca liczbę usuniętych rekordów

2. **Tabela `ai_request_logs`:**
   - Trigger `ON DELETE SET NULL` automatycznie ustawia `analysis_id = NULL`
   - Logi zostają zachowane do audytu

## 6. Względy bezpieczeństwa

### Autoryzacja

- Endpoint wymaga prawidłowego tokenu JWT w nagłówku `Authorization: Bearer <token>`
- Token jest weryfikowany przez middleware Astro
- Brak tokenu lub nieprawidłowy token → 401 Unauthorized

### Row Level Security (RLS)

- Polityka RLS na `pr_analyses`: `auth.uid() = user_id`
- Użytkownik może usunąć tylko własne analizy
- Próba usunięcia cudzej analizy jest ignorowana (nie powoduje błędu, ale nie usuwa rekordu)

### Ochrona przed nadużyciami

- **Limit ilości:** Maksymalnie 100 IDs w jednym żądaniu
- **Walidacja UUID:** Każdy ID musi być prawidłowym formatem UUID
- **Idempotentność:** Wielokrotne wywołanie z tymi samymi IDs nie powoduje błędu

### Walidacja danych wejściowych

- Schemat Zod weryfikuje format i ograniczenia
- Nieprawidłowe dane → 400 Bad Request z szczegółami

## 7. Obsługa błędów

| Scenariusz | Kod HTTP | Typ błędu | Obsługa |
|------------|----------|-----------|---------|
| Brak tokenu autoryzacji | 401 | `APIErrorResponse` | Zwróć `{"error": "Unauthorized"}` |
| Nieprawidłowy JSON body | 400 | `APIErrorResponse` | Zwróć `{"error": "Invalid JSON body"}` |
| Pusta tablica `ids` | 400 | `ValidationErrorResponse` | Zwróć szczegóły walidacji |
| Nieprawidłowy format UUID | 400 | `ValidationErrorResponse` | Zwróć szczegóły walidacji |
| Za dużo IDs (>100) | 400 | `ValidationErrorResponse` | Zwróć szczegóły walidacji |
| Błąd połączenia z Supabase | 500 | `APIErrorResponse` | Zaloguj błąd, zwróć ogólny komunikat |
| IDs nie istnieją / nie należą do użytkownika | 200 | - | `deleted_count = 0` (nie jest to błąd) |

### Logowanie błędów

- Błędy serwera (500) są logowane do konsoli z kontekstem: `[DELETE /api/analysis] Error: ...`
- Błędy klienta (400, 401) nie wymagają logowania po stronie serwera

## 8. Rozważania dotyczące wydajności

### Optymalizacje

1. **Batch delete:** Użycie `DELETE ... WHERE id IN (...)` zamiast wielu pojedynczych zapytań
2. **Limit rozmiaru:** Max 100 IDs zapobiega nadmiernemu obciążeniu
3. **Brak dodatkowych zapytań:** Nie pobieramy danych przed usunięciem

### Indeksy

- Kolumna `id` jest PRIMARY KEY → automatyczny indeks B-tree
- Zapytanie DELETE jest zoptymalizowane

### Transakcyjność

- Pojedyncze zapytanie DELETE jest atomowe
- Wszystkie rekordy są usuwane w jednej transakcji
- Trigger SET NULL na `ai_request_logs` wykonuje się w tej samej transakcji

## 9. Etapy wdrożenia

### Krok 1: Dodanie schematu walidacji Zod

**Plik:** `src/lib/schemas/analysis.schema.ts`

Dodaj na końcu pliku:

```typescript
/**
 * Maksymalna liczba analiz do usunięcia w jednym żądaniu.
 */
const MAX_DELETE_IDS = 100;

/**
 * Schemat walidacji dla usuwania analiz.
 *
 * Waliduje:
 * - ids: niepusta tablica UUID, max 100 elementów
 */
export const deleteAnalysesSchema = z.object({
  ids: z
    .array(z.string().uuid("Each ID must be a valid UUID"))
    .min(1, "At least one analysis ID is required")
    .max(MAX_DELETE_IDS, `Cannot delete more than ${MAX_DELETE_IDS} analyses at once`),
});

/**
 * Typ wejściowy dla usuwania analiz, wynikający ze schematu Zod.
 */
export type DeleteAnalysesInput = z.infer<typeof deleteAnalysesSchema>;
```

Dodaj `MAX_DELETE_IDS` do eksportowanych stałych:

```typescript
export const VALIDATION_LIMITS = {
  MAX_DIFF_LINES,
  MAX_BRANCH_NAME_LENGTH,
  MAX_TICKET_ID_LENGTH,
  MAX_DELETE_IDS,
} as const;
```

### Krok 2: Rozszerzenie AnalysisService

**Plik:** `src/lib/services/analysis.service.ts`

Dodaj import typu:

```typescript
import type {
  // ... istniejące importy
  DeleteAnalysesResponseDTO,
} from "../../types";
```

Dodaj metodę do klasy `AnalysisService`:

```typescript
/**
 * Usuwa wiele analiz na podstawie listy ID.
 *
 * Proces:
 * 1. Wykonuje batch DELETE z filtrem po ID
 * 2. RLS automatycznie ogranicza do analiz użytkownika
 * 3. Zwraca liczbę faktycznie usuniętych rekordów
 *
 * @param ids - Lista UUID analiz do usunięcia
 * @returns Obiekt z liczbą usuniętych analiz
 * @throws Error gdy operacja bazy danych się nie powiedzie
 *
 * @remarks
 * - IDs które nie istnieją lub nie należą do użytkownika są ignorowane
 * - Powiązane logi AI otrzymują analysis_id = NULL (trigger DB)
 */
async deleteAnalyses(ids: string[]): Promise<DeleteAnalysesResponseDTO> {
  const { data, error } = await this.supabase
    .from("pr_analyses")
    .delete()
    .in("id", ids)
    .select("id");

  if (error) {
    throw new Error(`Failed to delete analyses: ${error.message}`);
  }

  return {
    deleted_count: data?.length ?? 0,
  };
}
```

### Krok 3: Implementacja handlera DELETE

**Plik:** `src/pages/api/analysis/index.ts`

Dodaj importy:

```typescript
import { deleteAnalysesSchema } from "../../../lib/schemas/analysis.schema";
import type { DeleteAnalysesCommand } from "../../../types";
```

Dodaj handler DELETE:

```typescript
/**
 * DELETE /api/analysis
 *
 * Trwale usuwa jedną lub więcej analiz PR.
 *
 * Wymaga autoryzacji: Bearer token w nagłówku Authorization.
 *
 * @returns 200 - Analizy usunięte pomyślnie
 * @returns 400 - Błąd walidacji danych wejściowych
 * @returns 401 - Brak autoryzacji
 * @returns 500 - Błąd serwera
 */
export const DELETE: APIRoute = async ({ locals, request }) => {
  try {
    // 1. Sprawdź autoryzację
    const user = locals.user;
    if (!user) {
      return createErrorResponse({ error: "Unauthorized", status_code: 401 }, 401);
    }

    // 2. Parsuj body żądania
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse({ error: "Invalid JSON body", status_code: 400 }, 400);
    }

    // 3. Waliduj dane wejściowe
    const validationResult = deleteAnalysesSchema.safeParse(body);
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

    // 4. Wywołaj serwis
    const command: DeleteAnalysesCommand = validationResult.data;
    const analysisService = new AnalysisService(locals.supabase, "");
    const result = await analysisService.deleteAnalyses(command.ids);

    // 5. Zwróć sukces
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[DELETE /api/analysis] Error deleting analyses:", error);

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
```

### Krok 4: Testy manualne

Po wdrożeniu przetestuj następujące scenariusze:

1. **Sukces - usunięcie pojedynczej analizy:**
   ```bash
   curl -X DELETE http://localhost:4321/api/analysis \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"ids": ["<valid-uuid>"]}'
   ```

2. **Sukces - usunięcie wielu analiz:**
   ```bash
   curl -X DELETE http://localhost:4321/api/analysis \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"ids": ["<uuid-1>", "<uuid-2>"]}'
   ```

3. **Błąd - brak autoryzacji:**
   ```bash
   curl -X DELETE http://localhost:4321/api/analysis \
     -H "Content-Type: application/json" \
     -d '{"ids": ["<valid-uuid>"]}'
   # Oczekiwany: 401
   ```

4. **Błąd - pusta tablica:**
   ```bash
   curl -X DELETE http://localhost:4321/api/analysis \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"ids": []}'
   # Oczekiwany: 400 z field_errors
   ```

5. **Błąd - nieprawidłowy UUID:**
   ```bash
   curl -X DELETE http://localhost:4321/api/analysis \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"ids": ["not-a-uuid"]}'
   # Oczekiwany: 400 z field_errors
   ```

6. **Edge case - nieistniejące ID:**
   ```bash
   curl -X DELETE http://localhost:4321/api/analysis \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"ids": ["00000000-0000-0000-0000-000000000000"]}'
   # Oczekiwany: 200 z deleted_count: 0
   ```

### Krok 5: Weryfikacja logów AI

Po usunięciu analizy sprawdź w bazie danych:

```sql
-- Sprawdź czy logi AI mają analysis_id = NULL
SELECT * FROM ai_request_logs 
WHERE analysis_id IS NULL 
ORDER BY created_at DESC 
LIMIT 10;
```

### Checklist końcowy

- [ ] Schemat walidacji `deleteAnalysesSchema` dodany do `analysis.schema.ts`
- [ ] Metoda `deleteAnalyses` dodana do `AnalysisService`
- [ ] Handler `DELETE` dodany do `src/pages/api/analysis/index.ts`
- [ ] Import `DeleteAnalysesCommand` i `deleteAnalysesSchema` dodane
- [ ] Helper functions `createErrorResponse` i `createValidationErrorResponse` dostępne (już istnieją)
- [ ] Testy manualne wykonane dla wszystkich scenariuszy
- [ ] Logi AI sprawdzone pod kątem poprawnego SET NULL
