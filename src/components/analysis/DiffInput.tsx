import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiffInputProps } from "./types";
import { MAX_DIFF_LINES } from "./types";

/**
 * Pole tekstowe dla zawartości diffu git z licznikiem linii.
 * Font monospace dla lepszej czytelności kodu.
 */
export function DiffInput({ value, lineCount, error, disabled, onChange }: DiffInputProps) {
  const isOverLimit = lineCount > MAX_DIFF_LINES;

  return (
    <div className="space-y-2">
      <Label htmlFor="diff-content">
        Diff git <span className="text-destructive">*</span>
      </Label>

      <Textarea
        id="diff-content"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={`Wklej zawartość diffu git...\n\nPrzykład:\ndiff --git a/src/file.ts b/src/file.ts\n--- a/src/file.ts\n+++ b/src/file.ts\n@@ -1,3 +1,4 @@\n+// new line\n const x = 1;`}
        className={cn(
          "font-mono text-[13px] resize-y",
          "min-h-[200px] md:min-h-[250px] lg:min-h-[300px]",
          "max-h-[800px] overflow-y-auto",
          error && "border-destructive focus-visible:ring-destructive"
        )}
        aria-required="true"
        aria-invalid={!!error}
        aria-describedby={error ? "diff-error" : "diff-counter"}
      />

      <div className="flex items-center justify-between text-sm">
        <div
          id="diff-counter"
          className={cn("tabular-nums", isOverLimit ? "text-destructive font-medium" : "text-muted-foreground")}
        >
          {lineCount} / {MAX_DIFF_LINES} linii
        </div>
      </div>

      {error && (
        <Alert variant="destructive" id="diff-error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
