# API Analysis - Przykłady testowe

---

## GET /api/analysis/all - Lista analiz

Pobiera paginowaną listę analiz PR dla zalogowanego użytkownika.

### Query Parameters

| Parametr | Typ | Wymagany | Domyślna wartość | Opis |
|----------|-----|----------|------------------|------|
| `page` | number | Nie | 1 | Numer strony (min: 1) |
| `limit` | number | Nie | 10 | Liczba elementów na stronie (min: 1, max: 100) |
| `status_id` | number | Nie | - | Filtrowanie po ID statusu |
| `search` | string | Nie | - | Unified search - przeszukuje jednocześnie `pr_name` i `branch_name` (case-insensitive, max: 255 znaków) |
| `sort_field` | string | Nie | 'created_at' | Pole sortowania: 'created_at', 'pr_name' lub 'branch_name' |
| `sort_order` | string | Nie | 'desc' | Kierunek sortowania: 'asc' lub 'desc' |

### Przykładowe żądania cURL

#### 1. Podstawowe zapytanie (domyślne wartości)

```bash
curl -X GET "http://localhost:3001/api/analysis/all" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 2. Z paginacją

```bash
curl -X GET "http://localhost:3001/api/analysis/all?page=2&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 3. Z filtrowaniem po statusie i unified search

```bash
curl -X GET "http://localhost:3001/api/analysis/all?status_id=1&search=feature" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 4. Sortowanie po nazwie PR rosnąco

```bash
curl -X GET "http://localhost:3001/api/analysis/all?sort_field=pr_name&sort_order=asc" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 5. Kombinacja wszystkich parametrów

```bash
curl -X GET "http://localhost:3001/api/analysis/all?page=1&limit=25&status_id=2&search=auth&sort_field=created_at&sort_order=desc" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Przykładowa odpowiedź sukcesu (200 OK)

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

### Błąd walidacji (400 Bad Request)

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

---

# POST /api/analysis - Przykłady testowe

## Wymagania

- Serwer uruchomiony na `http://localhost:4321`
- Prawidłowy JWT token z Supabase Auth
- Skonfigurowana zmienna `OPENROUTER_API_KEY` (może być dowolna wartość dla mock)

## Przykładowe żądania cURL

### 1. Poprawne żądanie (201 Created)

```bash
curl -X POST http://localhost:4321/api/analysis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "pr_name": "feat: add user authentication",
    "branch_name": "feature/user-auth",
    "ticket_id": "PROJ-123",
    "diff_content": "diff --git a/src/auth.ts b/src/auth.ts\nindex 1234567..abcdefg 100644\n--- a/src/auth.ts\n+++ b/src/auth.ts\n@@ -1,3 +1,5 @@\n+import { createClient } from \"@supabase/supabase-js\";\n+\n export const auth = () => {\n   return true;\n };"
  }'
```

### 2. Brak autoryzacji (401 Unauthorized)

```bash
curl -X POST http://localhost:4321/api/analysis \
  -H "Content-Type: application/json" \
  -d '{
    "pr_name": "test",
    "branch_name": "test",
    "diff_content": "diff --git a/test.ts b/test.ts\n--- a/test.ts\n+++ b/test.ts\n@@ -1 +1 @@\n-old\n+new"
  }'
```

Oczekiwana odpowiedź:
```json
{
  "error": "Unauthorized",
  "status_code": 401
}
```

### 3. Błąd walidacji - brak wymaganego pola (400 Bad Request)

```bash
curl -X POST http://localhost:4321/api/analysis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "pr_name": "test"
  }'
```

Oczekiwana odpowiedź:
```json
{
  "error": "Validation failed",
  "field_errors": {
    "branch_name": ["Branch name is required"],
    "diff_content": ["Diff content is required"]
  },
  "status_code": 400
}
```

### 4. Błąd walidacji - nieprawidłowy format diff (400 Bad Request)

```bash
curl -X POST http://localhost:4321/api/analysis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "pr_name": "test",
    "branch_name": "test-branch",
    "diff_content": "To nie jest prawidłowy git diff!"
  }'
```

Oczekiwana odpowiedź:
```json
{
  "error": "Validation failed",
  "field_errors": {
    "diff_content": ["Invalid git diff format. Content must be a valid unified diff with diff headers and hunk markers (@@...@@)"]
  },
  "status_code": 400
}
```

### 5. Symulacja błędu 500 (Internal Server Error)

Użyj słowa kluczowego `MOCK_ERROR_500` w nazwie PR:

```bash
curl -X POST http://localhost:4321/api/analysis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "pr_name": "test MOCK_ERROR_500",
    "branch_name": "test-branch",
    "diff_content": "diff --git a/test.ts b/test.ts\n--- a/test.ts\n+++ b/test.ts\n@@ -1 +1 @@\n-old\n+new"
  }'
```

Oczekiwana odpowiedź:
```json
{
  "error": "AI generation failed",
  "details": "AI generation failed: Internal server error from AI provider",
  "status_code": 502
}
```

### 6. Symulacja błędu 503 (Service Unavailable)

```bash
curl -X POST http://localhost:4321/api/analysis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "pr_name": "test MOCK_ERROR_503",
    "branch_name": "test-branch",
    "diff_content": "diff --git a/test.ts b/test.ts\n--- a/test.ts\n+++ b/test.ts\n@@ -1 +1 @@\n-old\n+new"
  }'
```

### 7. Symulacja timeout (504 Gateway Timeout)

```bash
curl -X POST http://localhost:4321/api/analysis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "pr_name": "test MOCK_ERROR_TIMEOUT",
    "branch_name": "test-branch",
    "diff_content": "diff --git a/test.ts b/test.ts\n--- a/test.ts\n+++ b/test.ts\n@@ -1 +1 @@\n-old\n+new"
  }'
```

### 8. Symulacja rate limit (429 Too Many Requests)

```bash
curl -X POST http://localhost:4321/api/analysis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "pr_name": "test MOCK_ERROR_429",
    "branch_name": "test-branch",
    "diff_content": "diff --git a/test.ts b/test.ts\n--- a/test.ts\n+++ b/test.ts\n@@ -1 +1 @@\n-old\n+new"
  }'
```

## Słowa kluczowe symulacji błędów

| Słowo kluczowe | Symulowany błąd |
|----------------|-----------------|
| `MOCK_ERROR_500` | 500 Internal Server Error |
| `MOCK_ERROR_503` | 503 Service Unavailable |
| `MOCK_ERROR_TIMEOUT` | 504 Gateway Timeout |
| `MOCK_ERROR_429` | 429 Too Many Requests |

Słowo kluczowe może być umieszczone w:
- Nazwie PR (`pr_name`)
- Nazwie brancha (`branch_name`)
- Zawartości diffa (`diff_content`)
