import { useState, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import type {
  AnalysisDTO,
  AnalysisResponseDTO,
  GenerateAnalysisResponseDTO,
  UpdateAnalysisCommand,
  DeleteAnalysesCommand,
  AIResponse,
} from "@/types";
import type { AnalysisDetailState, UseAnalysisDetailReturn } from "../types";
import { initialDetailState, initialMetadataErrors, initialAiResponseErrors, AI_ERROR_MESSAGES } from "../types";
import {
  validateMetadataField,
  validateAiResponseField,
  isMetadataValid,
  isEmptyAIResponse,
  handleNetworkError,
  handleUnauthorized,
  useBeforeUnload,
} from "./utils";

/**
 * Formatuje wyniki analizy do kopiowania do schowka.
 */
function formatForClipboard(analysis: AnalysisDTO): string {
  const { pr_name, branch_name, ticket_id, ai_response } = analysis;

  if (isEmptyAIResponse(ai_response)) {
    return "";
  }

  const response = ai_response as AIResponse;

  return `## PR: ${pr_name}
**Branch:** ${branch_name}
${ticket_id ? `**Zadanie:** ${ticket_id}\n` : ""}
## Podsumowanie
${response.summary}

## Ryzyka
${response.risks}

## Plan Testu
${response.tests}`;
}

/**
 * Custom hook do zarządzania stanem widoku szczegółów analizy.
 */
export function useAnalysisDetail(analysisId: string): UseAnalysisDetailReturn {
  const [state, setState] = useState<AnalysisDetailState>(initialDetailState);

  // Ochrona przed utratą niezapisanych zmian
  const isIntentionalNavigationRef = useBeforeUnload(state.isDirty);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const isFormValid = useMemo(() => {
    const { editedMetadata, editedAiResponse } = state;

    if (!isMetadataValid(editedMetadata)) return false;

    // Sprawdź pola AI response
    if (!editedAiResponse.summary.trim()) return false;
    if (!editedAiResponse.risks.trim()) return false;
    if (!editedAiResponse.tests.trim()) return false;

    return true;
  }, [state.editedMetadata, state.editedAiResponse]);

  const hasResults = useMemo(() => {
    const { editedAiResponse } = state;
    return !!(editedAiResponse.summary || editedAiResponse.risks || editedAiResponse.tests);
  }, [state.editedAiResponse]);

  // ============================================================================
  // FETCH DATA ON MOUNT
  // ============================================================================

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, apiError: null }));

        const response = await fetch(`/api/analysis/${analysisId}`, {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          if (response.status === 401) {
            handleUnauthorized();
            return;
          }

          if (response.status === 404) {
            toast.error("Analiza nie została znaleziona.");
            window.location.href = "/";
            return;
          }

          throw new Error("Nie udało się pobrać analizy");
        }

        const result: AnalysisResponseDTO = await response.json();
        const analysis = result.data;

        const aiResponse = isEmptyAIResponse(analysis.ai_response)
          ? { summary: "", risks: "", tests: "" }
          : (analysis.ai_response as AIResponse);

        setState((prev) => ({
          ...prev,
          analysis,
          editedMetadata: {
            pr_name: analysis.pr_name,
            branch_name: analysis.branch_name,
            ticket_id: analysis.ticket_id || "",
          },
          editedAiResponse: aiResponse,
          editedStatusId: analysis.status.id,
          isLoading: false,
        }));
      } catch (error) {
        const message = handleNetworkError(error);

        setState((prev) => ({
          ...prev,
          isLoading: false,
          apiError: message,
        }));
      }
    };

    fetchAnalysis();
  }, [analysisId]);

  // ============================================================================
  // UPDATE ACTIONS
  // ============================================================================

  const updateMetadata = useCallback((field: keyof MetadataValues, value: string) => {
    const error = validateMetadataField(field, value);

    setState((prev) => ({
      ...prev,
      editedMetadata: {
        ...prev.editedMetadata,
        [field]: value,
      },
      metadataErrors: {
        ...prev.metadataErrors,
        [field]: error,
      },
      isDirty: true,
    }));
  }, []);

  const updateAiResponse = useCallback((field: keyof AIResponse, value: string) => {
    const error = validateAiResponseField(field, value);

    setState((prev) => ({
      ...prev,
      editedAiResponse: {
        ...prev.editedAiResponse,
        [field]: value,
      },
      aiResponseErrors: {
        ...prev.aiResponseErrors,
        [field]: error,
      },
      isDirty: true,
    }));
  }, []);

  const updateStatusId = useCallback((statusId: number) => {
    setState((prev) => ({
      ...prev,
      editedStatusId: statusId,
      isDirty: true,
    }));
  }, []);

  // ============================================================================
  // MAIN ACTIONS
  // ============================================================================

  const handleSave = useCallback(async () => {
    setState((prev) => ({ ...prev, isSaving: true }));

    try {
      const command: UpdateAnalysisCommand = {
        pr_name: state.editedMetadata.pr_name.trim(),
        branch_name: state.editedMetadata.branch_name.trim(),
        ai_response: state.editedAiResponse,
        status_id: state.editedStatusId,
        ticket_id: state.editedMetadata.ticket_id.trim() || undefined,
      };

      const response = await fetch(`/api/analysis/${analysisId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(command),
      });

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
              isSaving: false,
              metadataErrors: {
                pr_name: errorData.field_errors.pr_name?.[0] || null,
                branch_name: errorData.field_errors.branch_name?.[0] || null,
                ticket_id: errorData.field_errors.ticket_id?.[0] || null,
              },
              aiResponseErrors: {
                summary: errorData.field_errors["ai_response.summary"]?.[0] || null,
                risks: errorData.field_errors["ai_response.risks"]?.[0] || null,
                tests: errorData.field_errors["ai_response.tests"]?.[0] || null,
              },
            }));
            return;
          }
        }

        if (response.status === 404) {
          toast.error("Analiza nie istnieje. Mogła zostać usunięta.");
          window.location.href = "/";
          return;
        }

        if (response.status === 422) {
          toast.error("Nieprawidłowy status. Odśwież stronę i spróbuj ponownie.");
          setState((prev) => ({ ...prev, isSaving: false }));
          return;
        }

        throw new Error("Nie udało się zapisać zmian");
      }

      const result: AnalysisResponseDTO = await response.json();

      setState((prev) => ({
        ...prev,
        analysis: result.data,
        isDirty: false,
        isSaving: false,
        metadataErrors: initialMetadataErrors,
        aiResponseErrors: initialAiResponseErrors,
      }));

      toast.success("Zapisano zmiany");
    } catch (error) {
      handleNetworkError(error);
      setState((prev) => ({ ...prev, isSaving: false }));
    }
  }, [analysisId, state.editedMetadata, state.editedAiResponse, state.editedStatusId]);

  const handleRegenerate = useCallback(async () => {
    setState((prev) => ({ ...prev, isRegenerating: true }));

    try {
      const response = await fetch(`/api/analysis/${analysisId}/generate`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }

        if ([429, 502, 503, 504].includes(response.status)) {
          toast.error(AI_ERROR_MESSAGES[response.status] || "Błąd serwisu AI", {
            action: {
              label: "Spróbuj ponownie",
              onClick: () => handleRegenerate(),
            },
          });
          setState((prev) => ({ ...prev, isRegenerating: false }));
          return;
        }

        throw new Error("Nie udało się wygenerować opisu");
      }

      const result: GenerateAnalysisResponseDTO = await response.json();

      setState((prev) => ({
        ...prev,
        analysis: prev.analysis
          ? {
              ...prev.analysis,
              ai_response: result.data,
            }
          : null,
        editedAiResponse: result.data,
        isRegenerating: false,
        isDirty: true,
        aiResponseErrors: initialAiResponseErrors,
      }));

      toast.success("Wygenerowano nowy opis");
    } catch (error) {
      handleNetworkError(error);
      setState((prev) => ({ ...prev, isRegenerating: false }));
    }
  }, [analysisId]);

  const handleCopyAll = useCallback(async () => {
    if (!state.analysis) return;

    const analysisWithEditedContent: AnalysisDTO = {
      ...state.analysis,
      pr_name: state.editedMetadata.pr_name,
      branch_name: state.editedMetadata.branch_name,
      ticket_id: state.editedMetadata.ticket_id || null,
      ai_response: state.editedAiResponse,
    };

    const text = formatForClipboard(analysisWithEditedContent);

    if (!text) {
      toast.error("Brak wyników do skopiowania");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success("Skopiowano do schowka");
    } catch {
      toast.error("Nie udało się skopiować do schowka");
    }
  }, [state.analysis, state.editedMetadata, state.editedAiResponse]);

  const handleDelete = useCallback(async () => {
    setState((prev) => ({ ...prev, isDeleting: true }));

    try {
      const command: DeleteAnalysesCommand = {
        ids: [analysisId],
      };

      const response = await fetch("/api/analysis", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(command),
      });

      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }

        if (response.status === 400) {
          toast.error("Nieprawidłowy identyfikator analizy.");
          setState((prev) => ({ ...prev, isDeleting: false, isDeleteDialogOpen: false }));
          return;
        }

        throw new Error("Nie udało się usunąć analizy");
      }

      toast.success("Analiza została usunięta");

      isIntentionalNavigationRef.current = true;
      window.location.href = "/";
    } catch (error) {
      handleNetworkError(error);
      setState((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [analysisId]);

  // ============================================================================
  // DIALOG ACTIONS
  // ============================================================================

  const openDeleteDialog = useCallback(() => {
    setState((prev) => ({ ...prev, isDeleteDialogOpen: true }));
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setState((prev) => ({ ...prev, isDeleteDialogOpen: false }));
  }, []);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    state,
    isFormValid,
    hasResults,
    updateMetadata,
    updateAiResponse,
    updateStatusId,
    handleSave,
    handleRegenerate,
    handleCopyAll,
    handleDelete,
    openDeleteDialog,
    closeDeleteDialog,
  };
}
