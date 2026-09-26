import type { DataTableColumn } from "./types";

/** Width of a column that does not declare a `minWidth`, in pixels. */
const DEFAULT_COLUMN_WIDTH = 140;

/** The control at the end of each row that reveals the columns that did not fit. */
const DETAILS_CONTROL_WIDTH = 40;

/** Columns without a `priority` are the first to move into the row details. */
const LOWEST_PRIORITY = Number.MAX_SAFE_INTEGER;

export function columnWidth<T>(column: DataTableColumn<T>): number {
	return column.minWidth ?? DEFAULT_COLUMN_WIDTH;
}

/**
 * Splits the columns of an adaptive table into those that fit the available width and those shown
 * in the row details instead. Locked columns always stay; the others are kept by priority, and
 * both groups keep the order of `columns`.
 */
export function fitColumns<T>(
	columns: DataTableColumn<T>[],
	width: number,
): { shown: DataTableColumn<T>[]; overflow: DataTableColumn<T>[] } {
	let remaining = width - DETAILS_CONTROL_WIDTH;
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

	return {
		shown: columns.filter((column) => kept.has(column.id)),
		overflow: columns.filter((column) => !kept.has(column.id)),
	};
}
