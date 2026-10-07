import { describe, expect, it } from "vitest";
import { fitColumns } from "@/components/data-table/fit-columns";

describe("fitColumns", () => {
	it("keeps locked columns and then the most important ones that fit", () => {
		const kept = fitColumns(
			[
				{ id: "a", header: "A", locked: true, cell: () => null },
				{ id: "b", header: "B", minWidth: 100, cell: () => null },
				{ id: "c", header: "C", minWidth: 100, priority: 1, cell: () => null },
			],
			300,
		);

		expect(kept.map((column) => column.id)).toEqual(["a", "c"]);
	});
});
