import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, Code, Pencil, AlertCircle } from "lucide-react";
import type { ResultCardProps } from "./types";

type ViewMode = "preview" | "source" | "edit";

/**
 * Konfiguracja przycisków dla każdego trybu widoku.
 */
const VIEW_MODE_CONFIG: Record<ViewMode, { icon: typeof Eye; label: string; nextMode: ViewMode }> = {
  preview: { icon: Code, label: "Źródło", nextMode: "source" },
  source: { icon: Eye, label: "Podgląd", nextMode: "preview" },
  edit: { icon: Eye, label: "Podgląd", nextMode: "preview" },
};

/**
 * Pojedyncza karta wyświetlająca jedną sekcję wyniku AI.
 * Obsługuje przełączanie między widokiem renderowanego markdown, źródłowym i edycji.
 * Używa komponentu Card z shadcn/ui.
 */
export function ResultCard({ title, content, isEditable = false, onEdit, error }: ResultCardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("preview");

  const cycleViewMode = () => {
    setViewMode((prev) => VIEW_MODE_CONFIG[prev].nextMode);
  };

  const setEditMode = () => {
    setViewMode("edit");
  };

  const { icon: CurrentIcon, label: buttonLabel } = VIEW_MODE_CONFIG[viewMode];

  return (
    <Card className="gap-1">
      <CardHeader className="pb-1 flex flex-row items-center justify-between">
        <CardTitle className="text-lg">{title}</CardTitle>
        <div className="flex items-center gap-1">
          {/* Przycisk przełączania preview/source */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={cycleViewMode}
            className="h-8 px-2"
            aria-label={viewMode === "preview" ? "Pokaż źródło markdown" : "Pokaż podgląd"}
          >
            <CurrentIcon className="h-4 w-4 mr-1" />
            <span className="text-xs">{buttonLabel}</span>
          </Button>

          {/* Przycisk edycji - tylko gdy isEditable i nie jesteśmy w trybie edycji */}
          {isEditable && onEdit && viewMode !== "edit" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={setEditMode}
              className="h-8 px-2"
              aria-label={`Edytuj ${title}`}
            >
              <Pencil className="h-4 w-4 mr-1" />
              <span className="text-xs">Edytuj</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {viewMode === "edit" && onEdit ? (
          <textarea
            className={`w-full min-h-[120px] p-3 font-mono text-sm border rounded-md resize-y bg-background ${
              error ? "border-destructive focus-visible:ring-destructive" : ""
            }`}
            value={content}
            onChange={(e) => onEdit(e.target.value)}
            aria-label={`Edytuj ${title}`}
            aria-invalid={!!error}
          />
        ) : viewMode === "preview" ? (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed bg-muted/50 p-4 rounded-md overflow-auto">
            {content}
          </pre>
        )}

        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
