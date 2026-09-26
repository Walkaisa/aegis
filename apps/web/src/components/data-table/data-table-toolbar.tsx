"use client";

import { ListFilter, RotateCcw, Search, Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import type { DataTableColumn, DataTableFilter, DataTableState } from "./types";

function toggle(values: string[], value: string): string[] {
	return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

export function activeFilterCount(filters: Record<string, string[]>): number {
	return Object.values(filters).reduce((total, values) => total + values.length, 0);
}

/** Search, filters and the column menu above a table. */
export function DataTableToolbar<T>({
	state,
	onState,
	columns,
	filters,
	searchable,
	searchPlaceholder,
	actions,
}: {
	state: DataTableState;
	onState: (next: Partial<DataTableState>) => void;
	columns: DataTableColumn<T>[];
	filters: DataTableFilter<T>[];
	searchable: boolean;
	searchPlaceholder?: string;
	actions?: ReactNode;
}) {
	const t = useTranslations("table");
	const active = activeFilterCount(state.filters);
	const hideable = columns.filter((column) => !column.locked);
	const dirty = active > 0 || state.search.length > 0;

	const reset = dirty ? (
		<Button
			type="button"
			variant="ghost"
			aria-label={t("reset")}
			className="shrink-0 animate-in fade-in-0 slide-in-from-left-1 duration-200"
			onClick={() => onState({ search: "", filters: {}, page: 1 })}
		>
			<RotateCcw />
			<span className="hidden @min-[600px]/table:inline">{t("reset")}</span>
		</Button>
	) : null;

	return (
		<div className="flex min-w-0 flex-wrap items-center gap-2">
			{searchable ? (
				<div
					className={cn(
						"flex min-w-0 flex-1 items-center gap-2",
						(filters.length > 0 || actions) && "basis-full @min-[600px]/table:basis-0",
					)}
				>
					<InputGroup className="min-w-0 flex-1 @max-[600px]/table:h-9">
						<InputGroupAddon>
							<Search />
						</InputGroupAddon>
						<InputGroupInput
							type="search"
							value={state.search}
							onChange={(event) => onState({ search: event.target.value, page: 1 })}
							placeholder={searchPlaceholder ?? t("searchPlaceholder")}
							aria-label={searchPlaceholder ?? t("search")}
						/>
					</InputGroup>
					{reset}
				</div>
			) : (
				<div className="flex flex-1 items-center">{reset}</div>
			)}

			<div
				className={cn(
					"flex min-w-0 flex-wrap items-center gap-2 @min-[600px]/table:shrink-0",
					(filters.length > 0 || actions) && "w-full @min-[600px]/table:w-auto",
				)}
			>
				{actions ? <div className="flex w-full min-w-0 items-center gap-2 @min-[600px]/table:w-auto">{actions}</div> : null}

				{filters.length > 0 ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button type="button" variant="outline" size="sm" className="@max-[600px]/table:h-9 @max-[600px]/table:flex-1">
								<ListFilter />
								{t("filters")}
								{active > 0 ? (
									<span className="ml-0.5 rounded-full bg-primary px-1.5 text-xs font-medium tabular-nums text-primary-foreground">
										{active}
									</span>
								) : null}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="max-h-96 w-56 overflow-y-auto">
							{filters.map((filter, index) => (
								<DropdownMenuGroup key={filter.id}>
									{index > 0 ? <DropdownMenuSeparator /> : null}
									<DropdownMenuLabel>{filter.label}</DropdownMenuLabel>
									{filter.options.map((option) => (
										<DropdownMenuCheckboxItem
											key={option.value}
											checked={(state.filters[filter.id] ?? []).includes(option.value)}
											onSelect={(event) => event.preventDefault()}
											onCheckedChange={() =>
												onState({
													filters: {
														...state.filters,
														[filter.id]: toggle(state.filters[filter.id] ?? [], option.value),
													},
													page: 1,
												})
											}
										>
											{option.icon}
											{option.label}
										</DropdownMenuCheckboxItem>
									))}
								</DropdownMenuGroup>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}

				{hideable.length > 0 ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button type="button" variant="outline" size="sm" className="@max-[600px]/table:h-9 @max-[600px]/table:flex-1">
								<Settings2 />
								<span>{t("columns")}</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="max-h-96 w-52 overflow-y-auto">
							<DropdownMenuLabel>{t("columnsHint")}</DropdownMenuLabel>
							{hideable.map((column) => (
								<DropdownMenuCheckboxItem
									key={column.id}
									checked={!state.hiddenColumns.includes(column.id)}
									onSelect={(event) => event.preventDefault()}
									onCheckedChange={() => onState({ hiddenColumns: toggle(state.hiddenColumns, column.id) })}
								>
									{column.header}
								</DropdownMenuCheckboxItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
			</div>
		</div>
	);
}
