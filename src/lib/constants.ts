import type { AllowedLimit, StatusVariant } from "@/types";

/**
 * Dozwolone wartości limitu na stronę.
 */
export const ALLOWED_LIMITS: AllowedLimit[] = [10, 20, 50];

/**
 * Maksymalna długość wyszukiwania.
 */
export const MAX_SEARCH_LENGTH = 255;

/**
 * Domyślne wartości dla paginacji.
 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT: AllowedLimit = 10;

/**
 * Domyślne wartości dla sortowania.
 */
export const DEFAULT_SORT_FIELD = "created_at" as const;
export const DEFAULT_SORT_ORDER = "desc" as const;

/**
 * Mapowanie kodu statusu na wariant Badge.
 */
export const STATUS_VARIANTS: Record<string, StatusVariant> = {
  draft: "secondary",
  pending_review: "warning",
  completed: "success",
};

/**
 * Polskie etykiety statusów.
 */
export const STATUS_LABELS: Record<string, string> = {
  draft: "Wersja robocza",
  pending_review: "Do weryfikacji",
  completed: "Zaakceptowane",
};
