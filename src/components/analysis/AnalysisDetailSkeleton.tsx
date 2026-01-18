import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "@/components/ui/card";

/**
 * Skeleton loading dla widoku szczegółów analizy.
 * Symuluje układ strony podczas ładowania danych.
 */
export function AnalysisDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Ładowanie szczegółów analizy">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Metadata fields skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>

      {/* Diff display skeleton */}
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-16" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>

      {/* Quality rating skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-48" />
      </div>

      {/* Results section skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-36" />
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action buttons skeleton */}
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  );
}
