import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface HistoryTableSkeletonProps {
  /** Liczba wierszy placeholder (domyślnie 10) */
  rows?: number;
}

/**
 * Skeleton loading wyświetlany podczas pobierania danych.
 * Symuluje strukturę tabeli z placeholderami.
 */
export function HistoryTableSkeleton({ rows = 10 }: HistoryTableSkeletonProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[200px]">Nazwa PR</TableHead>
          <TableHead className="hidden md:table-cell">Branch</TableHead>
          <TableHead className="w-[120px]">Status</TableHead>
          <TableHead className="w-[150px]">Data utworzenia</TableHead>
          <TableHead className="w-[140px] text-right">Akcje</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, index) => (
          <TableRow key={index}>
            <TableCell>
              <Skeleton className="h-4 w-[180px]" />
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <Skeleton className="h-4 w-[140px]" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-[90px] rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-[120px]" />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
