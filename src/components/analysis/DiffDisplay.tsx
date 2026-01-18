import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { DiffDisplayProps } from "./types";

/**
 * Komponent wyświetlający zawartość diffu git w trybie tylko do odczytu.
 * Używa elementu <pre> z fontem monospace dla zachowania formatowania.
 */
export function DiffDisplay({ content, maxHeight = "400px" }: DiffDisplayProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Diff</CardTitle>
      </CardHeader>
      <CardContent>
        <pre
          className="whitespace-pre-wrap break-all font-mono text-[13px] leading-relaxed bg-muted/50 p-4 rounded-md overflow-auto"
          style={{ maxHeight }}
        >
          {content}
        </pre>
      </CardContent>
    </Card>
  );
}
