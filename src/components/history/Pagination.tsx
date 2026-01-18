import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALLOWED_LIMITS } from "@/lib/constants";
import type { AllowedLimit, PaginationMeta } from "@/types";

interface PaginationProps {
  meta: PaginationMeta;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: AllowedLimit) => void;
  isLoading: boolean;
}

/**
 * Kontrolki paginacji wyświetlane na górze i dole tabeli.
 * Zawierają informację o aktualnej stronie, przyciski nawigacji i dropdown do zmiany limitu.
 */
export function Pagination({ meta, limit, onPageChange, onLimitChange, isLoading }: PaginationProps) {
  const { total, page } = meta;
  const totalPages = Math.ceil(total / limit);

  // Obliczenie zakresu wyświetlanych elementów
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  const isPrevDisabled = page <= 1 || isLoading;
  const isNextDisabled = page >= totalPages || isLoading;

  const handlePrevClick = () => {
    if (!isPrevDisabled) {
      onPageChange(page - 1);
    }
  };

  const handleNextClick = () => {
    if (!isNextDisabled) {
      onPageChange(page + 1);
    }
  };

  const handleLimitChange = (value: string) => {
    const newLimit = parseInt(value, 10) as AllowedLimit;
    onLimitChange(newLimit);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-muted-foreground">
        {total === 0 ? (
          <span>Brak wyników</span>
        ) : (
          <span>
            {startItem}-{endItem} z {total}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground hidden sm:inline">Na stronie:</span>
          <Select value={String(limit)} onValueChange={handleLimitChange} disabled={isLoading}>
            <SelectTrigger className="w-[70px]" size="sm" aria-label="Liczba wyników na stronę">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALLOWED_LIMITS.map((l) => (
                <SelectItem key={l} value={String(l)}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevClick}
            disabled={isPrevDisabled}
            aria-label="Poprzednia strona"
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-sm text-muted-foreground min-w-[80px] text-center">
            {totalPages === 0 ? "0 / 0" : `${page} / ${totalPages}`}
          </span>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNextClick}
            disabled={isNextDisabled}
            aria-label="Następna strona"
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
