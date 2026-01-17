import type { APIRoute } from "astro";
import { AnalysisService } from "../../../lib/services/analysis.service";
import { getAnalysesQuerySchema } from "../../../lib/schemas/analysis.schema";
import type { APIErrorResponse, ValidationErrorResponse, GetAnalysesQuery } from "../../../types";

export const prerender = false;

/**
 * GET /api/analysis/all
 *
 * Pobiera paginowaną listę analiz PR dla zalogowanego użytkownika.
 *
 * Wymaga autoryzacji: Bearer token w nagłówku Authorization.
 *
 * Query Parameters:
 * - page: numer strony (domyślnie 1)
 * - limit: liczba elementów na stronie (domyślnie 10, max 100)
 * - status_id: filtrowanie po ID statusu (opcjonalne)
 * - search: unified search - przeszukuje pr_name i branch_name (opcjonalne)
 * - sort_field: pole sortowania 'created_at', 'pr_name', 'branch_name' (domyślnie 'created_at')
 * - sort_order: kierunek sortowania 'asc' lub 'desc' (domyślnie 'desc')
 *
 * @returns 200 - Lista analiz z metadanymi paginacji
 * @returns 400 - Błąd walidacji parametrów
 * @returns 401 - Brak autoryzacji
 * @returns 500 - Błąd serwera
 */
export const GET: APIRoute = async ({ locals, url }) => {
  try {
    // 1. Sprawdź autoryzację
    const user = locals.user;
    if (!user) {
      return createErrorResponse({ error: "Unauthorized", status_code: 401 }, 401);
    }

    // 2. Parsuj query parameters z URL
    const queryParams = Object.fromEntries(url.searchParams.entries());

    // 3. Waliduj parametry
    const validationResult = getAnalysesQuerySchema.safeParse(queryParams);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of validationResult.error.issues) {
        const field = issue.path.join(".") || "query";
        if (!fieldErrors[field]) {
          fieldErrors[field] = [];
        }
        fieldErrors[field].push(issue.message);
      }
      return createValidationErrorResponse(fieldErrors);
    }

    // 4. Wywołaj serwis
    const query: GetAnalysesQuery = validationResult.data;
    const analysisService = new AnalysisService(locals.supabase, "");
    const result = await analysisService.getAnalyses(query);

    // 5. Zwróć sukces
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[GET /api/analysis/all] Error fetching analyses:", error);

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
