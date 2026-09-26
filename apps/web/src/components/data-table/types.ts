import type { ReactNode } from "react";

export type SortDirection = "asc" | "desc";

export interface DataTableSort {
	columnId: string;
	direction: SortDirection;
}

/** Everything the toolbar, the header and the pagination of a table can change. */
export interface DataTableState {
	search: string;
	sort: DataTableSort | null;
	/** Selected values per filter id; an empty list means "no restriction". */
	filters: Record<string, string[]>;
	/** One-based. */
	page: number;
	pageSize: number;
	/** Column ids hidden through the column menu. */
	hiddenColumns: string[];
}

export type SortableValue = string | number | boolean | Date | null | undefined;

export interface DataTableColumn<T> {
	id: string;
	header: ReactNode;
	cell: (row: T) => ReactNode;
	/**
	 * The plain value behind the cell. Sorting and the search box work on it, so a column without
	 * it can neither be sorted nor searched.
	 */
	value?: (row: T) => SortableValue;
	sortable?: boolean;
	/** Excluded from the search even though the column has a value, e.g. an opaque id. */
	searchable?: boolean;
	/** Hidden below this breakpoint; useful for secondary columns on narrow screens. */
	hideBelow?: "sm" | "md" | "lg" | "xl";
	/**
	 * Hidden until the column menu enables it. Only applies to a table that keeps its own state;
	 * a controlled table seeds `hiddenColumns` instead.
	 */
	hiddenByDefault?: boolean;
	/** Always visible; not offered in the column menu (typically the column naming the row). */
	locked?: boolean;
	align?: "start" | "end";
	className?: string;
	headerClassName?: string;
	/** A `width` style for the column, e.g. `"12rem"` or `"1%"` for a shrink-to-fit cell. */
	width?: string;
	/** Narrowest width in pixels at which an adaptive table still shows the column. */
	minWidth?: number;
	/** The order in which an adaptive table keeps its columns when space runs out; lower comes first. */
	priority?: number;
	/**
	 * Absorbs the remaining width and truncates instead of widening the table. Exactly one column
	 * per table should carry it — usually the one naming the row.
	 */
	flexible?: boolean;
}

export interface DataTableFilter<T> {
	id: string;
	label: string;
	options: { value: string; label: string; icon?: ReactNode }[];
	/** The value of a row for this filter; used for client-side filtering. */
	value?: (row: T) => string | string[];
}
