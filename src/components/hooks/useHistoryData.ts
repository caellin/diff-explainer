import { useState, useCallback, useEffect, useMemo } from "react";
import type {
  AnalysisListItemDTO,
  AnalysisListResponseDTO,
  DeleteAnalysesResponseDTO,
  DeleteState,
  GetAnalysesQuery,
  HistoryDataState,
  HistoryFiltersState,
  HistoryQueryState,
  HistorySortState,
  PaginationMeta,
  AllowedLimit,
  SortField,
  SortDirection,
} from "@/types";
import { ALLOWED_LIMITS, DEFAULT_LIMIT, DEFAULT_PAGE, DEFAULT_SORT_FIELD, DEFAULT_SORT_ORDER } from "@/lib/constants";

/**
 * Wartość zwracana przez hook useHistoryData.
 */
export interface UseHistoryDataReturn {
  // Dane
  data: AnalysisListItemDTO[] | null;
  meta: PaginationMeta | null;

  // Stan
  isLoading: boolean;
  error: string | null;
  query: HistoryQueryState;

  // Stan usuwania
  deleteState: DeleteState;

  // Akcje
  setPage: (page: number) => void;
  setLimit: (limit: AllowedLimit) => void;
  setFilters: (filters: HistoryFiltersState) => void;
  setSort: (sort: HistorySortState) => void;
  search: () => void;
  refetch: () => void;

  // Akcje usuwania
  openDeleteDialog: (analysis: AnalysisListItemDTO) => void;
  closeDeleteDialog: () => void;
  confirmDelete: () => Promise<void>;

  // Pomocnicze
  hasActiveFilters: boolean;
  clearFilters: () => void;
}

/**
 * Pobiera parametry query z URL.
 */
function getQueryFromUrl(): Partial<HistoryQueryState> {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);
  const result: Partial<HistoryQueryState> = {};

  const page = parseInt(params.get("page") || "", 10);
  if (!isNaN(page) && page >= 1) {
    result.page = page;
  }

  const limit = parseInt(params.get("limit") || "", 10);
  if (!isNaN(limit) && ALLOWED_LIMITS.includes(limit as AllowedLimit)) {
    result.limit = limit as AllowedLimit;
  }

  const statusId = parseInt(params.get("status_id") || "", 10);
  const search = params.get("search") || "";
  if (!isNaN(statusId) || search) {
    result.filters = {
      search: search,
      statusId: !isNaN(statusId) ? statusId : null,
    };
  }

  const sortField = params.get("sort_field");
  const sortOrder = params.get("sort_order");
  if (sortField || sortOrder) {
    result.sort = {
      field: (sortField as SortField) || DEFAULT_SORT_FIELD,
      order: (sortOrder as SortDirection) || DEFAULT_SORT_ORDER,
    };
  }

  return result;
}

/**
 * Zapisuje parametry query do URL.
 */
function setQueryToUrl(query: HistoryQueryState): void {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams();

  if (query.page !== DEFAULT_PAGE) {
    params.set("page", String(query.page));
  }
  if (query.limit !== DEFAULT_LIMIT) {
    params.set("limit", String(query.limit));
  }
  if (query.filters.search) {
    params.set("search", query.filters.search);
  }
  if (query.filters.statusId !== null) {
    params.set("status_id", String(query.filters.statusId));
  }
  if (query.sort.field !== DEFAULT_SORT_FIELD) {
    params.set("sort_field", query.sort.field);
  }
  if (query.sort.order !== DEFAULT_SORT_ORDER) {
    params.set("sort_order", query.sort.order);
  }

  const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;

  window.history.replaceState(null, "", newUrl);
}

/**
 * Funkcja do pobierania analiz z API.
 */
async function fetchAnalyses(query: GetAnalysesQuery): Promise<AnalysisListResponseDTO> {
  const params = new URLSearchParams();

  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 10));

  if (query.status_id) params.set("status_id", String(query.status_id));
  if (query.search) params.set("search", query.search);
  if (query.sort_field) params.set("sort_field", query.sort_field);
  if (query.sort_order) params.set("sort_order", query.sort_order);

  const response = await fetch(`/api/analysis/all?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    if (response.status === 401) {
      throw new Error(error.error || "Sesja wygasła. Zaloguj się ponownie.");
    }

    throw new Error(error.error || "Nie udało się pobrać analiz");
  }

  return response.json();
}

/**
 * Funkcja do usuwania analizy.
 */
async function deleteAnalysis(id: string): Promise<DeleteAnalysesResponseDTO> {
  const response = await fetch("/api/analysis", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids: [id] }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    if (response.status === 401) {
      throw new Error(error.error || "Sesja wygasła. Zaloguj się ponownie.");
    }

    throw new Error(error.error || "Nie udało się usunąć analizy");
  }

  return response.json();
}

/**
 * Domyślny stan query.
 */
function getDefaultQueryState(): HistoryQueryState {
  return {
    page: DEFAULT_PAGE,
    limit: DEFAULT_LIMIT,
    filters: {
      search: "",
      statusId: null,
    },
    sort: {
      field: DEFAULT_SORT_FIELD,
      order: DEFAULT_SORT_ORDER,
    },
  };
}

/**
 * Custom hook do zarządzania stanem widoku historii.
 */
export function useHistoryData(): UseHistoryDataReturn {
  // Inicjalizacja stanu z URL
  const [query, setQuery] = useState<HistoryQueryState>(() => {
    const defaultState = getDefaultQueryState();
    const urlParams = getQueryFromUrl();
    return {
      ...defaultState,
      ...urlParams,
      filters: {
        ...defaultState.filters,
        ...urlParams.filters,
      },
      sort: {
        ...defaultState.sort,
        ...urlParams.sort,
      },
    };
  });

  // Stan danych
  const [dataState, setDataState] = useState<HistoryDataState>({
    data: null,
    meta: null,
    isLoading: true,
    error: null,
  });

  // Stan usuwania
  const [deleteState, setDeleteState] = useState<DeleteState>({
    isDialogOpen: false,
    analysisToDelete: null,
    isDeleting: false,
  });

  // Stan do śledzenia wartości inputu wyszukiwania (jeszcze nie zastosowany)
  const [pendingSearch, setPendingSearch] = useState(query.filters.search);

  // Fetch trigger - inkrementowany przy każdym refetch
  const [fetchTrigger, setFetchTrigger] = useState(0);

  // Sprawdza czy są aktywne filtry
  const hasActiveFilters = useMemo(() => {
    return query.filters.search !== "" || query.filters.statusId !== null;
  }, [query.filters]);

  // Pobieranie danych
  useEffect(() => {
    let isCancelled = false;

    const load = async () => {
      setDataState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const apiQuery: GetAnalysesQuery = {
          page: query.page,
          limit: query.limit,
          search: query.filters.search || undefined,
          status_id: query.filters.statusId ?? undefined,
          sort_field: query.sort.field,
          sort_order: query.sort.order,
        };

        const result = await fetchAnalyses(apiQuery);

        if (!isCancelled) {
          setDataState({
            data: result.data,
            meta: result.meta,
            isLoading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!isCancelled) {
          setDataState((prev) => ({
            ...prev,
            isLoading: false,
            error: err instanceof Error ? err.message : "Wystąpił nieznany błąd",
          }));
        }
      }
    };

    load();

    return () => {
      isCancelled = true;
    };
  }, [
    query.page,
    query.limit,
    query.filters.search,
    query.filters.statusId,
    query.sort.field,
    query.sort.order,
    fetchTrigger,
  ]);

  // Synchronizacja z URL
  useEffect(() => {
    setQueryToUrl(query);
  }, [query]);

  // Akcje
  const setPage = useCallback((page: number) => {
    setQuery((prev) => ({ ...prev, page }));
  }, []);

  const setLimit = useCallback((limit: AllowedLimit) => {
    setQuery((prev) => ({ ...prev, limit, page: 1 }));
  }, []);

  const setFilters = useCallback(
    (filters: HistoryFiltersState) => {
      setPendingSearch(filters.search);
      // Zmiana statusu natychmiast wyzwala fetch
      if (filters.statusId !== query.filters.statusId) {
        setQuery((prev) => ({
          ...prev,
          filters: { ...prev.filters, statusId: filters.statusId },
          page: 1,
        }));
      }
    },
    [query.filters.statusId]
  );

  const setSort = useCallback((sort: HistorySortState) => {
    setQuery((prev) => ({ ...prev, sort }));
  }, []);

  const search = useCallback(() => {
    setQuery((prev) => ({
      ...prev,
      filters: { ...prev.filters, search: pendingSearch },
      page: 1,
    }));
  }, [pendingSearch]);

  const refetch = useCallback(() => {
    setFetchTrigger((prev) => prev + 1);
  }, []);

  const clearFilters = useCallback(() => {
    setPendingSearch("");
    setQuery((prev) => ({
      ...prev,
      filters: { search: "", statusId: null },
      page: 1,
    }));
  }, []);

  // Akcje usuwania
  const openDeleteDialog = useCallback((analysis: AnalysisListItemDTO) => {
    setDeleteState({
      isDialogOpen: true,
      analysisToDelete: analysis,
      isDeleting: false,
    });
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteState({
      isDialogOpen: false,
      analysisToDelete: null,
      isDeleting: false,
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteState.analysisToDelete) return;

    setDeleteState((prev) => ({ ...prev, isDeleting: true }));

    try {
      await deleteAnalysis(deleteState.analysisToDelete.id);

      // Sukces - zamknij dialog i odśwież
      closeDeleteDialog();

      // Jeśli usunięto ostatni element na stronie > 1, cofnij stronę
      if (dataState.data?.length === 1 && query.page > 1) {
        setPage(query.page - 1);
      } else {
        refetch();
      }

      return; // Sukces - komponent wyświetli toast
    } catch (err) {
      setDeleteState((prev) => ({ ...prev, isDeleting: false }));
      throw err; // Przekaż błąd do komponentu
    }
  }, [deleteState.analysisToDelete, closeDeleteDialog, dataState.data?.length, query.page, setPage, refetch]);

  return {
    // Dane
    data: dataState.data,
    meta: dataState.meta,

    // Stan
    isLoading: dataState.isLoading,
    error: dataState.error,
    query: {
      ...query,
      filters: {
        ...query.filters,
        search: pendingSearch, // Zwracamy pending search dla inputu
      },
    },

    // Stan usuwania
    deleteState,

    // Akcje
    setPage,
    setLimit,
    setFilters,
    setSort,
    search,
    refetch,

    // Akcje usuwania
    openDeleteDialog,
    closeDeleteDialog,
    confirmDelete,

    // Pomocnicze
    hasActiveFilters,
    clearFilters,
  };
}
