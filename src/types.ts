import type { Tables } from "./db/database.types";

// ============================================================================
// BASE ENTITY TYPES (derived from database models)
// ============================================================================

/**
 * Encja analizy PR pobrana z bazy danych.
 * Reprezentuje pełny wiersz z tabeli `pr_analyses`.
 */
export type AnalysisEntity = Tables<"pr_analyses">;

/**
 * Encja statusu analizy pobrana z bazy danych.
 * Reprezentuje wiersz z tabeli `analysis_statuses`.
 */
export type StatusEntity = Tables<"analysis_statuses">;

/**
 * Encja logu żądania AI pobrana z bazy danych.
 * Reprezentuje wiersz z tabeli `ai_request_logs`.
 * Używana wewnętrznie do audytu, nie eksponowana przez publiczne API.
 */
export type AIRequestLogEntity = Tables<"ai_request_logs">;

// ============================================================================
// AI RESPONSE TYPES
// ============================================================================

/**
 * Struktura odpowiedzi AI zawierająca wygenerowany opis PR.
 * Przechowywana w polu `ai_response` tabeli `pr_analyses`.
 */
export interface AIResponse {
  /** Podsumowanie zmian w formacie markdown */
  summary: string;
  /** Potencjalne ryzyka w formacie markdown */
  risks: string;
  /** Sugerowane testy w formacie markdown */
  tests: string;
}

/**
 * Pusty obiekt AI response używany przy tworzeniu draftu.
 * Spełnia constraint NOT NULL w bazie danych.
 */
export type EmptyAIResponse = Record<string, never>;

// ============================================================================
// STATUS DTO
// ============================================================================

/**
 * DTO reprezentujące status analizy.
 * Bezpośrednie mapowanie z encji `analysis_statuses`.
 *
 * @example
 * { id: 1, code: "draft" }
 */
export type StatusDTO = Pick<StatusEntity, "id" | "code">;

// ============================================================================
// ANALYSIS DTOs
// ============================================================================

/**
 * Pełne DTO analizy zwracane przez GET /api/analysis/:id.
 * Zawiera wszystkie szczegóły analizy z rozwiązanym statusem.
 */
export interface AnalysisDTO {
  /** Unikalny identyfikator analizy (UUID) */
  id: AnalysisEntity["id"];
  /** Nazwa pull requesta */
  pr_name: AnalysisEntity["pr_name"];
  /** Nazwa brancha */
  branch_name: AnalysisEntity["branch_name"];
  /** Surowa zawartość diffa git */
  diff_content: AnalysisEntity["diff_content"];
  /** Odpowiedź AI z wygenerowanym opisem */
  ai_response: AIResponse | EmptyAIResponse;
  /** Status analizy (rozwinięty obiekt zamiast samego ID) */
  status: StatusDTO;
  /** Opcjonalny identyfikator ticketa */
  ticket_id: AnalysisEntity["ticket_id"];
  /** Data utworzenia (ISO8601) */
  created_at: AnalysisEntity["created_at"];
  /** Data ostatniej aktualizacji (ISO8601) */
  updated_at: AnalysisEntity["updated_at"];
}

/**
 * Uproszczone DTO analizy dla listy historii.
 * Zwracane przez GET /api/analysis/all.
 * Pomija ciężkie pola jak `diff_content` dla wydajności.
 */
export interface AnalysisListItemDTO {
  /** Unikalny identyfikator analizy (UUID) */
  id: AnalysisEntity["id"];
  /** Nazwa pull requesta */
  pr_name: AnalysisEntity["pr_name"];
  /** Nazwa brancha */
  branch_name: AnalysisEntity["branch_name"];
  /** Status analizy (rozwinięty obiekt) */
  status: StatusDTO;
  /** Data utworzenia (ISO8601) */
  created_at: AnalysisEntity["created_at"];
}

// ============================================================================
// RESPONSE DTOs
// ============================================================================

/**
 * DTO odpowiedzi po utworzeniu draftu analizy.
 * Zwracane przez POST /api/analysis.
 */
export interface CreateAnalysisResponseDTO {
  /** Dane utworzonej analizy */
  data: {
    /** Unikalny identyfikator nowo utworzonej analizy (UUID) */
    id: AnalysisEntity["id"];
    /** Status analizy (draft) */
    status: StatusDTO;
    /** Odpowiedź generatora AI */
    ai_response: AIResponse;
    /** Data utworzenia (ISO8601) */
    created_at: AnalysisEntity["created_at"];
  };
}

/**
 * DTO odpowiedzi po wygenerowaniu opisu przez AI.
 * Zwracane przez POST /api/analysis/:id/generate.
 */
export interface GenerateAnalysisResponseDTO {
  /** Wygenerowane dane przez AI */
  data: AIResponse;
}

/**
 * DTO odpowiedzi po usunięciu analiz.
 * Zwracane przez DELETE /api/analysis.
 */
export interface DeleteAnalysesResponseDTO {
  /** Liczba usuniętych analiz */
  deleted_count: number;
}

/**
 * Metadane paginacji dla list.
 */
export interface PaginationMeta {
  /** Całkowita liczba rekordów */
  total: number;
  /** Aktualny numer strony */
  page: number;
  /** Liczba elementów na stronie */
  limit: number;
}

/**
 * DTO odpowiedzi z paginowaną listą analiz.
 * Zwracane przez GET /api/analysis/all.
 */
export interface AnalysisListResponseDTO {
  /** Lista analiz na aktualnej stronie */
  data: AnalysisListItemDTO[];
  /** Metadane paginacji */
  meta: PaginationMeta;
}

/**
 * DTO odpowiedzi z listą dostępnych statusów.
 * Zwracane przez GET /api/statuses.
 */
export interface StatusListResponseDTO {
  /** Lista wszystkich dostępnych statusów */
  data: StatusDTO[];
}

/**
 * DTO odpowiedzi z pojedynczą analizą.
 * Zwracane przez GET /api/analysis/:id i PUT /api/analysis/:id.
 */
export interface AnalysisResponseDTO {
  /** Dane analizy */
  data: AnalysisDTO;
}

// ============================================================================
// COMMAND MODELS (Request Bodies)
// ============================================================================

/**
 * Command model do tworzenia nowego draftu analizy.
 * Używany w POST /api/analysis.
 *
 * @remarks
 * Walidacja: diff_content max 1000 linii.
 */
export interface CreateAnalysisCommand {
  /** Nazwa pull requesta */
  pr_name: AnalysisEntity["pr_name"];
  /** Nazwa brancha źródłowego */
  branch_name: AnalysisEntity["branch_name"];
  /** Opcjonalny identyfikator ticketa (np. JIRA) */
  ticket_id?: NonNullable<AnalysisEntity["ticket_id"]>;
  /** Surowa zawartość diffa git (max 1000 linii) */
  diff_content: AnalysisEntity["diff_content"];
}

/**
 * Command model do aktualizacji/finalizacji analizy.
 * Używany w PUT /api/analysis/:id.
 */
export interface UpdateAnalysisCommand {
  /** Nazwa pull requesta */
  pr_name: AnalysisEntity["pr_name"];
  /** Odpowiedź AI (możliwa edycja przez użytkownika) */
  ai_response: AIResponse;
  /** ID statusu (np. 2 = pending_review, 3 = completed) */
  status_id: AnalysisEntity["status_id"];
  /** Opcjonalny identyfikator ticketa */
  ticket_id?: NonNullable<AnalysisEntity["ticket_id"]>;
}

/**
 * Command model do usuwania wielu analiz.
 * Używany w DELETE /api/analysis.
 */
export interface DeleteAnalysesCommand {
  /** Lista UUID analiz do usunięcia */
  ids: AnalysisEntity["id"][];
}

// ============================================================================
// QUERY PARAMETERS
// ============================================================================

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

// ============================================================================
// ERROR RESPONSE TYPES
// ============================================================================

/**
 * Standardowy format odpowiedzi błędu API.
 */
export interface APIErrorResponse {
  /** Komunikat błędu */
  error: string;
  /** Szczegóły błędu (opcjonalne) */
  details?: string;
  /** Kod błędu HTTP */
  status_code: number;
}

/**
 * Błąd walidacji z informacją o konkretnych polach.
 */
export interface ValidationErrorResponse extends APIErrorResponse {
  /** Błędy walidacji per pole */
  field_errors?: Record<string, string[]>;
}
