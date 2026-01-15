import { z } from "zod";

const MAX_DIFF_LINES = 1000;
const MAX_BRANCH_NAME_LENGTH = 255;
const MAX_TICKET_ID_LENGTH = 255;

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
 * Eksportowane stałe dla testów i dokumentacji.
 */
export const VALIDATION_LIMITS = {
  MAX_DIFF_LINES,
  MAX_BRANCH_NAME_LENGTH,
  MAX_TICKET_ID_LENGTH,
} as const;
