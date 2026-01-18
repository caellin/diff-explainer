import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { MetadataFieldsProps, MetadataValues } from "./types";

/**
 * Konfiguracja pól formularza metadanych.
 */
const FIELD_CONFIG: {
  key: keyof MetadataValues;
  label: string;
  placeholder: string;
  required: boolean;
}[] = [
  {
    key: "pr_name",
    label: "Nazwa PR",
    placeholder: "np. feat: add user authentication",
    required: true,
  },
  {
    key: "branch_name",
    label: "Nazwa brancha",
    placeholder: "np. feature/user-auth",
    required: true,
  },
  {
    key: "ticket_id",
    label: "ID ticketa",
    placeholder: "np. JIRA-123 (opcjonalne)",
    required: false,
  },
];

/**
 * Grupa pól formularza dla metadanych analizy.
 * Zawiera: nazwa PR, nazwa brancha i opcjonalny identyfikator ticketa.
 */
export function MetadataFields({ values, errors, disabled, onChange }: MetadataFieldsProps) {
  return (
    <div className="space-y-4">
      {FIELD_CONFIG.map(({ key, label, placeholder, required }) => {
        const error = errors[key];
        const inputId = `metadata-${key}`;
        const errorId = `${inputId}-error`;

        return (
          <div key={key} className="space-y-2">
            <Label htmlFor={inputId}>
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </Label>

            <Input
              id={inputId}
              type="text"
              value={values[key]}
              onChange={(e) => onChange(key, e.target.value)}
              disabled={disabled}
              placeholder={placeholder}
              aria-required={required}
              aria-invalid={!!error}
              aria-describedby={error ? errorId : undefined}
              className={error ? "border-destructive focus-visible:ring-destructive" : ""}
            />

            {error && (
              <Alert variant="destructive" id={errorId} className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        );
      })}
    </div>
  );
}
