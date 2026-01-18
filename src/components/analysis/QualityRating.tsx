import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { QualityRatingProps } from "./types";

/**
 * Konfiguracja opcji oceny jakości.
 */
const RATING_OPTIONS = [
  { value: "1", label: "Brak oceny (draft)" },
  { value: "2", label: "Wymaga poprawek" },
  { value: "3", label: "Zaakceptowana" },
] as const;

/**
 * Dropdown do oceny jakości wygenerowanej analizy.
 */
export function QualityRating({ value, disabled, onChange }: QualityRatingProps) {
  const handleValueChange = (newValue: string) => {
    const statusId = parseInt(newValue, 10);
    if (!isNaN(statusId)) {
      onChange(statusId);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="quality-rating">Ocena jakości</Label>
      <Select value={value?.toString() || "1"} onValueChange={handleValueChange} disabled={disabled}>
        <SelectTrigger id="quality-rating" className="w-full max-w-xs">
          <SelectValue placeholder="Wybierz ocenę" />
        </SelectTrigger>
        <SelectContent>
          {RATING_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
