import { AVATAR_MAX_UPLOAD_BYTES } from "@aegis/contracts";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { EditableAvatar } from "@/components/avatar-editor";
import { ApiRequestError } from "@/lib/api";
import { choose, fileInput, imageFile } from "../../support/files";
import { MESSAGES, renderUi, translate } from "../../support/render";

const t = MESSAGES.en.avatar;

function press(name: string) {
	(page.getByRole("button", { name }).element() as HTMLButtonElement).click();
}

/** Pointer events as a finger or mouse produces them on the crop area. */
function pointer(type: string, pointerId: number, x: number, y: number) {
	page.getByRole("application")
		.element()
		.dispatchEvent(new PointerEvent(type, { pointerId, clientX: x, clientY: y, bubbles: true }));
}

async function renderEditor(props: Partial<Parameters<typeof EditableAvatar>[0]> = {}) {
	const onUpload = vi.fn(async (_image: Blob) => {});
	const onRemove = vi.fn(async () => {});
	await renderUi(<EditableAvatar name="Ada Lovelace" src={null} onUpload={onUpload} onRemove={onRemove} {...props} />);
	return { onUpload, onRemove };
}

describe("EditableAvatar", () => {
	it("uploads a cropped picture as WebP", async () => {
		const { onUpload } = await renderEditor();

		await page.getByRole("button", { name: t.change }).click();
		await expect.element(page.getByText(t.description)).toBeVisible();
		await choose(await imageFile());
		await expect.element(page.getByText(t.cropDescription)).toBeVisible();
		await page.getByRole("button", { name: t.save }).click();

		await expect.element(page.getByText(t.uploaded)).toBeVisible();
		const [image] = onUpload.mock.calls[0] ?? [];
		expect(image?.type).toBe("image/webp");
		const bitmap = await createImageBitmap(image as Blob);
		expect([bitmap.width, bitmap.height]).toEqual([512, 512]);
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
	});

	it("moves and zooms the crop with keys, wheel, slider, buttons and gestures", async () => {
		vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
		await renderEditor();
		await page.getByRole("button", { name: t.change }).click();
		await choose(await imageFile());

		const zoom = page.getByRole("slider", { name: t.zoom });
		const zoomValue = () => Number((zoom.element() as HTMLInputElement).value);
		await expect.element(page.getByRole("button", { name: t.zoomOut })).toBeDisabled();

		await page.getByRole("application").click();
		for (const key of ["{ArrowLeft}", "{ArrowRight}", "{ArrowUp}", "{ArrowDown}", "+", "=", "-", "x"]) {
			await userEvent.keyboard(key);
		}
		// Without the stylesheet the unscaled picture covers the controls, so they are clicked directly.
		press(t.zoomIn);
		await expect.poll(zoomValue).toBeCloseTo(1.4);
		press(t.zoomOut);
		await expect.poll(zoomValue).toBeCloseTo(1.2);

		page.getByRole("application")
			.element()
			.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true }));
		await expect.poll(zoomValue).toBeCloseTo(1.32);
		page.getByRole("application")
			.element()
			.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true }));
		await expect.poll(zoomValue).toBeCloseTo(1.2);

		const input = zoom.element() as HTMLInputElement;
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "4");
		input.dispatchEvent(new Event("input", { bubbles: true }));
		await expect.element(page.getByRole("button", { name: t.zoomIn })).toBeDisabled();

		press(t.reset);
		await expect.poll(zoomValue).toBe(1);

		// A hover without a pressed pointer changes nothing.
		pointer("pointermove", 9, 10, 10);
		pointer("pointerdown", 1, 100, 100);
		pointer("pointermove", 1, 160, 100);
		pointer("pointerdown", 2, 200, 100);
		pointer("pointermove", 2, 260, 100);
		await expect.poll(zoomValue).toBeGreaterThan(1);
		pointer("pointerup", 2, 260, 100);
		pointer("pointercancel", 1, 160, 100);
		pointer("pointerup", 3, 0, 0);

		press(t.chooseOther);
		await expect.element(page.getByText(t.description)).toBeVisible();
	});

	it("refuses files that are no pictures, too large or broken", async () => {
		await renderEditor();
		await page.getByRole("button", { name: t.change }).click();

		await choose(new File(["text"], "notes.txt", { type: "text/plain" }));
		await expect.element(page.getByText(t.invalidType)).toBeVisible();

		await choose(new File([new Uint8Array(15 * 1024 * 1024 + 1)], "huge.png", { type: "image/png" }));
		await expect.element(page.getByText(translate("avatar.tooLarge", { size: 15 }))).toBeVisible();

		await choose(new File(["not a png"], "broken.png", { type: "image/png" }));
		await expect.element(page.getByText(t.loadFailed)).toBeVisible();
		await expect.element(page.getByText(t.description)).toBeVisible();

		// A file dialog that was closed without a choice.
		fileInput().dispatchEvent(new Event("change", { bubbles: true }));
		await expect.element(page.getByText(t.description)).toBeVisible();
	});

	it("accepts a picture dropped onto it", async () => {
		await renderEditor();
		await page.getByRole("button", { name: t.change }).click();
		const zone = fileInput().closest("label") as HTMLLabelElement;
		const files = new DataTransfer();
		files.items.add(await imageFile(200, 400));

		zone.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true }));
		await expect.poll(() => zone.className).toContain("bg-primary/8");
		zone.dispatchEvent(new DragEvent("dragleave", { bubbles: true }));
		await expect.poll(() => zone.className).not.toContain("bg-primary");
		zone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
		await expect.element(page.getByText(t.description)).toBeVisible();
		zone.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: files }));

		await expect.element(page.getByText(t.cropDescription)).toBeVisible();
	});

	it("falls back to PNG and reports pictures it cannot encode or that grow too large", async () => {
		const { onUpload } = await renderEditor();
		await page.getByRole("button", { name: t.change }).click();
		await choose(await imageFile());
		const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob");

		toBlob
			.mockImplementationOnce((callback) => callback(null))
			.mockImplementationOnce((callback) => callback(new Blob(["png"], { type: "image/png" })));
		await page.getByRole("button", { name: t.save }).click();
		await expect.element(page.getByText(t.uploaded)).toBeVisible();
		expect(onUpload.mock.calls[0]?.[0].type).toBe("image/png");

		await page.getByRole("button", { name: t.change }).click();
		await choose(await imageFile());
		toBlob.mockImplementationOnce((callback) => callback(null)).mockImplementationOnce((callback) => callback(null));
		await page.getByRole("button", { name: t.save }).click();
		await expect.element(page.getByText(MESSAGES.en.errors.internal_error)).toBeVisible();

		toBlob.mockImplementationOnce((callback) =>
			callback(new Blob([new Uint8Array(AVATAR_MAX_UPLOAD_BYTES + 1)], { type: "image/webp" })),
		);
		await page.getByRole("button", { name: t.save }).click();
		await expect.element(page.getByText(translate("avatar.tooLarge", { size: 5 }))).toBeVisible();

		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValueOnce(null);
		await page.getByRole("button", { name: t.save }).click();
		await expect.poll(() => page.getByText(MESSAGES.en.errors.internal_error).elements().length).toBe(2);
		expect(onUpload).toHaveBeenCalledOnce();
	});

	it("keeps the dialog open when the upload fails", async () => {
		const onUpload = vi.fn(async () => {
			throw new ApiRequestError(413, "payload_too_large", "too large");
		});
		await renderEditor({ onUpload });
		await page.getByRole("button", { name: t.change }).click();
		await choose(await imageFile());

		await page.getByRole("button", { name: t.save }).click();

		await expect.element(page.getByText(MESSAGES.en.errors.payload_too_large)).toBeVisible();
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await page.getByRole("button", { name: t.cancel }).click();
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
	});

	it("stays open while saving and closes with Escape otherwise", async () => {
		let finish = () => {};
		const onUpload = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
		await renderEditor({ onUpload });
		await page.getByRole("button", { name: t.change }).click();
		await choose(await imageFile());

		await page.getByRole("button", { name: t.save }).click();
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByRole("dialog")).toBeVisible();
		finish();
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();

		await page.getByRole("button", { name: t.change }).click();
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
	});

	it("replaces or removes an existing logo from its menu", async () => {
		const { onRemove, onUpload } = await renderEditor({ kind: "application", name: "Wiki", src: "/api/media/logos/1/a.webp" });
		const tLogo = MESSAGES.en.applicationLogo;

		await page.getByRole("button", { name: tLogo.change }).click();
		await page.getByRole("menuitem", { name: tLogo.upload }).click();
		await expect.element(page.getByRole("heading", { name: tLogo.title })).toBeVisible();
		await choose(await imageFile());
		await page.getByRole("button", { name: t.save }).click();
		await expect.element(page.getByText(tLogo.uploaded)).toBeVisible();
		expect(onUpload).toHaveBeenCalledOnce();

		await page.getByRole("button", { name: tLogo.change }).click();
		await page.getByRole("menuitem", { name: tLogo.remove }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: tLogo.removeConfirm }).click();

		await expect.element(page.getByText(tLogo.removed)).toBeVisible();
		expect(onRemove).toHaveBeenCalledOnce();
	});
});
