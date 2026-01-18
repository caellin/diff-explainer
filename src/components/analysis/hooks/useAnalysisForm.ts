import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { CreateAnalysisCommand, CreateAnalysisResponseDTO } from "@/types";
import type { AnalysisFormState, MetadataValues, UseAnalysisFormReturn } from "../types";
import { initialFormState, MAX_DIFF_LINES, AI_ERROR_MESSAGES } from "../types";
import {
  validateMetadataField,
  isMetadataValid,
  handleNetworkError,
  handleUnauthorized,
  useBeforeUnload,
} from "./utils";

/**
 * Wzorce charakterystyczne dla formatu git diff.
 */
const GIT_DIFF_PATTERNS = {
  diffGitHeader: /^diff --git /m,
  unifiedSourceHeader: /^--- /m,
  hunkHeader: /^@@ .* @@/m,
} as const;

/**
 * Sprawdza czy tekst jest prawidłowym formatem git diff.
 */
function isValidGitDiff(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return false;
  }

  const hasDiffHeader = GIT_DIFF_PATTERNS.diffGitHeader.test(text) || GIT_DIFF_PATTERNS.unifiedSourceHeader.test(text);
  const hasHunkHeader = GIT_DIFF_PATTERNS.hunkHeader.test(text);

  return hasDiffHeader && hasHunkHeader;
}

/**
 * Liczy liczbę linii w tekście.
 */
function countLines(text: string): number {
  if (!text) return 0;
  return text.split("\n").length;
}

/**
 * Waliduje zawartość diff.
 */
function validateDiffContent(value: string): string | null {
  if (!value.trim()) {
    return "Diff jest wymagany";
  }

  const lineCount = countLines(value);
  if (lineCount > MAX_DIFF_LINES) {
    return `Diff przekracza limit ${MAX_DIFF_LINES} linii (obecnie: ${lineCount})`;
  }

  if (!isValidGitDiff(value)) {
    return "Nieprawidłowy format git diff. Wymagane nagłówki diff i markery @@ ... @@";
  }

  return null;
}

/**
 * Custom hook do zarządzania stanem formularza tworzenia nowej analizy.
 */
export function useAnalysisForm(): UseAnalysisFormReturn {
  const [state, setState] = useState<AnalysisFormState>(initialFormState);

  // Ochrona przed utratą niezapisanych zmian
  const isIntentionalNavigationRef = useBeforeUnload(state.isDirty);

  // Obliczanie liczby linii
  const lineCount = useMemo(() => countLines(state.diffContent), [state.diffContent]);

  // Sprawdzanie czy formularz jest poprawny
  const isFormValid = useMemo(() => {
    const { metadata, diffContent } = state;

    if (!isMetadataValid(metadata)) return false;

    // Sprawdź diff
    if (!diffContent.trim()) return false;
    if (lineCount > MAX_DIFF_LINES) return false;
    if (!isValidGitDiff(diffContent)) return false;

    return true;
  }, [state.metadata, state.diffContent, lineCount]);

  // Aktualizacja pól metadanych
  const updateMetadata = useCallback((field: keyof MetadataValues, value: string) => {
    setState((prev) => {
      const error = validateMetadataField(field, value);

      return {
        ...prev,
        metadata: {
          ...prev.metadata,
          [field]: value,
        },
        metadataErrors: {
          ...prev.metadataErrors,
          [field]: error,
        },
        isDirty: true,
      };
    });
  }, []);

  // Aktualizacja zawartości diff
  const updateDiffContent = useCallback((value: string) => {
    setState((prev) => ({
      ...prev,
      diffContent: value,
      diffError: validateDiffContent(value),
      isDirty: true,
    }));
  }, []);

  // Generowanie analizy
  const handleGenerate = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isGenerating: true,
      apiError: null,
    }));

    try {
      const command: CreateAnalysisCommand = {
        pr_name: state.metadata.pr_name.trim(),
        branch_name: state.metadata.branch_name.trim(),
        ticket_id: state.metadata.ticket_id.trim() || undefined,
        diff_content: state.diffContent,
      };

      const response = await fetch("/api/analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(command),
      });

      // Obsługa błędów
      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }

        if (response.status === 400) {
          const errorData = await response.json();
          if (errorData.field_errors) {
            setState((prev) => ({
              ...prev,
              isGenerating: false,
              metadataErrors: {
                pr_name: errorData.field_errors.pr_name?.[0] || null,
                branch_name: errorData.field_errors.branch_name?.[0] || null,
                ticket_id: errorData.field_errors.ticket_id?.[0] || null,
              },
              diffError: errorData.field_errors.diff_content?.[0] || null,
            }));
            return;
          }
        }

        if (response.status === 429) {
          toast.error("Zbyt wiele żądań. Poczekaj chwilę przed ponowną próbą.");
          setState((prev) => ({ ...prev, isGenerating: false }));
          return;
        }

        if ([502, 503, 504].includes(response.status)) {
          toast.error(AI_ERROR_MESSAGES[response.status] || "Błąd serwisu AI", {
            action: {
              label: "Spróbuj ponownie",
              onClick: () => handleGenerate(),
            },
          });
          setState((prev) => ({ ...prev, isGenerating: false }));
          return;
        }

        const errorData = await response.json().catch(() => ({ error: "Nieznany błąd" }));
        throw new Error(errorData.error || "Nie udało się wygenerować analizy");
      }

      // Sukces
      const result: CreateAnalysisResponseDTO = await response.json();

      toast.success("Analiza wygenerowana i zapisana!");

      // Oznacz jako intencjonalną nawigację, aby pominąć beforeunload
      isIntentionalNavigationRef.current = true;

      // Przekierowanie do szczegółów analizy
      window.location.href = `/analysis/${result.data.id}`;
    } catch (error) {
      const message = handleNetworkError(error);

      setState((prev) => ({
        ...prev,
        isGenerating: false,
        apiError: message,
      }));
    }
  }, [state.metadata, state.diffContent]);

  // Reset formularza
  const resetForm = useCallback(() => {
    setState(initialFormState);
  }, []);

  return {
    state,
    lineCount,
    isFormValid,
    updateMetadata,
    updateDiffContent,
    handleGenerate,
    resetForm,
  };
}
