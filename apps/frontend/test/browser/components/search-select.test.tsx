import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { SearchSelect } from "@/components/search-select";
import { renderUi } from "../../support/render";

describe("SearchSelect", () => {
	const options = [
		{ value: "UTC", label: "UTC", hint: "Default" },
		{ value: "Europe/Berlin", label: "Berlin", keywords: ["Germany"], icon: <span data-testid="globe" />, lang: "de" },
	];

	it("finds and picks an option", async () => {
		const onChange = vi.fn();
		await renderUi(
			<SearchSelect
				value="UTC"
				onChange={onChange}
				options={options}
				placeholder="Pick a time zone"
				searchPlaceholder="Search"
				emptyMessage="Nothing found"
				ariaLabel="Time zone"
			/>,
		);

		const trigger = page.getByRole("combobox", { name: "Time zone" });
		await expect.element(trigger).toHaveTextContent("UTCDefault");
		await trigger.click();
		await userEvent.type(page.getByPlaceholder("Search"), "germany");
		await page.getByRole("option", { name: "Berlin" }).click();

		expect(onChange).toHaveBeenCalledWith("Europe/Berlin");

		await trigger.click();
		await userEvent.type(page.getByPlaceholder("Search"), "mars");
		await expect.element(page.getByText("Nothing found")).toBeVisible();
	});

	it("shows its placeholder and stays closed while disabled", async () => {
		await renderUi(
			<SearchSelect
				value=""
				onChange={vi.fn()}
				options={options}
				placeholder="Pick a time zone"
				searchPlaceholder="Search"
				emptyMessage="-"
				disabled
			/>,
		);

		const trigger = page.getByRole("combobox");
		await expect.element(trigger).toHaveTextContent("Pick a time zone");
		await expect.element(trigger).toBeDisabled();
	});
});
