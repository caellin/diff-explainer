import type { Json } from "../../db/database.types";
import type { SupabaseClientType } from "../../db/supabase.client";
import type { CreateAnalysisCommand, CreateAnalysisResponseDTO, StatusDTO, AIResponse } from "../../types";
import { OpenRouterService, type AIGenerationError } from "./openrouter.service";

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
}
