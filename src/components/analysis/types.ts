import type { AIResponse } from "@/types";

// ============================================================================
// METADATA TYPES
// ============================================================================

/**
 * Stan formularza metadanych.
 */
export interface MetadataValues {
  pr_name: string;
  branch_name: string;
  ticket_id: string;
}

/**
 * Błędy walidacji metadanych.
 */
export interface MetadataErrors {
  pr_name: string | null;
  branch_name: string | null;
  ticket_id: string | null;
}

/**
 * Błędy walidacji wyników AI.
 */
export interface AIResponseErrors {
  summary: string | null;
  risks: string | null;
  tests: string | null;
}

// ============================================================================
// FORM STATE TYPES
// ============================================================================

/**
 * Główny stan formularza analizy.
 */
export interface AnalysisFormState {
  /** Dane formularza metadanych */
  metadata: MetadataValues;
  /** Zawartość diffu */
  diffContent: string;

  /** Wyniki AI */
  aiResponse: AIResponse | null;
  /** ID analizy (po utworzeniu) */
  analysisId: string | null;

  /** Stany UI */
  isGenerating: boolean;
  isSaving: boolean;
  isDirty: boolean;

  /** Błędy */
  metadataErrors: MetadataErrors;
  diffError: string | null;
  apiError: string | null;
}

/**
 * Wynik walidacji formularza.
 */
export interface FormValidationResult {
  isValid: boolean;
  errors: {
    metadata: MetadataErrors;
    diff: string | null;
  };
}

// ============================================================================
// COMPONENT PROPS TYPES
// ============================================================================

/**
 * Propsy dla komponentu MetadataFields.
 */
export interface MetadataFieldsProps {
  values: MetadataValues;
  errors: MetadataErrors;
  disabled: boolean;
  onChange: (field: keyof MetadataValues, value: string) => void;
}

/**
 * Propsy dla komponentu DiffInput.
 */
export interface DiffInputProps {
  value: string;
  lineCount: number;
  error: string | null;
  disabled: boolean;
  onChange: (value: string) => void;
}

/**
 * Propsy dla komponentu ActionButtons.
 */
export interface ActionButtonsProps {
  isFormValid: boolean;
  isGenerating: boolean;
}

/**
 * Propsy dla komponentu AiLoader.
 */
export interface AiLoaderProps {
  message?: string;
}

/**
 * Propsy dla komponentu ResultsSection.
 */
export interface ResultsSectionProps {
  aiResponse: AIResponse;
  isEditable?: boolean;
  onEdit?: (field: keyof AIResponse, value: string) => void;
  /** Błędy walidacji dla poszczególnych sekcji */
  errors?: AIResponseErrors;
}

/**
 * Propsy dla komponentu ResultCard.
 */
export interface ResultCardProps {
  title: string;
  content: string;
  isEditable?: boolean;
  onEdit?: (value: string) => void;
  /** Błąd walidacji do wyświetlenia pod kartą */
  error?: string | null;
}

// ============================================================================
// HOOK RETURN TYPE
// ============================================================================

/**
 * Typ zwracany przez hook useAnalysisForm.
 */
export interface UseAnalysisFormReturn {
  /** Stan formularza */
  state: AnalysisFormState;
  /** Liczba linii w diff */
  lineCount: number;
  /** Czy formularz jest poprawny */
  isFormValid: boolean;

  /** Akcje metadanych */
  updateMetadata: (field: keyof MetadataValues, value: string) => void;

  /** Akcje diff */
  updateDiffContent: (value: string) => void;

  /** Akcja główna - generuj i zapisz */
  handleGenerate: () => Promise<void>;

  /** Reset */
  resetForm: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const MAX_DIFF_LINES = 1000;
export const MAX_BRANCH_NAME_LENGTH = 255;
export const MAX_TICKET_ID_LENGTH = 255;

/**
 * Początkowe wartości metadanych.
 */
export const initialMetadataValues: MetadataValues = {
  pr_name: "",
  branch_name: "",
  ticket_id: "",
};

/**
 * Początkowe wartości błędów metadanych.
 */
export const initialMetadataErrors: MetadataErrors = {
  pr_name: null,
  branch_name: null,
  ticket_id: null,
};

/**
 * Początkowe wartości błędów AI response.
 */
export const initialAiResponseErrors: AIResponseErrors = {
  summary: null,
  risks: null,
  tests: null,
};

/**
 * Początkowy stan formularza.
 */
export const initialFormState: AnalysisFormState = {
  metadata: initialMetadataValues,
  diffContent: "",
  aiResponse: null,
  analysisId: null,
  isGenerating: false,
  isSaving: false,
  isDirty: false,
  metadataErrors: initialMetadataErrors,
  diffError: null,
  apiError: null,
};

/**
 * Komunikaty błędów AI według kodu statusu.
 */
export const AI_ERROR_MESSAGES: Record<number, string> = {
  429: "Zbyt wiele żądań. Poczekaj chwilę przed ponowną próbą.",
  502: "Błąd podczas generowania AI. Spróbuj ponownie.",
  503: "Serwis AI jest tymczasowo niedostępny.",
  504: "Przekroczono czas oczekiwania na odpowiedź AI (60s).",
};

// ============================================================================
// ANALYSIS DETAIL VIEW TYPES
// ============================================================================

/**
 * Główny stan widoku szczegółów analizy.
 * Różni się od AnalysisFormState - obsługuje istniejącą analizę (edycja, regeneracja, usuwanie).
 */
export interface AnalysisDetailState {
  /** Dane z API (źródło prawdy) */
  analysis: import("@/types").AnalysisDTO | null;

  /** Edytowane wartości (kopie do modyfikacji) */
  editedMetadata: MetadataValues;
  editedAiResponse: AIResponse;
  editedStatusId: number;

  /** Stany UI */
  isLoading: boolean;
  isSaving: boolean;
  isRegenerating: boolean;
  isDeleting: boolean;
  isDirty: boolean;

  /** Stany dialogu */
  isDeleteDialogOpen: boolean;

  /** Błędy */
  metadataErrors: MetadataErrors;
  aiResponseErrors: AIResponseErrors;
  apiError: string | null;
}

/**
 * Początkowe wartości AI response.
 */
export const initialAiResponse: AIResponse = {
  summary: "",
  risks: "",
  tests: "",
};

/**
 * Początkowy stan widoku szczegółów.
 */
export const initialDetailState: AnalysisDetailState = {
  analysis: null,
  editedMetadata: initialMetadataValues,
  editedAiResponse: initialAiResponse,
  editedStatusId: 1,
  isLoading: true,
  isSaving: false,
  isRegenerating: false,
  isDeleting: false,
  isDirty: false,
  isDeleteDialogOpen: false,
  metadataErrors: initialMetadataErrors,
  aiResponseErrors: initialAiResponseErrors,
  apiError: null,
};

// ============================================================================
// ANALYSIS DETAIL COMPONENT PROPS
// ============================================================================

/**
 * Propsy dla AnalysisDetailContainer.
 */
export interface AnalysisDetailContainerProps {
  analysisId: string;
}

/**
 * Propsy dla DiffDisplay.
 */
export interface DiffDisplayProps {
  content: string;
  maxHeight?: string;
}

/**
 * Propsy dla QualityRating.
 */
export interface QualityRatingProps {
  value: number | null;
  disabled: boolean;
  onChange: (statusId: number) => void;
}

/**
 * Propsy dla ActionButtonsDetail.
 */
export interface ActionButtonsDetailProps {
  isFormValid: boolean;
  isDirty: boolean;
  isSaving: boolean;
  isRegenerating: boolean;
  isDeleting: boolean;
  hasResults: boolean;
  onSave: () => void;
  onRegenerate: () => void;
  onCopyAll: () => void;
  onDelete: () => void;
}

/**
 * Propsy dla DeleteConfirmDialog (w widoku szczegółów).
 */
export interface DeleteAnalysisDialogProps {
  isOpen: boolean;
  prName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// ============================================================================
// ANALYSIS DETAIL HOOK RETURN TYPE
// ============================================================================

/**
 * Typ zwracany przez hook useAnalysisDetail.
 */
export interface UseAnalysisDetailReturn {
  /** Stan */
  state: AnalysisDetailState;

  /** Computed values */
  isFormValid: boolean;
  hasResults: boolean;

  /** Akcje metadanych */
  updateMetadata: (field: keyof MetadataValues, value: string) => void;

  /** Akcje AI response (wykorzystuje istniejący ResultCard z wbudowanym trybem edycji) */
  updateAiResponse: (field: keyof AIResponse, value: string) => void;

  /** Akcje status */
  updateStatusId: (statusId: number) => void;

  /** Akcje główne */
  handleSave: () => Promise<void>;
  handleRegenerate: () => Promise<void>;
  handleCopyAll: () => Promise<void>;
  handleDelete: () => Promise<void>;

  /** Dialog */
  openDeleteDialog: () => void;
  closeDeleteDialog: () => void;
}
