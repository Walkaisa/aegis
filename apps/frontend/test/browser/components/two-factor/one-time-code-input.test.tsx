import { type ComponentProps, createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { OneTimeCodeInput } from "@/components/two-factor/one-time-code-input";

type Props = Partial<ComponentProps<typeof OneTimeCodeInput>>;

/** The input with its value held in state, like every form that uses it. */
function Controlled(props: Props) {
	const [value, setValue] = useState("");
	return (
		<OneTimeCodeInput
			aria-label="Code"
			{...props}
			value={value}
			onChange={(next) => {
				setValue(next);
				props.onChange?.(next);
			}}
		/>
	);
}

const input = () => page.getByLabelText("Code");
const slots = (container: HTMLElement) => Array.from(container.querySelectorAll("[aria-hidden='true'] > span"), (slot) => slot.textContent);

describe("OneTimeCodeInput", () => {
	it("keeps digits only and completes once all six are there", async () => {
		const onComplete = vi.fn();
		const { container } = await render(<Controlled onComplete={onComplete} />);

		await input().fill("12a345");
		expect(slots(container)).toEqual(["1", "2", "3", "4", "5", ""]);
		expect(onComplete).not.toHaveBeenCalled();

		await userEvent.type(input(), "67");
		expect(slots(container)).toEqual(["1", "2", "3", "4", "5", "6"]);
		expect(onComplete).toHaveBeenCalledExactlyOnceWith("123456");

		await userEvent.keyboard("{Backspace}");
		await userEvent.type(input(), "9");
		expect(onComplete).toHaveBeenLastCalledWith("123459");
		expect(onComplete).toHaveBeenCalledTimes(2);
	});

	it("adopts a code a password manager fills in without a change event", async () => {
		const onChange = vi.fn();
		await render(<Controlled onChange={onChange} />);
		const element = input().element() as HTMLInputElement;

		// Assigned like an extension does it; React does not see the change itself.
		element.value = "654321";
		element.dispatchEvent(new Event("change", { bubbles: true }));
		await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith("654321"));

		element.dispatchEvent(new Event("input", { bubbles: true }));
		await Promise.resolve();
		expect(onChange).toHaveBeenCalledOnce();
	});

	it("highlights the slot to type into while focused and keeps the caret at the end", async () => {
		const onFocus = vi.fn();
		const onBlur = vi.fn();
		const { container } = await render(<Controlled onFocus={onFocus} onBlur={onBlur} />);

		await input().fill("123");
		const element = input().element() as HTMLInputElement;
		element.focus();
		expect(onFocus).toHaveBeenCalled();
		await expect.poll(() => container.querySelectorAll(".animate-caret-blink").length).toBe(1);

		await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
		await expect.poll(() => [element.selectionStart, element.selectionEnd]).toEqual([3, 3]);

		element.blur();
		expect(onBlur).toHaveBeenCalled();
		await expect.poll(() => container.querySelectorAll(".animate-caret-blink").length).toBe(0);
	});

	it("works without focus handlers and marks itself invalid or disabled", async () => {
		const ref = createRef<HTMLInputElement>();
		const { container, rerender } = await render(
			<OneTimeCodeInput ref={ref} aria-label="Code" aria-invalid="true" value="" onChange={() => {}} />,
		);

		ref.current?.focus();
		ref.current?.blur();
		expect(ref.current).toBe(input().element());
		expect(container.querySelectorAll(".border-destructive")).toHaveLength(6);

		await rerender(<OneTimeCodeInput aria-label="Code" disabled value="" onChange={() => {}} />);
		await expect.element(input()).toBeDisabled();
		expect(container.querySelector(".opacity-50")).not.toBeNull();
		expect(container.querySelectorAll(".border-destructive")).toHaveLength(0);
	});
});
