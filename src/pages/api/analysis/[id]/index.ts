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
 * Scenariusze użycia:
 * - Edycja wyniku AI (summary, risks, tests)
 * - Akceptacja analizy (zmiana status_id z 1/draft na 2/accepted)
 *
 * Wymaga autoryzacji: Bearer token w nagłówku Authorization.
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

    // 2. Waliduj parametr :id (UUID)
    const paramValidation = uuidParamSchema.safeParse(params);
    if (!paramValidation.success) {
      return createErrorResponse(
        {
          error: "Invalid analysis ID format",
          details: paramValidation.error.issues[0]?.message,
          status_code: 400,
        },
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

    // Obsługa AnalysisNotFoundError
    if (error instanceof AnalysisNotFoundError) {
      return createErrorResponse({ error: "Analysis not found", status_code: 404 }, 404);
    }

    // Obsługa InvalidStatusError
    if (error instanceof InvalidStatusError) {
      return createErrorResponse(
        {
          error: "Invalid status_id",
          details: error.message,
          status_code: 422,
        },
        422
      );
    }

    // Ogólny błąd serwera
    return createErrorResponse({ error: "Internal server error", status_code: 500 }, 500);
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
 * Tworzy odpowiedź JSON z błędem walidacji.
 */
function createValidationErrorResponse(fieldErrors: Record<string, string[]>): Response {
  const errorResponse: ValidationErrorResponse = {
    error: "Validation failed",
    field_errors: fieldErrors,
    status_code: 400,
  };
  return createErrorResponse(errorResponse, 400);
}
