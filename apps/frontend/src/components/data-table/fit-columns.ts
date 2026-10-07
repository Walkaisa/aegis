import type { DataTableColumn } from "./types";

/** Width of a column that does not declare a `minWidth`, in pixels. */
const DEFAULT_COLUMN_WIDTH = 140;

/** Columns without a `priority` are the first to be left out. */
const LOWEST_PRIORITY = Number.MAX_SAFE_INTEGER;

export function columnWidth<T>(column: DataTableColumn<T>): number {
	return column.minWidth ?? DEFAULT_COLUMN_WIDTH;
}

/**
 * The columns of an adaptive table that fit the available width. Locked columns always stay; the
 * others are kept by priority, in the order of `columns`.
 */
export function fitColumns<T>(columns: DataTableColumn<T>[], width: number): DataTableColumn<T>[] {
	let remaining = width;
	const kept = new Set<string>();

	for (const column of columns.filter((column) => column.locked)) {
		kept.add(column.id);
		remaining -= columnWidth(column);
	}

	const optional = columns
		.filter((column) => !column.locked)
		.sort((a, b) => (a.priority ?? LOWEST_PRIORITY) - (b.priority ?? LOWEST_PRIORITY));
	for (const column of optional) {
		if (columnWidth(column) <= remaining) {
			kept.add(column.id);
			remaining -= columnWidth(column);
		}
	}

	return columns.filter((column) => kept.has(column.id));
}
