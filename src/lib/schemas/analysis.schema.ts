import { z } from "zod";

const MAX_DIFF_LINES = 1000;
const MAX_BRANCH_NAME_LENGTH = 255;
const MAX_TICKET_ID_LENGTH = 255;
const MAX_DELETE_IDS = 100;
const MAX_SEARCH_LENGTH = 255;
const MAX_PAGE_LIMIT = 100;

/**
 * Liczy liczbę linii w stringu.
 */
function countLines(text: string): number {
  if (!text) return 0;
  return text.split("\n").length;
}

/**
 * Wzorce charakterystyczne dla formatu git diff.
 */
const GIT_DIFF_PATTERNS = {
  /** Nagłówek diff --git (format git) */
  diffGitHeader: /^diff --git /m,
  /** Linia źródłowa --- (unified diff) */
  unifiedSourceHeader: /^--- /m,
  /** Hunk header z informacją o liniach */
  hunkHeader: /^@@ .* @@/m,
} as const;

/**
 * Sprawdza czy tekst jest prawidłowym formatem git diff.
 *
 * Wymaga:
 * - Nagłówka diff (diff --git lub ---) ORAZ
 * - Hunk header (@@ ... @@)
 *
 * @param text - Tekst do sprawdzenia
 * @returns true jeśli tekst jest prawidłowym git diff
 */
function isValidGitDiff(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return false;
  }

  // Wymaga nagłówka diff --git (git format) lub --- (unified diff)
  const hasDiffHeader = GIT_DIFF_PATTERNS.diffGitHeader.test(text) || GIT_DIFF_PATTERNS.unifiedSourceHeader.test(text);

  // Wymaga hunk header (@@ ... @@)
  const hasHunkHeader = GIT_DIFF_PATTERNS.hunkHeader.test(text);

  return hasDiffHeader && hasHunkHeader;
}

/**
 * Schemat walidacji dla tworzenia nowej analizy PR.
 *
 * Waliduje:
 * - pr_name: niepusty string
 * - branch_name: niepusty string, max 255 znaków
 * - ticket_id: opcjonalny, max 255 znaków
 * - diff_content: niepusty string, max 1000 linii, format git diff
 */
export const createAnalysisSchema = z.object({
  pr_name: z.string({ required_error: "PR name is required" }).min(1, "PR name cannot be empty").trim(),

  branch_name: z
    .string({ required_error: "Branch name is required" })
    .min(1, "Branch name cannot be empty")
    .max(MAX_BRANCH_NAME_LENGTH, `Branch name must be ${MAX_BRANCH_NAME_LENGTH} characters or less`)
    .trim(),

  ticket_id: z
    .string()
    .max(MAX_TICKET_ID_LENGTH, `Ticket ID must be ${MAX_TICKET_ID_LENGTH} characters or less`)
    .trim()
    .optional(),

  diff_content: z
    .string({ required_error: "Diff content is required" })
    .min(1, "Diff content cannot be empty")
    .refine((val) => countLines(val) <= MAX_DIFF_LINES, {
      message: `Diff content exceeds ${MAX_DIFF_LINES} lines limit`,
    })
    .refine((val) => isValidGitDiff(val), {
      message:
        "Invalid git diff format. Content must be a valid unified diff with diff headers and hunk markers (@@...@@)",
    }),
});

/**
 * Typ wejściowy dla tworzenia analizy, wynikający ze schematu Zod.
 */
export type CreateAnalysisInput = z.infer<typeof createAnalysisSchema>;

/**
 * Schemat walidacji parametru UUID.
 * Używany dla endpointów z parametrem :id w URL.
 */
export const uuidParamSchema = z.object({
  id: z.string().uuid("Invalid analysis ID format - must be a valid UUID"),
});

/**
 * Typ parametru UUID wynikający ze schematu Zod.
 */
export type UUIDParam = z.infer<typeof uuidParamSchema>;

/**
 * Schemat walidacji dla odpowiedzi AI.
 * Każde pole musi być niepustym stringiem (markdown).
 */
const aiResponseSchema = z.object({
  summary: z.string({ required_error: "Summary is required" }).min(1, "Summary cannot be empty"),
  risks: z.string({ required_error: "Risks is required" }).min(1, "Risks cannot be empty"),
  tests: z.string({ required_error: "Tests is required" }).min(1, "Tests cannot be empty"),
});

/**
 * Schemat walidacji dla aktualizacji analizy PR.
 *
 * Waliduje:
 * - pr_name: niepusty string
 * - ai_response: obiekt z summary, risks, tests
 * - status_id: dodatnia liczba całkowita
 * - ticket_id: opcjonalny, max 255 znaków
 */
export const updateAnalysisSchema = z.object({
  pr_name: z.string({ required_error: "PR name is required" }).min(1, "PR name cannot be empty").trim(),
  ai_response: aiResponseSchema,
  status_id: z
    .number({ required_error: "Status ID is required" })
    .int("Status ID must be an integer")
    .positive("Status ID must be positive"),
  ticket_id: z
    .string()
    .max(MAX_TICKET_ID_LENGTH, `Ticket ID must be ${MAX_TICKET_ID_LENGTH} characters or less`)
    .trim()
    .optional(),
});

/**
 * Typ wejściowy dla aktualizacji analizy, wynikający ze schematu Zod.
 */
export type UpdateAnalysisInput = z.infer<typeof updateAnalysisSchema>;

/**
 * Schemat walidacji dla usuwania analiz.
 *
 * Waliduje:
 * - ids: niepusta tablica UUID, max 100 elementów
 */
export const deleteAnalysesSchema = z.object({
  ids: z
    .array(z.string().uuid("Each ID must be a valid UUID"))
    .min(1, "At least one analysis ID is required")
    .max(MAX_DELETE_IDS, `Cannot delete more than ${MAX_DELETE_IDS} analyses at once`),
});

/**
 * Typ wejściowy dla usuwania analiz, wynikający ze schematu Zod.
 */
export type DeleteAnalysesInput = z.infer<typeof deleteAnalysesSchema>;

/**
 * Dozwolone pola sortowania dla listy analiz.
 * Odpowiadają kolumnom z indeksami w tabeli pr_analyses.
 */
export const ALLOWED_SORT_FIELDS = ["created_at", "pr_name", "branch_name"] as const;

/**
 * Typ pola sortowania wynikający z dozwolonych wartości.
 */
export type SortFieldSchema = (typeof ALLOWED_SORT_FIELDS)[number];

/**
 * Schemat walidacji dla parametrów zapytania listy analiz.
 *
 * Waliduje:
 * - page: numer strony (min 1, domyślnie 1)
 * - limit: liczba elementów na stronie (1-100, domyślnie 10)
 * - status_id: opcjonalny filtr po ID statusu
 * - search: unified search w pr_name i branch_name (max 255 znaków)
 * - sort_field: pole sortowania (domyślnie 'created_at')
 * - sort_order: kierunek sortowania (domyślnie 'desc')
 */
export const getAnalysesQuerySchema = z.object({
  page: z.coerce.number().int("Page must be an integer").min(1, "Page must be at least 1").default(1),
  limit: z.coerce
    .number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(MAX_PAGE_LIMIT, `Limit cannot exceed ${MAX_PAGE_LIMIT}`)
    .default(10),
  status_id: z.coerce.number().int("Status ID must be an integer").positive("Status ID must be positive").optional(),
  search: z
    .string()
    .max(MAX_SEARCH_LENGTH, `Search query must be ${MAX_SEARCH_LENGTH} characters or less`)
    .trim()
    .optional(),
  sort_field: z.enum(ALLOWED_SORT_FIELDS).default("created_at"),
  sort_order: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Typ wejściowy dla listy analiz, wynikający ze schematu Zod.
 */
export type GetAnalysesQueryInput = z.infer<typeof getAnalysesQuerySchema>;

/**
 * Eksportowane stałe dla testów i dokumentacji.
 */
export const VALIDATION_LIMITS = {
  MAX_DIFF_LINES,
  MAX_BRANCH_NAME_LENGTH,
  MAX_TICKET_ID_LENGTH,
  MAX_DELETE_IDS,
  MAX_SEARCH_LENGTH,
  MAX_PAGE_LIMIT,
} as const;
