# Plan schematu bazy danych (MVP)

Poniższy dokument przedstawia szczegółowy schemat bazy danych dla projektu PR/Diff Explainer, opracowany na podstawie wymagań PRD i decyzji podjętych podczas sesji planowania.

## 1. Lista tabel

### 1.1 `analysis_statuses`
Słownik statusów jakości analizy.

| Kolumna | Typ Danych | Ograniczenia (Constraints) | Opis |
| :--- | :--- | :--- | :--- |
| `id` | `SMALLINT` | `PRIMARY KEY` | Identyfikator statusu. |
| `code` | `VARCHAR(50)` | `NOT NULL`, `UNIQUE` | Kod statusu (np. 'draft', 'accepted'). |

### 1.2 `pr_analyses`
Główna tabela przechowująca analizy diffów.

| Kolumna | Typ Danych | Ograniczenia (Constraints) | Opis |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Unikalny identyfikator analizy. |
| `user_id` | `UUID` | `NOT NULL`, `REFERENCES auth.users(id)` | Właściciel analizy (klucz obcy do Supabase Auth). |
| `status_id` | `SMALLINT` | `NOT NULL`, `REFERENCES analysis_statuses(id)` | Status analizy. Domyślnie ustawiany na ID odpowiadające 'draft'. |
| `pr_name` | `TEXT` | `NOT NULL` | Nazwa Pull Requesta. |
| `branch_name` | `VARCHAR(255)` | `NOT NULL` | Nazwa brancha. |
| `ticket_id` | `VARCHAR(255)` | `NULL` | Opcjonalny identyfikator zgłoszenia (np. z Jiry). |
| `diff_content` | `TEXT` | `NOT NULL` | Surowa treść diffa (limit 1000 linii walidowany w aplikacji). |
| `ai_response` | `JSON` | `NOT NULL` | Odpowiedź AI: streszczenie, ryzyka, testy. Typ JSON (nie JSONB) dla czytelności tekstu. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT now()` | Data utworzenia. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT now()` | Data ostatniej aktualizacji. |

### 1.3 `ai_request_logs`
Logi telemetryczne zapytań do AI.

| Kolumna | Typ Danych | Ograniczenia (Constraints) | Opis |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Unikalny identyfikator logu. |
| `user_id` | `UUID` | `NULL`, `REFERENCES auth.users(id)` | Użytkownik wykonujący zapytanie (do audytu kosztów). |
| `analysis_id` | `UUID` | `NULL`, `REFERENCES pr_analyses(id)` | Powiązana analiza. Może być NULL po usunięciu analizy. |
| `model` | `VARCHAR(100)` | `NOT NULL` | Nazwa użytego modelu AI (np. 'gpt-4o'). |
| `token_usage` | `INTEGER` | `NOT NULL` | Liczba zużytych tokenów (input + output). |
| `status_code` | `SMALLINT` | `NOT NULL` | Kod statusu HTTP odpowiedzi AI (np. 200, 400). |
| `error_message` | `TEXT` | `NULL` | Treść błędu (jeśli istnieje). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT now()` | Data wykonania zapytania. |

---

## 2. Relacje między tabelami

1.  **`pr_analyses` -> `auth.users`**
    *   Typ: Wiele-do-jednego (Many-to-One).
    *   Zachowanie: `ON DELETE CASCADE` (gdy użytkownik zostanie usunięty, jego analizy również - standardowe zachowanie Supabase Auth).

2.  **`pr_analyses` -> `analysis_statuses`**
    *   Typ: Wiele-do-jednego (Many-to-One).
    *   Zachowanie: `ON DELETE RESTRICT` (nie można usunąć statusu, jeśli jest używany przez analizy).

3.  **`ai_request_logs` -> `auth.users`**
    *   Typ: Wiele-do-jednego (Many-to-One).
    *   Cel: Audyt kosztów per użytkownik.
    *   Zachowanie: 'ON DELETE SET NULL' (po usunięciu analizy log pozostaje, pole `user_id` zmienia się na NULL)

4.  **`ai_request_logs` -> `pr_analyses`**
    *   Typ: Wiele-do-jednego (Many-to-One).
    *   Zachowanie: `ON DELETE SET NULL` (po usunięciu analizy log pozostaje, pole `analysis_id` zmienia się na NULL).

---

## 3. Indeksy

Indeksy zostały zaprojektowane w celu wsparcia kluczy obcych oraz najczęstszych operacji filtrowania i sortowania.

| Tabela | Kolumny | Typ Indeksu | Cel |
| :--- | :--- | :--- | :--- |
| `pr_analyses` | `user_id` | B-Tree | Optymalizacja RLS i filtrowania po użytkowniku. |
| `pr_analyses` | `status_id` | B-Tree | Filtrowanie po statusie analizy. |
| `pr_analyses` | `pr_name` | B-Tree | Wyszukiwanie analiz po nazwie PR. |
| `pr_analyses` | `branch_name` | B-Tree | Wyszukiwanie analiz po nazwie brancha. |
| `pr_analyses` | `created_at` | B-Tree | Sortowanie historii (najnowsze na górze). |
| `ai_request_logs` | `user_id` | B-Tree | Raportowanie użycia/kosztów per użytkownik. |
| `ai_request_logs` | `analysis_id` | B-Tree | Szybkie wyszukiwanie logów dla danej analizy. |

---

## 4. Polityki Row Level Security (RLS)

Dostęp do danych jest ściśle kontrolowany przez mechanizm RLS w PostgreSQL.

### 4.1 Tabela `analysis_statuses`
*   **Enable RLS:** Tak.
*   **Polityka (SELECT):** `true` (Publicznie dostępne do odczytu dla wszystkich uwierzytelnionych użytkowników).
*   **Polityka (INSERT/UPDATE/DELETE):** Tylko dla roli `service_role` (administrator/system).

### 4.2 Tabela `pr_analyses`
*   **Enable RLS:** Tak.
*   **Polityka (ALL - SELECT, INSERT, UPDATE, DELETE):**
    *   Wyrażenie: `auth.uid() = user_id`
    *   Opis: Użytkownicy mają pełny dostęp (CRUD) **wyłącznie** do rekordów, których są właścicielami.

### 4.3 Tabela `ai_request_logs`
*   **Enable RLS:** Tak.
*   **Polityka (SELECT):**
    *   Wyrażenie: `auth.uid() = user_id`
    *   Opis: Użytkownik może widzieć tylko swoje logi.
*   **Polityka (INSERT):**
    *   Wyrażenie: `auth.uid() = user_id`
    *   Opis: Użytkownik (aplikacja w jego kontekście) może tworzyć nowe logi.
*   **Polityka (UPDATE/DELETE):** Brak (Logi są niemodyfikowalne przez użytkownika - "Append Only").

---

## 5. Dodatkowe uwagi i implementacja

1.  **Automatyczna aktualizacja `updated_at`**:
    *   Należy utworzyć funkcję PL/pgSQL `update_updated_at_column()`.
    *   Należy dodać trigger `BEFORE UPDATE` na tabeli `pr_analyses` wywołujący tę funkcję.

2.  **Słownik Statusów**:
    *   Tabela `analysis_statuses` powinna zostać zasilona danymi początkowymi (seed) w migracji:
        *   `1`: 'draft'
        *   `2`: 'pending_review' (opcjonalnie)
        *   `3`: 'completed' (opcjonalnie, w zależności od logiki aplikacji)

3.  **JSON vs JSONB**:
    *   Wybrano typ `JSON` dla kolumny `ai_response` zgodnie z decyzją projektową, aby zachować oryginalne formatowanie tekstu generowanego przez AI i uniknąć narzutu związanego z dekompozycją do binarnego formatu JSONB, który nie jest tu wymagany (brak potrzeby indeksowania wnętrza JSON-a).

4.  **Bezpieczeństwo**:
    *   Administratorzy systemu mają dostęp do wszystkich danych poprzez pominięcie RLS (używając klucza `service_role` w Supabase).
