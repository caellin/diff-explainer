import { Loader2 } from "lucide-react";
import type { AiLoaderProps } from "./types";

/**
 * Pulsujący loader wyświetlany podczas generowania odpowiedzi AI.
 * Informuje użytkownika o trwającym procesie i maksymalnym czasie oczekiwania.
 */
export function AiLoader({ message = "Analizuję zmiany..." }: AiLoaderProps) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-12 gap-4">
      <div className="relative">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <div className="absolute inset-0 h-12 w-12 animate-ping opacity-20 rounded-full bg-primary" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-lg font-medium">{message}</p>
        <p className="text-sm text-muted-foreground">Może to potrwać do 60 sekund</p>
      </div>
    </div>
  );
}
