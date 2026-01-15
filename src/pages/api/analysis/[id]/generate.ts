import type { APIRoute } from "astro";

import { AnalysisService, AnalysisNotFoundError } from "../../../../lib/services/analysis.service";
import { uuidParamSchema } from "../../../../lib/schemas/analysis.schema";
import type { APIErrorResponse } from "../../../../types";

export const prerender = false;

/**
 * POST /api/analysis/:id/generate
 *
 * Regeneruje opis AI dla istniejącej analizy.
 *
 * Wymaga autoryzacji: Bearer token w nagłówku Authorization.
 *
 * @returns 200 - Generowanie zakończone sukcesem
 * @returns 400 - Nieprawidłowy format UUID
 * @returns 401 - Brak autoryzacji
 * @returns 404 - Analiza nie znaleziona
 * @returns 429 - Rate limit przekroczony
 * @returns 502 - Błąd generowania AI
 * @returns 503 - Serwis AI niedostępny
 * @returns 504 - Timeout serwisu AI
 */
export const POST: APIRoute = async ({ locals, params }) => {
  try {
    // 1. Sprawdź autoryzację
    const user = locals.user;
    if (!user) {
      return createErrorResponse({ error: "Unauthorized", status_code: 401 }, 401);
    }

    // 2. Waliduj parametr :id
    const validationResult = uuidParamSchema.safeParse({ id: params.id });
    if (!validationResult.success) {
      return createErrorResponse(
        {
          error: "Invalid analysis ID format",
          details: validationResult.error.issues[0]?.message,
          status_code: 400,
        },
        400
      );
    }

    // 3. Sprawdź klucz API OpenRouter
    const openRouterApiKey = import.meta.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      console.error("[POST /api/analysis/:id/generate] OPENROUTER_API_KEY is not configured");
      return createErrorResponse({ error: "AI service not configured", status_code: 503 }, 503);
    }

    // 4. Wywołaj serwis
    const analysisService = new AnalysisService(locals.supabase, openRouterApiKey);
    const result = await analysisService.generateForExisting(validationResult.data.id, user.id);

    // 5. Zwróć sukces
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[POST /api/analysis/:id/generate] Error:", error);

    // Obsługa AnalysisNotFoundError
    if (error instanceof AnalysisNotFoundError) {
      return createErrorResponse({ error: "Analysis not found", status_code: 404 }, 404);
    }

    const { statusCode, message, details } = mapErrorToResponse(error);
    return createErrorResponse({ error: message, details, status_code: statusCode }, statusCode);
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
 * Mapuje błąd na odpowiedni kod HTTP i komunikat.
 */
function mapErrorToResponse(error: unknown): { statusCode: number; message: string; details: string } {
  let statusCode = 500;
  let message = "Internal server error";
  let details = "Unknown error";

  if (error instanceof Error) {
    details = error.message;
    const errorMsg = error.message.toLowerCase();

    if (errorMsg.includes("timeout")) {
      statusCode = 504;
      message = "AI service timeout";
    } else if (errorMsg.includes("unavailable") || errorMsg.includes("503")) {
      statusCode = 503;
      message = "AI service unavailable";
    } else if (errorMsg.includes("rate limit") || errorMsg.includes("429")) {
      statusCode = 429;
      message = "Too many requests - rate limit exceeded";
    } else if (errorMsg.includes("ai generation failed")) {
      statusCode = 502;
      message = "AI generation failed";
    }
  }

  return { statusCode, message, details };
}
