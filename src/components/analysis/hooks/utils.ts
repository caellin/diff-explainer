import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { AIResponse } from "@/types";
import type { MetadataValues } from "../types";

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Waliduje pojedyncze pole metadanych.
 */
export function validateMetadataField(field: keyof MetadataValues, value: string): string | null {
  const trimmed = value.trim();

  switch (field) {
    case "pr_name":
      if (!trimmed) return "Nazwa PR jest wymagana";
      return null;

    case "branch_name":
      if (!trimmed) return "Nazwa brancha jest wymagana";
      if (trimmed.length > 255) return "Nazwa brancha może mieć max 255 znaków";
      return null;

    case "ticket_id":
      if (trimmed.length > 255) return "ID ticketa może mieć max 255 znaków";
      return null;

    default:
      return null;
  }
}

/**
 * Waliduje pojedyncze pole AI response.
 */
export function validateAiResponseField(field: keyof AIResponse, value: string): string | null {
  const trimmed = value.trim();

  const fieldNames: Record<keyof AIResponse, string> = {
    summary: "Podsumowanie",
    risks: "Ryzyka",
    tests: "Plan testów",
  };

  if (!trimmed) {
    return `${fieldNames[field]} nie może być puste`;
  }

  return null;
}

/**
 * Sprawdza czy metadane są poprawne.
 */
export function isMetadataValid(metadata: MetadataValues): boolean {
  if (!metadata.pr_name.trim()) return false;
  if (!metadata.branch_name.trim()) return false;
  if (metadata.branch_name.trim().length > 255) return false;
  if (metadata.ticket_id.trim().length > 255) return false;
  return true;
}

// ============================================================================
// AI RESPONSE HELPERS
// ============================================================================

/**
 * Sprawdza czy ai_response jest puste (draft).
 */
export function isEmptyAIResponse(aiResponse: AIResponse | Record<string, never> | null): boolean {
  if (!aiResponse) return true;
  return !("summary" in aiResponse) || !aiResponse.summary;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Obsługuje błędy sieciowe i wyświetla odpowiedni toast.
 */
export function handleNetworkError(error: unknown): string {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    toast.error("Brak połączenia z serwerem. Sprawdź połączenie internetowe.");
    return "Brak połączenia z serwerem";
  }

  const message = error instanceof Error ? error.message : "Wystąpił nieoczekiwany błąd";
  toast.error(message);
  return message;
}

/**
 * Obsługuje błąd 401 - przekierowanie na login.
 */
export function handleUnauthorized(): void {
  toast.error("Sesja wygasła. Zaloguj się ponownie.");
  window.location.href = "/login";
}

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

/**
 * Hook do ochrony przed utratą niezapisanych zmian (beforeunload).
 */
export function useBeforeUnload(isDirty: boolean): React.MutableRefObject<boolean> {
  const isIntentionalNavigationRef = useRef(false);

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isIntentionalNavigationRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  return isIntentionalNavigationRef;
}
