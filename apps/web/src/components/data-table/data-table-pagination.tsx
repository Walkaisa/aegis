"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Page navigation and page size, shown below a table once there is something to page through. */
export function DataTablePagination({
	page,
	pageSize,
	pageSizeOptions,
	total,
	onPage,
	onPageSize,
}: {
	page: number;
	pageSize: number;
	pageSizeOptions: number[];
	total: number;
	onPage: (page: number) => void;
	onPageSize: (pageSize: number) => void;
}) {
	const t = useTranslations("table");
	const pageCount = Math.max(1, Math.ceil(total / pageSize));
	const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
	const last = Math.min(page * pageSize, total);

	return (
		<div className="flex flex-col gap-3 border-t px-4 py-3 @min-[600px]/table:flex-row @min-[600px]/table:items-center @min-[600px]/table:justify-between">
			<p className="text-xs text-muted-foreground tabular-nums">{t("range", { first, last, total })}</p>

			<div className="flex items-center justify-between gap-4 @min-[600px]/table:justify-end">
				<div className="flex items-center gap-2">
					<span className="hidden text-xs text-muted-foreground @min-[600px]/table:inline">{t("rowsPerPage")}</span>
					<Select value={String(pageSize)} onValueChange={(value) => onPageSize(Number(value))}>
						<SelectTrigger size="sm" className="w-[4.5rem]" aria-label={t("rowsPerPage")}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{pageSizeOptions.map((option) => (
								<SelectItem key={option} value={String(option)}>
									{option}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex items-center gap-1">
					<span className="mr-1 text-xs text-muted-foreground tabular-nums">{t("page", { page, pageCount })}</span>
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						className="hidden @min-[600px]/table:inline-flex"
						aria-label={t("firstPage")}
						disabled={page <= 1}
						onClick={() => onPage(1)}
					>
						<ChevronsLeft />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						aria-label={t("previousPage")}
						disabled={page <= 1}
						onClick={() => onPage(page - 1)}
					>
						<ChevronLeft />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						aria-label={t("nextPage")}
						disabled={page >= pageCount}
						onClick={() => onPage(page + 1)}
					>
						<ChevronRight />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						className="hidden @min-[600px]/table:inline-flex"
						aria-label={t("lastPage")}
						disabled={page >= pageCount}
						onClick={() => onPage(pageCount)}
					>
						<ChevronsRight />
					</Button>
				</div>
			</div>
		</div>
	);
}
