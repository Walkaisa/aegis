import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
	createTableState,
	DataTable,
	type DataTableColumn,
	type DataTableFilter,
	type DataTableState,
} from "@/components/data-table/data-table";
import { router } from "../../../support/next/navigation";
import { MESSAGES, renderUi } from "../../../support/render";

const t = MESSAGES.en.table;

interface Account {
	id: string;
	name: string;
	team: string[];
	age: number | null;
	admin: boolean;
	joined: Date;
}

const ACCOUNTS: Account[] = Array.from({ length: 30 }, (_, index) => ({
	id: String(index + 1),
	name: `Account ${index + 1}`,
	team: index % 2 === 0 ? ["red"] : ["blue", "green"],
	age: index === 3 ? null : 20 + index,
	admin: index % 5 === 0,
	joined: new Date(Date.UTC(2026, 0, 30 - index)),
}));

const columns: DataTableColumn<Account>[] = [
	{ id: "name", header: "Name", locked: true, flexible: true, minWidth: 120, value: (row) => row.name, cell: (row) => row.name },
	{ id: "age", header: "Age", align: "end", minWidth: 80, priority: 1, value: (row) => row.age, cell: (row) => row.age ?? "–" },
	{
		id: "admin",
		header: "Admin",
		searchable: false,
		hideBelow: "md",
		value: (row) => row.admin,
		cell: (row) => (row.admin ? "yes" : "no"),
	},
	{
		id: "joined",
		header: "Joined",
		width: "8rem",
		priority: 2,
		value: (row) => row.joined,
		cell: (row) => row.joined.toISOString().slice(0, 10),
	},
	{ id: "id", header: "ID", hiddenByDefault: true, searchable: false, value: (row) => row.id, cell: (row) => row.id },
	{ id: "actions", header: "Actions", sortable: false, cell: (row) => <button type="button">Edit {row.name}</button> },
];

const filters: DataTableFilter<Account>[] = [
	{
		id: "team",
		label: "Team",
		value: (row) => row.team,
		options: [
			{ value: "red", label: "Red" },
			{ value: "blue", label: "Blue" },
		],
	},
	{
		id: "admin",
		label: "Role",
		value: (row) => (row.admin ? "admin" : "user"),
		options: [{ value: "admin", label: "Admins", icon: <span /> }],
	},
	{ id: "server", label: "Server-side", options: [{ value: "x", label: "Only on the server" }] },
];

const headers = () => Array.from(document.querySelectorAll("thead th"), (header) => header.textContent);
const headerOf = (name: string) =>
	Array.from(document.querySelectorAll<HTMLElement>("thead th")).find((header) => header.textContent === name);

const names = () =>
	page
		.getByRole("row")
		.elements()
		.slice(1)
		.map((row) => row.querySelector("td")?.textContent);

describe("DataTable", () => {
	it("sorts, searches, filters and pages through rows in the browser", async () => {
		await renderUi(
			<DataTable
				label="Accounts"
				columns={columns}
				data={ACCOUNTS}
				getRowId={(row) => row.id}
				filters={filters}
				pageSizeOptions={[10, 25]}
			/>,
		);

		expect(names()).toHaveLength(25);
		await expect.element(page.getByText("1–25 of 30")).toBeVisible();
		expect(headerOf("Name")?.style.width).toBe("100%");
		expect(headerOf("Joined")?.style.width).toBe("8rem");

		await page.getByRole("button", { name: "Name" }).click();
		expect(names()[0]).toBe("Account 1");
		expect(names()[1]).toBe("Account 2");
		expect(headerOf("Name")?.getAttribute("aria-sort")).toBe("ascending");
		await page.getByRole("button", { name: "Name" }).click();
		expect(names()[0]).toBe("Account 30");

		await page.getByRole("button", { name: "Age" }).click();
		expect(names()[0]).toBe("Account 4");
		await page.getByRole("button", { name: "Admin" }).click();
		await page.getByRole("button", { name: "Joined" }).click();
		expect(names()[0]).toBe("Account 30");

		await page.getByRole("button", { name: t.nextPage }).click();
		await expect.element(page.getByText("26–30 of 30")).toBeVisible();
		await page.getByRole("button", { name: t.previousPage }).click();
		await page.getByRole("button", { name: t.lastPage }).click();
		await page.getByRole("button", { name: t.firstPage }).click();
		await page.getByRole("combobox", { name: t.rowsPerPage }).click();
		await page.getByRole("option", { name: "10" }).click();
		await expect.element(page.getByText("Page 1 of 3")).toBeVisible();

		await userEvent.type(page.getByRole("searchbox"), "account 2");
		await expect.element(page.getByText("1–10 of 11")).toBeVisible();
		expect(names()).toEqual(expect.arrayContaining(["Account 20", "Account 29"]));
		await userEvent.fill(page.getByRole("searchbox"), "  ");
		expect(names()).toHaveLength(10);
		await userEvent.fill(page.getByRole("searchbox"), "37");
		expect(names()).toEqual(["Account 18"]);

		await page.getByRole("button", { name: t.reset }).click();
		await page.getByRole("button", { name: t.filters }).click();
		await page.getByRole("menuitemcheckbox", { name: "Blue" }).click();
		await page.getByRole("menuitemcheckbox", { name: "Admins" }).click();
		await page.getByRole("menuitemcheckbox", { name: "Only on the server" }).click();
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByRole("button", { name: `${t.filters}3` })).toBeVisible();
		expect(names()).toEqual(["Account 26", "Account 16", "Account 6"]);

		await page.getByRole("button", { name: `${t.filters}3` }).click();
		await page.getByRole("menuitemcheckbox", { name: "Admins" }).click();
		await userEvent.keyboard("{Escape}");
		await userEvent.fill(page.getByRole("searchbox"), "nobody");
		await expect.element(page.getByText(t.noMatchesTitle)).toBeVisible();
		await expect.element(page.getByText(t.noMatchesDescription)).toBeVisible();
	});

	it("shows and hides columns from the column menu", async () => {
		await renderUi(<DataTable columns={columns} data={ACCOUNTS.slice(0, 2)} getRowId={(row) => row.id} searchable={false} />);

		expect(headers()).not.toContain("ID");
		await page.getByRole("button", { name: t.columns }).click();
		await page.getByRole("menuitemcheckbox", { name: "ID" }).click();
		await page.getByRole("menuitemcheckbox", { name: "Age" }).click();
		await userEvent.keyboard("{Escape}");

		expect(headers()).toEqual(["Name", "Admin", "Joined", "ID", "Actions"]);
		expect(page.getByRole("searchbox").query()).toBeNull();
	});

	it("offers no column menu when every column is locked", async () => {
		const fixed: DataTableColumn<Account>[] = [
			{ id: "name", header: "Name", locked: true, value: (row) => row.name, cell: (row) => row.name },
		];
		await renderUi(
			<DataTable
				columns={fixed}
				data={ACCOUNTS.slice(0, 2)}
				getRowId={(row) => row.id}
				defaultState={{ sort: { columnId: "missing", direction: "asc" } }}
			/>,
		);

		await expect.element(page.getByRole("searchbox")).toBeVisible();
		await expect.element(page.getByRole("button", { name: t.columns })).not.toBeInTheDocument();
		expect(names()).toEqual(["Account 1", "Account 2"]);
	});

	it("leaves out the toolbar a table does not need", async () => {
		const fixed: DataTableColumn<Account>[] = [{ id: "name", header: "Name", locked: true, cell: (row) => row.name }];
		await renderUi(
			<DataTable columns={fixed} data={ACCOUNTS.slice(0, 3)} getRowId={(row) => row.id} searchable={false} paginated={false} />,
		);

		expect(page.getByRole("button").elements()).toHaveLength(0);
		expect(names()).toEqual(["Account 1", "Account 2", "Account 3"]);
	});

	it("resets filters next to a table without a search box", async () => {
		await renderUi(
			<DataTable
				columns={columns}
				data={ACCOUNTS}
				getRowId={(row) => row.id}
				filters={filters}
				searchable={false}
				defaultState={{ filters: { team: ["red"] } }}
				toolbarActions={<button type="button">Refresh</button>}
				header={<p>Header</p>}
			/>,
		);

		await expect.element(page.getByText("1–15 of 15")).toBeVisible();
		await page.getByRole("button", { name: t.reset }).click();
		await expect.element(page.getByText("1–25 of 30")).toBeVisible();
		await expect.element(page.getByRole("button", { name: "Refresh" })).toBeVisible();
		await expect.element(page.getByText("Header")).toBeVisible();
	});

	it("shows a skeleton while loading and an empty state without rows", async () => {
		const { rerender } = await renderUi(<DataTable columns={columns} data={[]} getRowId={(row) => row.id} loading />);
		await expect.element(page.getByText(t.emptyTitle)).not.toBeInTheDocument();
		expect(document.querySelector("[aria-busy='true']")).not.toBeNull();

		await rerender(<DataTable columns={columns} data={[]} getRowId={(row) => row.id} />);
		await expect.element(page.getByText(t.emptyTitle)).toBeVisible();
		await expect.element(page.getByText(t.emptyDescription)).toBeVisible();

		await rerender(
			<DataTable columns={columns} data={[]} getRowId={(row) => row.id} emptyTitle="No accounts" emptyDescription="Invite someone" />,
		);
		await expect.element(page.getByText("No accounts")).toBeVisible();
		await expect.element(page.getByText("Invite someone")).toBeVisible();
	});

	it("links rows to their page", async () => {
		await renderUi(
			<DataTable columns={columns} data={ACCOUNTS.slice(0, 2)} getRowId={(row) => row.id} rowHref={(row) => `/accounts/${row.id}`} />,
		);

		await page.getByRole("link", { name: "Account 2" }).click();
		expect(router.push).toHaveBeenLastCalledWith("/accounts/2");
		await page.getByRole("link", { name: t.open }).first().click();
		expect(router.push).toHaveBeenLastCalledWith("/accounts/1");
	});

	it("opens rows in place, but not for their own controls or portals", async () => {
		const onRowClick = vi.fn();
		const portalColumns: DataTableColumn<Account>[] = [
			...columns.slice(0, 1),
			{ id: "portal", header: "Portal", cell: (row) => createPortal(<span>Portal of {row.name}</span>, document.body) },
			columns[5] as DataTableColumn<Account>,
		];
		await renderUi(
			<DataTable
				columns={portalColumns}
				data={ACCOUNTS.slice(0, 2)}
				getRowId={(row) => row.id}
				onRowClick={onRowClick}
				activeRowId="2"
			/>,
		);

		await page.getByRole("cell", { name: "Account 1" }).click();
		expect(onRowClick).toHaveBeenLastCalledWith(ACCOUNTS[0]);
		await page.getByRole("button", { name: "Edit Account 1" }).click();
		await page.getByText("Portal of Account 1").click();
		expect(onRowClick).toHaveBeenCalledOnce();
		await page.getByRole("button", { name: t.open }).nth(1).click();
		expect(onRowClick).toHaveBeenLastCalledWith(ACCOUNTS[1]);
		expect(page.getByRole("row").nth(2).element().getAttribute("data-state")).toBe("selected");
	});

	it("renders cards on narrow screens, as links or in place", async () => {
		const card = (row: Account) => <span>Card {row.name}</span>;
		const { rerender } = await renderUi(
			<DataTable
				columns={columns}
				data={ACCOUNTS.slice(0, 1)}
				getRowId={(row) => row.id}
				renderCard={card}
				rowHref={(row) => `/accounts/${row.id}`}
			/>,
		);
		await page.getByRole("link", { name: "Card Account 1" }).click();
		expect(router.push).toHaveBeenLastCalledWith("/accounts/1");

		await rerender(<DataTable columns={columns} data={ACCOUNTS.slice(0, 1)} getRowId={(row) => row.id} renderCard={card} />);
		await expect.element(page.getByText("Card Account 1")).toBeInTheDocument();
		expect(page.getByRole("link").elements()).toHaveLength(0);
	});

	it("fits its columns to the space it has", async () => {
		await renderUi(
			<div style={{ width: 360 }} data-testid="frame">
				<DataTable
					adaptive
					columns={columns}
					data={ACCOUNTS.slice(0, 2)}
					getRowId={(row) => row.id}
					rowHref={(row) => `/accounts/${row.id}`}
				/>
			</div>,
		);

		await expect.poll(headers).toEqual(["Name", "Age", ""]);
		expect(headerOf("Name")?.style.width).toBe("");
		expect(headerOf("Age")?.style.width).toBe("80px");

		page.getByTestId("frame").element().setAttribute("style", "width: 1200px");
		await expect.poll(() => headers().length).toBe(6);
	});

	it("fits its columns without a trailing column", async () => {
		await renderUi(
			<div style={{ width: 300 }}>
				<DataTable adaptive columns={columns} data={ACCOUNTS.slice(0, 2)} getRowId={(row) => row.id} />
			</div>,
		);

		await expect.poll(headers).toEqual(["Name", "Age"]);
	});

	it("follows a controlled, server-paged state", async () => {
		const onStateChange = vi.fn<(state: DataTableState) => void>();
		const state = createTableState({ page: 2, pageSize: 10, sort: { columnId: "actions", direction: "asc" } });
		await renderUi(
			<DataTable
				manual
				total={42}
				state={state}
				onStateChange={onStateChange}
				columns={columns}
				data={ACCOUNTS.slice(0, 10)}
				getRowId={(row) => row.id}
			/>,
		);

		await expect.element(page.getByText("11–20 of 42")).toBeVisible();
		expect(names()[0]).toBe("Account 1");
		await page.getByRole("button", { name: t.nextPage }).click();
		expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
		await expect.element(page.getByText("11–20 of 42")).toBeVisible();
	});

	it("pages through server data without a total", async () => {
		await renderUi(<DataTable manual columns={columns} data={ACCOUNTS.slice(0, 3)} getRowId={(row) => row.id} />);

		await expect.element(page.getByText("1–3 of 3")).toBeVisible();
	});
});
