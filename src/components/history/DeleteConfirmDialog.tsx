import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AnalysisListItemDTO } from "@/types";

interface DeleteConfirmDialogProps {
  analysis: AnalysisListItemDTO | null;
  isOpen: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Dialog potwierdzenia usunięcia analizy.
 * Wyświetla nazwę PR analizy do usunięcia i wymaga potwierdzenia.
 */
export function DeleteConfirmDialog({ analysis, isOpen, isDeleting, onClose, onConfirm }: DeleteConfirmDialogProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open && !isDeleting) {
      onClose();
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Usuń analizę</AlertDialogTitle>
          <AlertDialogDescription>
            Czy na pewno chcesz usunąć analizę <strong>&quot;{analysis?.pr_name}&quot;</strong>?
            <br />
            <span className="text-destructive">Ta operacja jest nieodwracalna.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Anuluj</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Usuwanie...
              </>
            ) : (
              "Usuń"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
