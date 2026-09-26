"use client";

import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ChevronsUpDown, SearchX } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type CSSProperties, Fragment, type ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DataTablePagination } from "./data-table-pagination";
import { activeFilterCount, DataTableToolbar } from "./data-table-toolbar";
import { columnWidth, fitColumns } from "./fit-columns";
import type { DataTableColumn, DataTableFilter, DataTableState, SortableValue } from "./types";

export type { DataTableColumn, DataTableFilter, DataTableSort, DataTableState } from "./types";

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

export const EMPTY_TABLE_STATE: DataTableState = {
	search: "",
	sort: null,
	filters: {},
	page: 1,
	pageSize: 25,
	hiddenColumns: [],
};

export function createTableState(overrides: Partial<DataTableState> = {}): DataTableState {
	return { ...EMPTY_TABLE_STATE, ...overrides };
}

const HIDE_BELOW_CLASS = {
	sm: "hidden sm:table-cell",
	md: "hidden md:table-cell",
	lg: "hidden lg:table-cell",
	xl: "hidden xl:table-cell",
} as const;

function comparable(value: SortableValue): string | number {
	if (value === null || value === undefined) {
		return "";
	}
	if (value instanceof Date) {
		return value.getTime();
	}
	if (typeof value === "boolean") {
		return value ? 1 : 0;
	}
	return value;
}

function compare(left: SortableValue, right: SortableValue): number {
	const a = comparable(left);
	const b = comparable(right);
	if (typeof a === "number" && typeof b === "number") {
		return a - b;
	}
	return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

function matchesSearch<T>(row: T, columns: DataTableColumn<T>[], term: string): boolean {
	const needle = term.trim().toLocaleLowerCase();
	if (needle.length === 0) {
		return true;
	}
	return columns.some((column) => {
		if (!column.value || column.searchable === false) {
			return false;
		}
		const value = column.value(row);
		return value !== null && value !== undefined && String(comparable(value)).toLocaleLowerCase().includes(needle);
	});
}

function headerStyle<T>(column: DataTableColumn<T>, adaptive: boolean): CSSProperties | undefined {
	if (column.flexible) {
		return adaptive ? undefined : { width: "100%" };
	}
	if (adaptive) {
		return { width: columnWidth(column) };
	}
	return column.width ? { width: column.width } : undefined;
}

function matchesFilters<T>(row: T, filters: DataTableFilter<T>[], selection: Record<string, string[]>): boolean {
	return filters.every((filter) => {
		const selected = selection[filter.id] ?? [];
		if (selected.length === 0 || !filter.value) {
			return true;
		}
		const value = filter.value(row);
		return Array.isArray(value) ? value.some((entry) => selected.includes(entry)) : selected.includes(value);
	});
}

export interface DataTableProps<T> {
	columns: DataTableColumn<T>[];
	data: T[];
	getRowId: (row: T) => string;
	/** Controlled state; without it the table keeps its own. */
	state?: DataTableState;
	onStateChange?: (state: DataTableState) => void;
	defaultState?: Partial<DataTableState>;
	/**
	 * The rows are already searched, filtered, sorted and paged by the server. `total` is then
	 * the number of matches across all pages.
	 */
	manual?: boolean;
	total?: number;
	loading?: boolean;
	filters?: DataTableFilter<T>[];
	searchable?: boolean;
	searchPlaceholder?: string;
	/** Extra controls in the toolbar, e.g. a refresh button. */
	toolbarActions?: ReactNode;
	/** Content above the toolbar, e.g. the severity bar of the audit log. */
	header?: ReactNode;
	/** Makes each row a link to its detail page. */
	rowHref?: (row: T) => string;
	/** Details revealed when a row is clicked; mutually exclusive with `rowHref`. */
	renderExpanded?: (row: T) => ReactNode;
	/** Replaces the table with a card list below `md`. */
	renderCard?: (row: T) => ReactNode;
	emptyTitle?: ReactNode;
	emptyDescription?: ReactNode;
	pageSizeOptions?: number[];
	/** Hides the pagination bar; useful for short, fixed lists. */
	paginated?: boolean;
	className?: string;
	/** Fit columns to the available space and expose remaining fields in row details. */
	adaptive?: boolean;
	/** Accessible name of the table. */
	label?: string;
}

/**
 * The table used for every list in the administration UI: search, sorting, filters, pagination
 * and a column menu, with the same look everywhere. Works on data that is already in the browser
 * (`manual` off) and on server-driven pages (`manual` on).
 */
export function DataTable<T>({
	columns,
	data,
	getRowId,
	state: controlledState,
	onStateChange,
	defaultState,
	manual = false,
	total,
	loading = false,
	filters = [],
	searchable = true,
	searchPlaceholder,
	toolbarActions,
	header,
	rowHref,
	renderExpanded,
	renderCard,
	emptyTitle,
	emptyDescription,
	pageSizeOptions = DEFAULT_PAGE_SIZES,
	paginated = true,
	className,
	adaptive = false,
	label,
}: DataTableProps<T>) {
	const t = useTranslations("table");
	const [internalState, setInternalState] = useState<DataTableState>(() =>
		createTableState({
			hiddenColumns: columns.filter((column) => column.hiddenByDefault && !column.locked).map((column) => column.id),
			...defaultState,
		}),
	);
	const [expanded, setExpanded] = useState<string | null>(null);
	const frameRef = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState<number | null>(null);

	useLayoutEffect(() => {
		const frame = frameRef.current;
		if (!adaptive || !frame) {
			return;
		}
		setWidth(frame.clientWidth);
		const observer = new ResizeObserver(([entry]) => {
			if (entry) {
				setWidth(Math.floor(entry.contentRect.width));
			}
		});
		observer.observe(frame);
		return () => observer.disconnect();
	}, [adaptive]);

	const state = controlledState ?? internalState;
	const setState = (next: Partial<DataTableState>) => {
		const merged = { ...state, ...next };
		if (onStateChange) {
			onStateChange(merged);
		}
		if (!controlledState) {
			setInternalState(merged);
		}
	};

	const visibleColumns = useMemo(
		() => columns.filter((column) => column.locked || !state.hiddenColumns.includes(column.id)),
		[columns, state.hiddenColumns],
	);

	const fitted = adaptive && width !== null ? fitColumns(visibleColumns, width) : { shown: visibleColumns, overflow: [] };
	const canExpand = Boolean(renderExpanded) || fitted.overflow.length > 0;
	const tableColumns = fitted.shown;
	const expandedContent = (row: T) =>
		renderExpanded ? (
			renderExpanded(row)
		) : (
			<dl className="grid min-w-0 gap-x-6 gap-y-4 sm:grid-cols-2">
				{fitted.overflow.map((column) => (
					<div key={column.id} className="min-w-0">
						<dt className="mb-1 text-xs text-muted-foreground">{column.header}</dt>
						<dd className="min-w-0 text-sm [overflow-wrap:anywhere] [&_*]:max-w-full [&_span]:whitespace-normal">
							{column.cell(row)}
						</dd>
					</div>
				))}
			</dl>
		);

	const processed = useMemo(() => {
		if (manual) {
			return data;
		}
		let rows = data.filter((row) => matchesSearch(row, columns, state.search) && matchesFilters(row, filters, state.filters));
		const sort = state.sort;
		if (sort) {
			const column = columns.find((entry) => entry.id === sort.columnId);
			if (column?.value) {
				const accessor = column.value;
				rows = [...rows].sort((a, b) => compare(accessor(a), accessor(b)) * (sort.direction === "asc" ? 1 : -1));
			}
		}
		return rows;
	}, [manual, data, columns, filters, state.search, state.filters, state.sort]);

	const rowTotal = manual ? (total ?? data.length) : processed.length;
	const pageCount = Math.max(1, Math.ceil(rowTotal / state.pageSize));
	const page = Math.min(state.page, pageCount);
	const rows = manual || !paginated ? processed : processed.slice((page - 1) * state.pageSize, page * state.pageSize);

	const filtered = state.search.length > 0 || activeFilterCount(state.filters) > 0;

	/** A first click sorts ascending, every further click on the same column flips the direction. */
	function toggleSort(columnId: string) {
		const current = state.sort;
		const direction = current?.columnId === columnId && current.direction === "asc" ? "desc" : "asc";
		setState({ sort: { columnId, direction }, page: 1 });
	}

	const columnCount = tableColumns.length + (canExpand || rowHref ? 1 : 0);

	return (
		<div className={cn("@container/table flex min-w-0 max-w-full flex-col gap-3", className)}>
			{header}

			{searchable || filters.length > 0 || toolbarActions || columns.some((column) => !column.locked) ? (
				<DataTableToolbar
					state={state}
					onState={setState}
					columns={columns}
					filters={filters}
					searchable={searchable}
					searchPlaceholder={searchPlaceholder}
					actions={toolbarActions}
				/>
			) : null}

			<div ref={frameRef} className="overflow-hidden rounded-xl border bg-card">
				{loading ? (
					<div className="flex flex-col gap-2 p-4" aria-busy="true">
						{["a", "b", "c", "d", "e"].map((key) => (
							<Skeleton key={key} className="h-10 w-full rounded-lg" />
						))}
					</div>
				) : rows.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
						<span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
							<SearchX className="size-5" />
						</span>
						<div className="flex flex-col gap-1">
							<p className="font-medium">{filtered ? t("noMatchesTitle") : (emptyTitle ?? t("emptyTitle"))}</p>
							<p className="max-w-sm text-sm text-muted-foreground">
								{filtered ? t("noMatchesDescription") : (emptyDescription ?? t("emptyDescription"))}
							</p>
						</div>
					</div>
				) : (
					<>
						{renderCard ? (
							<ul className="divide-y md:hidden">
								{rows.map((row) => (
									<li key={getRowId(row)}>
										{rowHref ? (
											<Link
												href={rowHref(row)}
												className="group/row flex items-center gap-3 py-3 pr-5 pl-4 transition-colors hover:bg-muted/40"
											>
												<div className="min-w-0 flex-1">{renderCard(row)}</div>
												<ChevronRight
													className="size-4 shrink-0 text-muted-foreground/60 transition-[color,translate] duration-300 ease-out group-hover/row:translate-x-1 group-hover/row:text-foreground motion-reduce:transition-none"
													aria-hidden="true"
												/>
											</Link>
										) : (
											<div className="overflow-hidden px-3 py-3">{renderCard(row)}</div>
										)}
									</li>
								))}
							</ul>
						) : null}

						<Table className={cn(renderCard && "hidden md:table", adaptive && "table-fixed")} aria-label={label}>
							<TableHeader className="bg-muted/40">
								<TableRow className="hover:bg-transparent">
									{tableColumns.map((column) => {
										const sortable = column.sortable !== false && Boolean(column.value);
										const active = state.sort?.columnId === column.id ? state.sort : null;
										const Icon = !active ? ChevronsUpDown : active.direction === "asc" ? ArrowUp : ArrowDown;
										return (
											<TableHead
												key={column.id}
												style={headerStyle(column, adaptive)}
												aria-sort={active ? (active.direction === "asc" ? "ascending" : "descending") : undefined}
												className={cn(
													"px-3 text-xs font-medium text-muted-foreground",
													column.flexible && "max-w-0",
													adaptive && "overflow-hidden",
													column.align === "end" && "text-right",
													!adaptive && column.hideBelow && HIDE_BELOW_CLASS[column.hideBelow],
													column.headerClassName,
												)}
											>
												{sortable ? (
													<button
														type="button"
														onClick={() => toggleSort(column.id)}
														className={cn(
															"-mx-1.5 inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
															active && "text-foreground",
															column.align === "end" && "flex-row-reverse",
														)}
													>
														{column.header}
														<Icon
															className={cn("size-3.5 shrink-0", !active && "opacity-50")}
															aria-hidden="true"
														/>
													</button>
												) : (
													column.header
												)}
											</TableHead>
										);
									})}
									{canExpand || rowHref ? <TableHead className="w-10 px-2" /> : null}
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.map((row) => {
									const id = getRowId(row);
									const href = rowHref?.(row);
									const open = expanded === id;

									// With a row link every cell is its own link, so the whole row is clickable.
									const cells = tableColumns.map((column) => (
										<TableCell
											key={column.id}
											className={cn(
												"p-0 align-middle",
												column.flexible && "max-w-0",
												adaptive && "overflow-hidden",
												column.align === "end" && "text-right",
												!adaptive && column.hideBelow && HIDE_BELOW_CLASS[column.hideBelow],
												column.className,
											)}
										>
											{href ? (
												<Link href={href} className="block overflow-hidden px-3 py-3 outline-none">
													{column.cell(row)}
												</Link>
											) : (
												<div className="overflow-hidden px-3 py-3">{column.cell(row)}</div>
											)}
										</TableCell>
									));

									return (
										<Fragment key={id}>
											<TableRow
												data-state={open ? "selected" : undefined}
												className={cn(
													"group/row",
													(href || canExpand) && "cursor-pointer",
													open && "border-b-0 bg-muted/40",
												)}
												onClick={
													canExpand
														? (event) => {
																if (!(event.target as HTMLElement).closest("a, button, [role=button]")) {
																	setExpanded(open ? null : id);
																}
															}
														: undefined
												}
											>
												{cells}
												{canExpand ? (
													<TableCell className="w-10 p-0 text-center">
														<button
															type="button"
															aria-label={t("details")}
															aria-expanded={open}
															onClick={() => setExpanded(open ? null : id)}
															className={cn(
																"inline-flex size-8 cursor-pointer items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-ring text-muted-foreground transition-[color,rotate] duration-300 group-hover/row:text-foreground",
																open && "rotate-180",
															)}
														>
															<ChevronDown className="size-4" />
														</button>
													</TableCell>
												) : href ? (
													<TableCell className="w-10 p-0 text-right">
														<Link
															href={href}
															aria-label={t("open")}
															className="flex items-center justify-end py-3 px-3 text-muted-foreground/60 outline-none"
														>
															<ChevronRight
																className="size-4 transition-[color,translate] duration-300 ease-out group-hover/row:translate-x-1 group-hover/row:text-foreground motion-reduce:transition-none"
																aria-hidden="true"
															/>
														</Link>
													</TableCell>
												) : null}
											</TableRow>
											{canExpand && open ? (
												<TableRow className="hover:bg-transparent">
													<TableCell colSpan={columnCount} className="bg-muted/25 px-4 py-4 whitespace-normal">
														{expandedContent(row)}
													</TableCell>
												</TableRow>
											) : null}
										</Fragment>
									);
								})}
							</TableBody>
						</Table>
					</>
				)}

				{paginated && !loading && rowTotal > 0 ? (
					<DataTablePagination
						page={page}
						pageSize={state.pageSize}
						pageSizeOptions={pageSizeOptions}
						total={rowTotal}
						onPage={(next) => setState({ page: next })}
						onPageSize={(next) => setState({ pageSize: next, page: 1 })}
					/>
				) : null}
			</div>
		</div>
	);
}
