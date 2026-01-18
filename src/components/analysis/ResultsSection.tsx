import type { AIResponse } from "@/types";
import type { ResultsSectionProps } from "./types";
import { ResultCard } from "./ResultCard";

/**
 * Mapowanie kluczy AIResponse na tytuły kart.
 */
const SECTION_TITLES: Record<keyof AIResponse, string> = {
  summary: "Podsumowanie zmian",
  risks: "Potencjalne ryzyka",
  tests: "Plan testów",
};

/**
 * Kontener wyświetlający trzy karty z wynikami wygenerowanymi przez AI.
 * Renderowany warunkowo po otrzymaniu odpowiedzi.
 * Obsługuje tryb edycji i wyświetlanie błędów walidacji.
 */
export function ResultsSection({ aiResponse, isEditable = false, onEdit, errors }: ResultsSectionProps) {
  const sections: (keyof AIResponse)[] = ["summary", "risks", "tests"];

  return (
    <section aria-label="Wyniki analizy AI" className="space-y-4">
      <h2 className="text-xl font-semibold">Wyniki analizy</h2>
      <div className="grid gap-4">
        {sections.map((section) => (
          <ResultCard
            key={section}
            title={SECTION_TITLES[section]}
            content={aiResponse[section]}
            isEditable={isEditable}
            onEdit={isEditable && onEdit ? (value) => onEdit(section, value) : undefined}
            error={errors?.[section]}
          />
        ))}
      </div>
    </section>
  );
}
