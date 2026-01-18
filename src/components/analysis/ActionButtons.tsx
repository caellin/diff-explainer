import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import type { ActionButtonsProps } from "./types";

/**
 * Przycisk akcji formularza - "Generuj i zapisz".
 * Inicjuje generowanie analizy AI i zapisuje ją w bazie.
 */
export function ActionButtons({ isFormValid, isGenerating }: ActionButtonsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button type="submit" disabled={isGenerating || !isFormValid} className="min-w-[160px]">
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generowanie...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Generuj i zapisz
          </>
        )}
      </Button>
    </div>
  );
}
