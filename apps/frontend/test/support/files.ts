import { page, userEvent } from "vitest/browser";

/** A real image file, drawn on a canvas, as a user would pick it. */
export async function imageFile(width = 400, height = 200, type = "image/png"): Promise<File> {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (context) {
		context.fillStyle = "#4f46e5";
		context.fillRect(0, 0, width, height);
	}
	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type));
	return new File([blob ?? new Blob()], "picture.png", { type });
}

/** The file input of the open picture dialog. */
export function fileInput(): HTMLInputElement {
	const input = document.querySelector<HTMLInputElement>("input[type='file']");
	if (!input) {
		throw new Error("The drop zone is not open");
	}
	return input;
}

/** Picks a file in the open picture dialog. */
export async function choose(file: File): Promise<void> {
	await userEvent.upload(page.elementLocator(fileInput()), file);
}
