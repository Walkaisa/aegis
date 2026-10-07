/**
 * A press next to an open dialog, sheet or popover. The tests load no styles, so the overlay has no
 * area to click on. Radix starts listening one task after a layer opened, and a dialog only reacts
 * once the press ends in a click, so the press waits for the one and completes with the other.
 */
export async function pressOutside(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
	document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
	document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
	await new Promise((resolve) => setTimeout(resolve, 0));
}
