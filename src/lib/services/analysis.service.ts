import type { Json } from "../../db/database.types";
import type { SupabaseClientType } from "../../db/supabase.client";
import type {
  CreateAnalysisCommand,
  CreateAnalysisResponseDTO,
  GenerateAnalysisResponseDTO,
  UpdateAnalysisCommand,
  AnalysisResponseDTO,
  StatusDTO,
  AIResponse,
  DeleteAnalysesResponseDTO,
  GetAnalysesQuery,
  AnalysisListResponseDTO,
  AnalysisListItemDTO,
} from "../../types";
import { OpenRouterService, type AIGenerationError } from "./openrouter.service";

/**
 * Błąd rzucany gdy analiza nie została znaleziona.
 * Może oznaczać, że analiza nie istnieje lub nie należy do użytkownika (RLS).
 */
export class AnalysisNotFoundError extends Error {
  constructor(analysisId: string) {
    super(`Analysis not found: ${analysisId}`);
    this.name = "AnalysisNotFoundError";
  }
}

/**
 * Błąd rzucany gdy status_id nie istnieje w bazie.
 * Używany przy aktualizacji analizy z nieprawidłowym statusem.
 */
export class InvalidStatusError extends Error {
  constructor(statusId: number) {
    super(`Invalid status_id: ${statusId}`);
    this.name = "InvalidStatusError";
  }
}

/**
 * Stały status dla draftu analizy.
 * Odpowiada rekordowi w tabeli analysis_statuses z id=1.
 */
const DRAFT_STATUS: StatusDTO = { id: 1, code: "draft" };

/**
 * Parametry logowania żądania AI.
 */
interface LogAIRequestParams {
  analysisId: string;
  userId: string;
  model: string;
  tokenUsage: number;
  statusCode: number;
  errorMessage: string | null;
}

/**
 * Serwis zarządzający analizami PR.
 *
 * Odpowiada za:
 * - Tworzenie nowych analiz (draftów)
 * - Wywołanie serwisu AI do generowania opisów
 * - Logowanie żądań AI do audytu
 * - Aktualizację analiz z odpowiedzią AI
 *
 * @example
 * ```typescript
 * const service = new AnalysisService(supabase, "openrouter-api-key");
 * const result = await service.createAnalysis(command, userId);
 * ```
 */
export class AnalysisService {
  private readonly openRouterService: OpenRouterService;

  /**
   * Tworzy nową instancję serwisu analizy.
   *
   * @param supabase - Klient Supabase z typowaniem bazy danych
   * @param openRouterApiKey - Klucz API OpenRouter
   */
  constructor(
    private readonly supabase: SupabaseClientType,
    openRouterApiKey: string
  ) {
    this.openRouterService = new OpenRouterService(openRouterApiKey);
  }

  /**
   * Tworzy nową analizę, generuje opis przez AI i zwraca kompletny wynik.
   *
   * Proces:
   * 1. Tworzy draft w bazie z pustym ai_response
   * 2. Wywołuje serwis AI do wygenerowania analizy
   * 3. Loguje żądanie AI (sukces lub błąd) do ai_request_logs
   * 4. Aktualizuje rekord z wygenerowaną odpowiedzią AI
   * 5. Zwraca kompletną odpowiedź
   *
   * @param command - Dane wejściowe do utworzenia analizy
   * @param userId - ID zalogowanego użytkownika
   * @returns Odpowiedź z utworzoną analizą i wygenerowanym opisem AI
   * @throws Error gdy nie udało się utworzyć draftu lub wygenerować analizy
   */
  async createAnalysis(command: CreateAnalysisCommand, userId: string): Promise<CreateAnalysisResponseDTO> {
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
        ai_response: {}, // Pusty placeholder
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
      // Rzutowanie do Json jest wymagane ze względu na typowanie Supabase
      const { error: updateError } = await this.supabase
        .from("pr_analyses")
        .update({ ai_response: aiResponse as unknown as Json })
        .eq("id", draft.id);

      if (updateError) {
        // Server-side log - widoczny w terminalu serwera Astro
        console.error("[AnalysisService] Failed to update analysis with AI response:", updateError);
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
   * @throws AnalysisNotFoundError gdy analiza nie istnieje lub nie należy do użytkownika
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

  /**
   * Loguje żądanie AI do tabeli ai_request_logs.
   *
   * Służy do audytu i monitorowania zużycia tokenów.
   * Błąd logowania nie przerywa głównego przepływu.
   *
   * @param params - Parametry logowania
   */
  private async logAIRequest(params: LogAIRequestParams): Promise<void> {
    const { error } = await this.supabase.from("ai_request_logs").insert({
      analysis_id: params.analysisId,
      user_id: params.userId,
      model: params.model,
      token_usage: params.tokenUsage,
      status_code: params.statusCode,
      error_message: params.errorMessage,
    });

    if (error) {
      // Server-side log - widoczny w terminalu serwera Astro
      // Nie przerywamy głównego przepływu - logowanie to operacja pomocnicza
      console.error("[AnalysisService] Failed to log AI request:", error);
    }
  }

  /**
   * Pobiera pojedynczą analizę po ID.
   *
   * Proces:
   * 1. Pobiera analizę z bazy z JOIN na status
   * 2. RLS automatycznie filtruje do user_id
   * 3. Mapuje encję na DTO z rozwiązanym statusem
   *
   * @param analysisId - UUID analizy do pobrania
   * @returns Analiza jako DTO z rozwiązanym statusem
   * @throws AnalysisNotFoundError gdy analiza nie istnieje lub nie należy do użytkownika
   */
  async getAnalysisById(analysisId: string): Promise<AnalysisResponseDTO> {
    // 1. Pobierz analizę z JOIN na status
    const { data, error } = await this.supabase
      .from("pr_analyses")
      .select(
        `
        id, pr_name, branch_name, diff_content, ai_response, 
        ticket_id, created_at, updated_at,
        analysis_statuses!inner(id, code)
      `
      )
      .eq("id", analysisId)
      .single();

    // 2. Obsłuż błędy - brak danych lub błąd zapytania
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
        ai_response: data.ai_response as unknown as AIResponse,
        status: { id: status.id, code: status.code },
        ticket_id: data.ticket_id,
        created_at: data.created_at,
        updated_at: data.updated_at,
      },
    };
  }

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
  async updateAnalysis(analysisId: string, command: UpdateAnalysisCommand): Promise<AnalysisResponseDTO> {
    // 1. Waliduj status_id - sprawdź czy istnieje w bazie
    const { data: status, error: statusError } = await this.supabase
      .from("analysis_statuses")
      .select("id, code")
      .eq("id", command.status_id)
      .single();

    if (statusError || !status) {
      throw new InvalidStatusError(command.status_id);
    }

    // 2. Aktualizuj rekord w pr_analyses
    // RLS automatycznie sprawdza czy rekord należy do użytkownika
    const { data: updated, error: updateError } = await this.supabase
      .from("pr_analyses")
      .update({
        pr_name: command.pr_name,
        branch_name: command.branch_name,
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

    // 3. Mapuj na DTO i zwróć
    return {
      data: {
        id: updated.id,
        pr_name: updated.pr_name,
        branch_name: updated.branch_name,
        diff_content: updated.diff_content,
        ai_response: updated.ai_response as unknown as AIResponse,
        status: { id: status.id, code: status.code },
        ticket_id: updated.ticket_id,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      },
    };
  }

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
    const { data, error } = await this.supabase.from("pr_analyses").delete().in("id", ids).select("id");

    if (error) {
      throw new Error(`Failed to delete analyses: ${error.message}`);
    }

    return {
      deleted_count: data?.length ?? 0,
    };
  }

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
    const { page = 1, limit = 10, status_id, search, sort_field = "created_at", sort_order = "desc" } = query;
    const offset = (page - 1) * limit;

    // 1. Buduj bazowe zapytanie z JOIN na status
    let dbQuery = this.supabase.from("pr_analyses").select(
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
      dbQuery = dbQuery.or(`pr_name.ilike.%${searchTerm}%,branch_name.ilike.%${searchTerm}%`);
    }

    // 4. Sortowanie po wybranym polu i paginacja
    dbQuery = dbQuery.order(sort_field, { ascending: sort_order === "asc" }).range(offset, offset + limit - 1);

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
}
