import type { APIRoute } from "astro";

import { AnalysisService } from "../../../lib/services/analysis.service";
import { createAnalysisSchema } from "../../../lib/schemas/analysis.schema";
import type { CreateAnalysisCommand, APIErrorResponse, ValidationErrorResponse } from "../../../types";

export const prerender = false;

/**
 * POST /api/analysis
 *
 * Tworzy nową analizę PR i wykonuje pierwszą analizę AI.
 *
 * Wymaga autoryzacji: Bearer token w nagłówku Authorization.
 *
 * @returns 201 - Analiza utworzona pomyślnie
 * @returns 400 - Błąd walidacji danych wejściowych
 * @returns 401 - Brak autoryzacji
 * @returns 502 - Błąd generowania AI
 * @returns 503 - Serwis AI niedostępny
 * @returns 504 - Timeout serwisu AI
 */
export const POST: APIRoute = async ({ locals, request }) => {
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
    const validationResult = createAnalysisSchema.safeParse(body);
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

    // 4. Sprawdź klucz API OpenRouter
    const openRouterApiKey = import.meta.env.OPENROUTER_API_KEY;
    if (!openRouterApiKey) {
      console.error("[POST /api/analysis] OPENROUTER_API_KEY is not configured");
      return createErrorResponse({ error: "AI service not configured", status_code: 503 }, 503);
    }

    // 5. Wywołaj serwis
    const command: CreateAnalysisCommand = validationResult.data;
    const analysisService = new AnalysisService(locals.supabase, openRouterApiKey);
    const result = await analysisService.createAnalysis(command, user.id);

    // 6. Zwróć sukces
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[POST /api/analysis] Error creating analysis:", error);

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
