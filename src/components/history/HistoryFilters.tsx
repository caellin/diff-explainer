import { useCallback, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MAX_SEARCH_LENGTH, STATUS_LABELS } from "@/lib/constants";
import type { HistoryFiltersState, StatusDTO } from "@/types";

interface HistoryFiltersProps {
  filters: HistoryFiltersState;
  onFiltersChange: (filters: HistoryFiltersState) => void;
  onSearch: () => void;
  statuses: StatusDTO[];
  isLoading: boolean;
}

/**
 * Sekcja filtrowania i wyszukiwania.
 * Zawiera pole tekstowe do wyszukiwania i dropdown do filtrowania po statusie.
 */
export function HistoryFilters({ filters, onFiltersChange, onSearch, statuses, isLoading }: HistoryFiltersProps) {
  const isSearchTooLong = filters.search.length > MAX_SEARCH_LENGTH;

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({
        ...filters,
        search: e.target.value,
      });
    },
    [filters, onFiltersChange]
  );

  const handleSearchKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !isSearchTooLong && !isLoading) {
        onSearch();
      }
    },
    [onSearch, isSearchTooLong, isLoading]
  );

  const handleSearchClick = useCallback(() => {
    if (!isSearchTooLong && !isLoading) {
      onSearch();
    }
  }, [onSearch, isSearchTooLong, isLoading]);

  const handleStatusChange = useCallback(
    (value: string) => {
      const statusId = value === "all" ? null : parseInt(value, 10);
      onFiltersChange({
        ...filters,
        statusId,
      });
    },
    [filters, onFiltersChange]
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1">
        <label htmlFor="search-input" className="text-sm font-medium text-foreground">
          Szukaj
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="search-input"
              type="text"
              placeholder="Nazwa PR lub branch..."
              value={filters.search}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              disabled={isLoading}
              className={isSearchTooLong ? "border-destructive focus-visible:ring-destructive" : ""}
              aria-invalid={isSearchTooLong}
              aria-describedby={isSearchTooLong ? "search-error" : undefined}
            />
            {isSearchTooLong && (
              <p id="search-error" className="text-xs text-destructive mt-1">
                Maksymalnie {MAX_SEARCH_LENGTH} znaków
              </p>
            )}
          </div>
          <Button onClick={handleSearchClick} disabled={isSearchTooLong || isLoading} aria-label="Szukaj">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline ml-2">Szukaj</span>
          </Button>
        </div>
      </div>

      <div className="space-y-1 sm:w-[180px]">
        <label htmlFor="status-filter" className="text-sm font-medium text-foreground">
          Status
        </label>
        <Select
          value={filters.statusId !== null ? String(filters.statusId) : "all"}
          onValueChange={handleStatusChange}
          disabled={isLoading}
        >
          <SelectTrigger id="status-filter" className="w-full" aria-label="Filtruj po statusie">
            <SelectValue placeholder="Wszystkie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            {statuses.map((status) => (
              <SelectItem key={status.id} value={String(status.id)}>
                {STATUS_LABELS[status.code] ?? status.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
