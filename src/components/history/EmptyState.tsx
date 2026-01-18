import { FileText, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  onCreateClick: () => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

/**
 * Stan pustej listy wyświetlany, gdy użytkownik nie ma żadnych analiz
 * lub gdy filtrowanie nie zwróciło wyników.
 */
export function EmptyState({ onCreateClick, hasActiveFilters = false, onClearFilters }: EmptyStateProps) {
  if (hasActiveFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <SearchX className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Brak wyników</h3>
        <p className="text-muted-foreground mb-6 max-w-sm">
          Nie znaleziono analiz pasujących do podanych kryteriów wyszukiwania.
        </p>
        {onClearFilters && (
          <Button variant="outline" onClick={onClearFilters}>
            Wyczyść filtry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Nie masz jeszcze żadnych analiz</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Utwórz swoją pierwszą analizę PR, aby zobaczyć ją na tej liście.
      </p>
      <Button onClick={onCreateClick}>Utwórz pierwszą analizę</Button>
    </div>
  );
}
