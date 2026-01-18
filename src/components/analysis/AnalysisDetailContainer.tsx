import { MetadataFields } from "./MetadataFields";
import { DiffDisplay } from "./DiffDisplay";
import { QualityRating } from "./QualityRating";
import { ResultsSection } from "./ResultsSection";
import { ActionButtonsDetail } from "./ActionButtonsDetail";
import { AiLoader } from "./AiLoader";
import { DeleteAnalysisDialog } from "./DeleteAnalysisDialog";
import { AnalysisDetailSkeleton } from "./AnalysisDetailSkeleton";
import { useAnalysisDetail } from "./hooks/useAnalysisDetail";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalysisDetailContainerProps } from "./types";

/**
 * Główny kontener widoku szczegółów analizy.
 * Zarządza całym stanem, orkiestruje komunikację między komponentami i obsługuje wywołania API.
 */
export function AnalysisDetailContainer({ analysisId }: AnalysisDetailContainerProps) {
  const {
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
  } = useAnalysisDetail(analysisId);

  const {
    analysis,
    editedMetadata,
    editedAiResponse,
    editedStatusId,
    isLoading,
    isSaving,
    isRegenerating,
    isDeleting,
    isDirty,
    isDeleteDialogOpen,
    metadataErrors,
    aiResponseErrors,
    apiError,
  } = state;

  // Stan ładowania
  if (isLoading) {
    return <AnalysisDetailSkeleton />;
  }

  // Błąd ładowania
  if (apiError && !analysis) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Błąd</AlertTitle>
          <AlertDescription>{apiError}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => (window.location.href = "/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Powrót do historii
        </Button>
      </div>
    );
  }

  // Brak danych
  if (!analysis) {
    return null;
  }

  const isFormDisabled = isSaving || isRegenerating;

  return (
    <div className="space-y-6" aria-busy={isRegenerating}>
      {/* Nagłówek */}
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => (window.location.href = "/")} className="gap-1 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Historia
          </Button>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Szczegóły analizy</h1>
        <p className="text-muted-foreground">
          Przeglądaj i edytuj analizę dla PR: <strong>{analysis.pr_name}</strong>
        </p>
      </header>

      {/* Formularz metadanych */}
      <section aria-label="Metadane analizy">
        <MetadataFields
          values={editedMetadata}
          errors={metadataErrors}
          disabled={isFormDisabled}
          onChange={updateMetadata}
        />
      </section>

      {/* Wyświetlanie diffu (read-only) */}
      <section aria-label="Zawartość diff">
        <DiffDisplay content={analysis.diff_content} />
      </section>

      {/* Ocena jakości */}
      <section aria-label="Ocena jakości">
        <QualityRating value={editedStatusId} disabled={isFormDisabled} onChange={updateStatusId} />
      </section>

      {/* Przyciski akcji - nad wynikami */}
      <ActionButtonsDetail
        isFormValid={isFormValid}
        isDirty={isDirty}
        isSaving={isSaving}
        isRegenerating={isRegenerating}
        isDeleting={isDeleting}
        hasResults={hasResults}
        onSave={handleSave}
        onRegenerate={handleRegenerate}
        onCopyAll={handleCopyAll}
        onDelete={openDeleteDialog}
      />

      {/* Loader podczas regeneracji */}
      {isRegenerating && (
        <div className="py-4">
          <AiLoader message="Generuję ponownie..." />
        </div>
      )}

      {/* Sekcja wyników AI */}
      {hasResults && (
        <ResultsSection
          aiResponse={editedAiResponse}
          isEditable={!isFormDisabled}
          onEdit={updateAiResponse}
          errors={aiResponseErrors}
        />
      )}

      {/* Dialog potwierdzenia usunięcia */}
      <DeleteAnalysisDialog
        isOpen={isDeleteDialogOpen}
        prName={editedMetadata.pr_name}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onCancel={closeDeleteDialog}
      />
    </div>
  );
}
