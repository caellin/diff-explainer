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
import type { DeleteAnalysisDialogProps } from "./types";

/**
 * Dialog potwierdzenia usunięcia analizy w widoku szczegółów.
 * Wyświetla nazwę PR dla jasności kontekstu.
 */
export function DeleteAnalysisDialog({ isOpen, prName, isDeleting, onConfirm, onCancel }: DeleteAnalysisDialogProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open && !isDeleting) {
      onCancel();
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Usuń analizę</AlertDialogTitle>
          <AlertDialogDescription>
            Czy na pewno chcesz usunąć analizę <strong>&quot;{prName}&quot;</strong>?
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
