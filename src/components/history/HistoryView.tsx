import { useCallback } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useHistoryData } from "@/components/hooks/useHistoryData";
import { HistoryFilters } from "./HistoryFilters";
import { HistoryTable } from "./HistoryTable";
import { HistoryTableSkeleton } from "./HistoryTableSkeleton";
import { Pagination } from "./Pagination";
import { EmptyState } from "./EmptyState";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import type { StatusDTO, AllowedLimit, HistorySortState } from "@/types";

interface HistoryViewProps {
  initialStatuses: StatusDTO[];
}

/**
 * Główny kontener React dla widoku historii.
 * Zarządza stanem, pobiera dane z API i koordynuje interakcje między komponentami.
 */
export function HistoryView({ initialStatuses }: HistoryViewProps) {
  const {
    data,
    meta,
    isLoading,
    error,
    query,
    deleteState,
    setPage,
    setLimit,
    setFilters,
    setSort,
    search,
    refetch,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDelete,
    hasActiveFilters,
    clearFilters,
  } = useHistoryData();

  const handleRowClick = useCallback((id: string) => {
    window.location.href = `/analysis/${id}`;
  }, []);

  const handleCreateClick = useCallback(() => {
    window.location.href = "/analysis/new";
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    try {
      await confirmDelete();
      toast.success("Analiza została usunięta");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nie udało się usunąć analizy";
      toast.error(message);
    }
  }, [confirmDelete]);

  const handleLimitChange = useCallback(
    (limit: AllowedLimit) => {
      setLimit(limit);
    },
    [setLimit]
  );

  const handleSortChange = useCallback(
    (sort: HistorySortState) => {
      setSort(sort);
    },
    [setSort]
  );

  // Render error state
  if (error && !isLoading && !data) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={refetch}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Spróbuj ponownie
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Determine if we should show empty state
  const showEmptyState = !isLoading && data && data.length === 0;
  const showTable = !isLoading && data && data.length > 0;
  const showSkeleton = isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Historia analiz</h1>
        <p className="text-muted-foreground">Przeglądaj i zarządzaj swoimi analizami PR</p>
      </div>

      {/* Filters */}
      <HistoryFilters
        filters={query.filters}
        onFiltersChange={setFilters}
        onSearch={search}
        statuses={initialStatuses}
        isLoading={isLoading}
      />

      {/* Top Pagination - only show when we have data */}
      {meta && meta.total > 0 && (
        <Pagination
          meta={meta}
          limit={query.limit}
          onPageChange={setPage}
          onLimitChange={handleLimitChange}
          isLoading={isLoading}
        />
      )}

      {/* Content */}
      <div className="rounded-md border">
        {showSkeleton && <HistoryTableSkeleton rows={query.limit} />}

        {showTable && (
          <HistoryTable
            data={data}
            sort={query.sort}
            onSortChange={handleSortChange}
            onRowClick={handleRowClick}
            onDeleteClick={openDeleteDialog}
            deletingId={deleteState.isDeleting ? deleteState.analysisToDelete?.id ?? null : null}
          />
        )}

        {showEmptyState && (
          <EmptyState
            onCreateClick={handleCreateClick}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
          />
        )}
      </div>

      {/* Bottom Pagination - only show when we have data */}
      {meta && meta.total > 0 && (
        <Pagination
          meta={meta}
          limit={query.limit}
          onPageChange={setPage}
          onLimitChange={handleLimitChange}
          isLoading={isLoading}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        analysis={deleteState.analysisToDelete}
        isOpen={deleteState.isDialogOpen}
        isDeleting={deleteState.isDeleting}
        onClose={closeDeleteDialog}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
