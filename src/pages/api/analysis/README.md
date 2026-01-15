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
