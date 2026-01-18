import { MetadataFields } from "./MetadataFields";
import { DiffInput } from "./DiffInput";
import { ActionButtons } from "./ActionButtons";
import { AiLoader } from "./AiLoader";
import { useAnalysisForm } from "./hooks/useAnalysisForm";

/**
 * Główny kontener formularza analizy.
 * Orkiestruje komunikację między komponentami potomnymi i obsługuje wywołania API.
 */
export function AnalysisFormContainer() {
  const { state, lineCount, isFormValid, updateMetadata, updateDiffContent, handleGenerate } = useAnalysisForm();

  const { metadata, diffContent, isGenerating, metadataErrors, diffError } = state;

  const isFormDisabled = isGenerating;

  return (
    <div className="space-y-6" aria-busy={isGenerating}>
      {/* Formularz metadanych i diff */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleGenerate();
        }}
        className="space-y-6"
      >
        {/* Pola metadanych */}
        <section aria-label="Metadane analizy">
          <MetadataFields
            values={metadata}
            errors={metadataErrors}
            disabled={isFormDisabled}
            onChange={updateMetadata}
          />
        </section>

        {/* Pole diff */}
        <section aria-label="Zawartość diff">
          <DiffInput
            value={diffContent}
            lineCount={lineCount}
            error={diffError}
            disabled={isFormDisabled}
            onChange={updateDiffContent}
          />
        </section>

        {/* Przycisk akcji */}
        <ActionButtons isFormValid={isFormValid} isGenerating={isGenerating} />
      </form>

      {/* Loader podczas generowania */}
      {isGenerating && (
        <div className="mt-8">
          <AiLoader />
        </div>
      )}
    </div>
  );
}
