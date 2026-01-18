import { Button } from "@/components/ui/button";
import { Save, RefreshCw, Copy, Trash2, Loader2 } from "lucide-react";
import type { ActionButtonsDetailProps } from "./types";

/**
 * Zestaw przycisków akcji dla widoku szczegółów analizy.
 */
export function ActionButtonsDetail({
  isFormValid,
  isDirty,
  isSaving,
  isRegenerating,
  isDeleting,
  hasResults,
  onSave,
  onRegenerate,
  onCopyAll,
  onDelete,
}: ActionButtonsDetailProps) {
  const isSaveDisabled = isSaving || !isFormValid || !isDirty;
  const isRegenerateDisabled = isRegenerating;
  const isDeleteDisabled = isDeleting;
  const isCopyDisabled = !hasResults;

  return (
    <div className="flex flex-wrap gap-3">
      {/* Przycisk Zapisz */}
      <Button type="button" onClick={onSave} disabled={isSaveDisabled} className="gap-2">
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Zapisywanie...
          </>
        ) : (
          <>
            <Save className="h-4 w-4" />
            Zapisz
          </>
        )}
      </Button>

      {/* Przycisk Generuj ponownie */}
      <Button type="button" variant="outline" onClick={onRegenerate} disabled={isRegenerateDisabled} className="gap-2">
        {isRegenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generowanie...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" />
            Generuj ponownie
          </>
        )}
      </Button>

      {/* Przycisk Kopiuj wszystko */}
      <Button type="button" variant="outline" onClick={onCopyAll} disabled={isCopyDisabled} className="gap-2">
        <Copy className="h-4 w-4" />
        Kopiuj wszystko
      </Button>

      {/* Przycisk Usuń */}
      <Button type="button" variant="destructive" onClick={onDelete} disabled={isDeleteDisabled} className="gap-2">
        {isDeleting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Usuwanie...
          </>
        ) : (
          <>
            <Trash2 className="h-4 w-4" />
            Usuń
          </>
        )}
      </Button>
    </div>
  );
}
