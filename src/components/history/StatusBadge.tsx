import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_VARIANTS } from "@/lib/constants";
import type { StatusDTO, StatusVariant } from "@/types";

interface StatusBadgeProps {
  status: StatusDTO;
}

/**
 * Badge wyświetlający status analizy z odpowiednim kolorem wizualnym.
 *
 * Mapowanie kolorów:
 * - draft → secondary (szary)
 * - pending_review → warning (żółty)
 * - completed → success (zielony)
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  const variant: StatusVariant = STATUS_VARIANTS[status.code] ?? "secondary";
  const label = STATUS_LABELS[status.code] ?? status.code;

  return <Badge variant={variant}>{label}</Badge>;
}
