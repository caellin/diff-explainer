import { Eye, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RowActionsProps {
  onViewClick: () => void;
  onDeleteClick: () => void;
  isDeleting: boolean;
}

/**
 * Komponent zawierający przyciski akcji dla pojedynczego wiersza tabeli.
 */
export function RowActions({ onViewClick, onDeleteClick, isDeleting }: RowActionsProps) {
  return (
    <div className="flex justify-end gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={onViewClick}
        disabled={isDeleting}
        aria-label="Pokaż szczegóły"
        className="h-8 w-8"
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        variant="destructive"
        size="icon"
        onClick={onDeleteClick}
        disabled={isDeleting}
        aria-label="Usuń analizę"
        className="h-8 w-8"
      >
        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}
