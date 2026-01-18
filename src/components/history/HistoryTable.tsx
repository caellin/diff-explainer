import { useCallback } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "./StatusBadge";
import { RowActions } from "./RowActions";
import type { AnalysisListItemDTO, HistorySortState, SortField } from "@/types";

interface HistoryTableProps {
  data: AnalysisListItemDTO[];
  sort: HistorySortState;
  onSortChange: (sort: HistorySortState) => void;
  onRowClick: (id: string) => void;
  onDeleteClick: (analysis: AnalysisListItemDTO) => void;
  deletingId: string | null;
}

interface SortableHeaderProps {
  field: SortField;
  label: string;
  currentSort: HistorySortState;
  onSort: (field: SortField) => void;
  className?: string;
}

/**
 * Nagłówek kolumny z możliwością sortowania.
 */
function SortableHeader({ field, label, currentSort, onSort, className }: SortableHeaderProps) {
  const isActive = currentSort.field === field;
  const order = currentSort.order;

  const handleClick = () => {
    onSort(field);
  };

  const getSortIcon = () => {
    if (!isActive) {
      return <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />;
    }
    return order === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  return (
    <TableHead
      className={`cursor-pointer select-none hover:bg-muted/50 transition-colors ${className ?? ""}`}
      onClick={handleClick}
      aria-sort={isActive ? (order === "asc" ? "ascending" : "descending") : "none"}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {getSortIcon()}
      </div>
    </TableHead>
  );
}

/**
 * Formatuje datę ISO do czytelnego formatu.
 */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Tabela wyświetlająca listę analiz z możliwością sortowania.
 */
export function HistoryTable({ data, sort, onSortChange, onRowClick, onDeleteClick, deletingId }: HistoryTableProps) {
  const handleSort = useCallback(
    (field: SortField) => {
      if (sort.field === field) {
        // Toggle kierunku sortowania
        onSortChange({
          field,
          order: sort.order === "asc" ? "desc" : "asc",
        });
      } else {
        // Nowe pole - domyślnie desc
        onSortChange({
          field,
          order: "desc",
        });
      }
    },
    [sort, onSortChange]
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHeader
            field="pr_name"
            label="Nazwa PR"
            currentSort={sort}
            onSort={handleSort}
            className="w-[200px]"
          />
          <SortableHeader
            field="branch_name"
            label="Branch"
            currentSort={sort}
            onSort={handleSort}
            className="hidden md:table-cell"
          />
          <TableHead className="w-[120px]">Status</TableHead>
          <SortableHeader
            field="created_at"
            label="Data utworzenia"
            currentSort={sort}
            onSort={handleSort}
            className="w-[150px]"
          />
          <TableHead className="w-[140px] text-right">Akcje</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((analysis) => (
          <TableRow
            key={analysis.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => onRowClick(analysis.id)}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onRowClick(analysis.id);
              }
            }}
          >
            <TableCell className="font-medium">{analysis.pr_name}</TableCell>
            <TableCell className="hidden md:table-cell text-muted-foreground">{analysis.branch_name}</TableCell>
            <TableCell>
              <StatusBadge status={analysis.status} />
            </TableCell>
            <TableCell className="text-muted-foreground">{formatDate(analysis.created_at)}</TableCell>
            <TableCell onClick={(e) => e.stopPropagation()}>
              <RowActions
                onViewClick={() => onRowClick(analysis.id)}
                onDeleteClick={() => onDeleteClick(analysis)}
                isDeleting={deletingId === analysis.id}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
