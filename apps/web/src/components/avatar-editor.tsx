"use client";

import { AVATAR_MAX_UPLOAD_BYTES, AVATAR_SIZE, AVATAR_UPLOAD_TYPES } from "@aegis/contracts";
import { Camera, ImagePlus, ImageUp, RotateCcw, Trash2, Upload, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { type DragEvent, type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { AppAvatar } from "@/components/app-avatar";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/users/account-badges";
import { useErrorMessage } from "@/hooks/use-error-message";
import { cn } from "@/lib/utils";

/** Files larger than this are rejected before decoding; the cropped result is far smaller. */
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
/** Logical edge length for crop coordinates, independent of the displayed size. */
const VIEWPORT = 280;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.2;
const PAN_STEP = 10;
const PREVIEW_SIZES = [48, 32, 20];

interface Crop {
	/** 1 = the shorter side of the image exactly fills the circle. */
	zoom: number;
	/** Offset of the image centre from the circle centre, in CSS pixels of the crop area. */
	x: number;
	y: number;
}

interface Source {
	url: string;
	image: HTMLImageElement;
}

const INITIAL_CROP: Crop = { zoom: 1, x: 0, y: 0 };

/** A profile picture of an account or the logo of an application. */
export type AvatarKind = "user" | "application";

/** Profile pictures are shown as circles, application logos as rounded squares. */
const CROP_SHAPES: Record<AvatarKind, string> = {
	user: "rounded-full",
	application: "rounded-[22%]",
};

/** Messages that differ between profile pictures and logos; everything else lives in `avatar`. */
const KIND_MESSAGES: Record<AvatarKind, "avatar" | "applicationLogo"> = {
	user: "avatar",
	application: "applicationLogo",
};

function KindAvatar({ kind, name, src, className }: { kind: AvatarKind; name: string; src?: string | null; className?: string }) {
	return kind === "application" ? (
		<AppAvatar name={name} src={src} size="xl" className={className} />
	) : (
		<UserAvatar name={name} src={src} size="lg" className={className} />
	);
}

/**
 * A profile picture or application logo that can be changed in place. Without an image a click
 * opens the upload dialog; with one, a menu offers to replace or remove it.
 */
export function EditableAvatar({
	kind = "user",
	name,
	src,
	onUpload,
	onRemove,
	className,
}: {
	kind?: AvatarKind;
	name: string;
	src: string | null;
	onUpload: (image: Blob) => Promise<void>;
	onRemove: () => Promise<void>;
	className?: string;
}) {
	const t = useTranslations(KIND_MESSAGES[kind]);
	const [open, setOpen] = useState(false);
	const [removeOpen, setRemoveOpen] = useState(false);

	const trigger = (
		<button
			type="button"
			onClick={src ? undefined : () => setOpen(true)}
			aria-label={t("change")}
			className={cn(
				"group/avatar-edit relative block shrink-0 cursor-pointer rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
				className,
			)}
		>
			<KindAvatar kind={kind} name={name} src={src} />
			<span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 text-white opacity-0 transition-opacity duration-200 group-hover/avatar-edit:opacity-100 group-focus-visible/avatar-edit:opacity-100 group-data-[state=open]/avatar-edit:opacity-100">
				<Camera className="size-5" />
			</span>
			<span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm ring-2 ring-card transition-transform duration-200 group-hover/avatar-edit:scale-110">
				<Camera className="size-3" />
			</span>
		</button>
	);

	return (
		<>
			{src ? (
				// Not modal: a modal menu would still hold the pointer lock while the dialog opens.
				<DropdownMenu modal={false}>
					<DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-52">
						<DropdownMenuItem onSelect={() => setOpen(true)}>
							<ImageUp />
							{t("upload")}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem variant="destructive" onSelect={() => setRemoveOpen(true)}>
							<Trash2 />
							{t("remove")}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			) : (
				trigger
			)}

			<AvatarCropDialog open={open} onOpenChange={setOpen} kind={kind} name={name} onSave={onUpload} />

			<ConfirmDialog
				open={removeOpen}
				onOpenChange={setRemoveOpen}
				title={t("removeTitle")}
				description={t("removeDescription")}
				confirmLabel={t("removeConfirm")}
				destructive
				onConfirm={async () => {
					await onRemove();
					toast.success(t("removed"));
				}}
			/>
		</>
	);
}

function AvatarCropDialog({
	open,
	onOpenChange,
	kind,
	name,
	onSave,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	kind: AvatarKind;
	name: string;
	onSave: (image: Blob) => Promise<void>;
}) {
	const t = useTranslations("avatar");
	const tKind = useTranslations(KIND_MESSAGES[kind]);
	const shape = CROP_SHAPES[kind];
	const errorMessage = useErrorMessage();
	const [source, setSource] = useState<Source | null>(null);
	const [crop, setCrop] = useState<Crop>(INITIAL_CROP);
	const [saving, setSaving] = useState(false);

	// Object URLs are released when they are replaced and when the dialog goes away.
	useEffect(() => {
		return () => {
			if (source) {
				URL.revokeObjectURL(source.url);
			}
		};
	}, [source]);

	useEffect(() => {
		if (!open) {
			setSource(null);
			setCrop(INITIAL_CROP);
		}
	}, [open]);

	async function load(file: File) {
		if (!(AVATAR_UPLOAD_TYPES as readonly string[]).includes(file.type)) {
			toast.error(t("invalidType"));
			return;
		}
		if (file.size > MAX_SOURCE_BYTES) {
			toast.error(t("tooLarge", { size: MAX_SOURCE_BYTES / 1024 / 1024 }));
			return;
		}

		const url = URL.createObjectURL(file);
		const image = new Image();
		image.src = url;
		try {
			await image.decode();
			setSource({ url, image });
			setCrop(INITIAL_CROP);
		} catch {
			URL.revokeObjectURL(url);
			toast.error(t("loadFailed"));
		}
	}

	async function save() {
		if (!source) {
			return;
		}
		setSaving(true);
		try {
			const blob = await renderCrop(source.image, crop);
			if (blob.size > AVATAR_MAX_UPLOAD_BYTES) {
				toast.error(t("tooLarge", { size: AVATAR_MAX_UPLOAD_BYTES / 1024 / 1024 }));
				return;
			}
			await onSave(blob);
			toast.success(tKind("uploaded"));
			onOpenChange(false);
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
			<DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-x-hidden overflow-y-auto p-0 sm:max-w-[30rem]">
				<DialogHeader className="px-6 pt-6 pb-5">
					<DialogTitle>{tKind("title")}</DialogTitle>
					<DialogDescription>{source ? t("cropDescription") : t("description")}</DialogDescription>
				</DialogHeader>

				<div className="px-6 pb-6">
					{source ? (
						<div className="flex min-w-0 flex-col gap-5">
							<div className="flex justify-center rounded-2xl bg-muted/40 p-5 sm:p-8">
								<Cropper source={source} crop={crop} shape={shape} onChange={setCrop} />
							</div>
							<ZoomControl zoom={crop.zoom} onZoom={(zoom) => setCrop((current) => zoomTo(source.image, current, zoom))} />
							<div className="flex items-center justify-between gap-3 px-1">
								<span className="text-xs text-muted-foreground">{t("preview")}</span>
								<div className="flex items-center gap-2.5">
									{PREVIEW_SIZES.map((size) => (
										<CropPreview key={size} source={source} crop={crop} shape={shape} size={size} />
									))}
								</div>
							</div>
						</div>
					) : (
						<DropZone onFile={(file) => void load(file)} kind={kind} name={name} />
					)}
				</div>

				<div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-6 py-4">
					<div className="flex items-center gap-1">
						{source ? (
							<>
								<IconAction label={t("reset")} disabled={saving} onClick={() => setCrop(INITIAL_CROP)}>
									<RotateCcw />
								</IconAction>
								<IconAction label={t("chooseOther")} disabled={saving} onClick={() => setSource(null)}>
									<ImagePlus />
								</IconAction>
							</>
						) : null}
					</div>
					<div className="flex items-center gap-2">
						<Button variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
							{t("cancel")}
						</Button>
						<Button disabled={!source || saving} onClick={() => void save()}>
							{saving ? <Spinner /> : null}
							{t("save")}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function IconAction({
	label,
	disabled,
	onClick,
	children,
}: {
	label: string;
	disabled: boolean;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button variant="ghost" size="icon" aria-label={label} disabled={disabled} onClick={onClick}>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

function DropZone({ onFile, kind, name }: { onFile: (file: File) => void; kind: AvatarKind; name: string }) {
	const t = useTranslations("avatar");
	const inputId = useId();
	const [dragging, setDragging] = useState(false);

	function onDrop(event: DragEvent<HTMLLabelElement>) {
		event.preventDefault();
		setDragging(false);
		const file = event.dataTransfer.files[0];
		if (file) {
			onFile(file);
		}
	}

	return (
		<label
			htmlFor={inputId}
			onDragOver={(event) => {
				event.preventDefault();
				setDragging(true);
			}}
			onDragLeave={() => setDragging(false)}
			onDrop={onDrop}
			className={cn(
				"group/drop flex cursor-pointer flex-col items-center gap-4 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-200",
				dragging ? "border-primary bg-primary/8" : "border-border hover:border-primary/50 hover:bg-muted/40",
			)}
		>
			<div className="relative">
				<KindAvatar kind={kind} name={name} className="opacity-40" />
				<span className="absolute -right-2 -bottom-2 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-popover transition-transform duration-200 group-hover/drop:-translate-y-0.5">
					<Upload className="size-4" />
				</span>
			</div>
			<div className="flex flex-col gap-1">
				<span className="text-sm font-medium">{t("dropTitle")}</span>
				<span className="text-xs text-muted-foreground">{t("dropHint", { size: MAX_SOURCE_BYTES / 1024 / 1024 })}</span>
			</div>
			<input
				id={inputId}
				type="file"
				accept={AVATAR_UPLOAD_TYPES.join(",")}
				className="sr-only"
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) {
						onFile(file);
					}
				}}
			/>
		</label>
	);
}

/** Scale (CSS pixels per image pixel) at which the shorter side of the image fills the crop area. */
function coverScale(image: HTMLImageElement): number {
	return VIEWPORT / Math.min(image.naturalWidth, image.naturalHeight);
}

/** Keeps the zoom in range and the crop area fully covered by the image. */
function clampCrop(image: HTMLImageElement, crop: Crop): Crop {
	const zoom = Math.min(MAX_ZOOM, Math.max(1, crop.zoom));
	const scale = coverScale(image) * zoom;
	const maxX = (image.naturalWidth * scale - VIEWPORT) / 2;
	const maxY = (image.naturalHeight * scale - VIEWPORT) / 2;
	return { zoom, x: Math.min(maxX, Math.max(-maxX, crop.x)), y: Math.min(maxY, Math.max(-maxY, crop.y)) };
}

/** Zooms around the centre of the crop area, so the part in the middle stays in the middle. */
function zoomTo(image: HTMLImageElement, crop: Crop, zoom: number): Crop {
	const next = Math.min(MAX_ZOOM, Math.max(1, zoom));
	const factor = next / crop.zoom;
	return clampCrop(image, { zoom: next, x: crop.x * factor, y: crop.y * factor });
}

function Cropper({ source, crop, shape, onChange }: { source: Source; crop: Crop; shape: string; onChange: (crop: Crop) => void }) {
	const t = useTranslations("avatar");
	const { image } = source;
	const areaRef = useRef<HTMLDivElement>(null);
	const cropRef = useRef(crop);
	/** Active pointers with the crop and positions at the start of the gesture. */
	const gesture = useRef<{ start: Crop; pointers: Map<number, { x: number; y: number }>; origin: Map<number, { x: number; y: number }> }>(
		{
			start: crop,
			pointers: new Map(),
			origin: new Map(),
		},
	);
	const [dragging, setDragging] = useState(false);

	useEffect(() => {
		cropRef.current = crop;
	}, [crop]);

	// Wheel zoom needs a non-passive listener to keep the page from scrolling.
	useEffect(() => {
		const area = areaRef.current;
		if (!area) {
			return;
		}
		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			const current = cropRef.current;
			onChange(zoomTo(image, current, current.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1)));
		};
		area.addEventListener("wheel", onWheel, { passive: false });
		return () => area.removeEventListener("wheel", onWheel);
	}, [image, onChange]);

	/** Every change of the pointer set starts a new gesture from the current crop. */
	function restartGesture() {
		const state = gesture.current;
		state.start = cropRef.current;
		state.origin = new Map(state.pointers);
	}

	function onPointerDown(event: PointerEvent<HTMLDivElement>) {
		event.currentTarget.setPointerCapture(event.pointerId);
		gesture.current.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		restartGesture();
		setDragging(true);
	}

	function onPointerMove(event: PointerEvent<HTMLDivElement>) {
		const state = gesture.current;
		if (!state.pointers.has(event.pointerId)) {
			return;
		}
		state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

		const current = [...state.pointers.values()];
		const origin = [...state.origin.values()];
		const [a, b] = current;
		const [oa, ob] = origin;
		const pointerScale = VIEWPORT / event.currentTarget.getBoundingClientRect().width;
		if (!a || !oa) {
			return;
		}

		if (b && ob) {
			// Pinch: zoom by the change in finger distance, pan by the movement of their midpoint.
			const distance = Math.hypot(a.x - b.x, a.y - b.y);
			const originDistance = Math.hypot(oa.x - ob.x, oa.y - ob.y) || 1;
			const zoomed = zoomTo(image, state.start, state.start.zoom * (distance / originDistance));
			const dx = ((a.x + b.x - oa.x - ob.x) / 2) * pointerScale;
			const dy = ((a.y + b.y - oa.y - ob.y) / 2) * pointerScale;
			onChange(clampCrop(image, { ...zoomed, x: zoomed.x + dx, y: zoomed.y + dy }));
			return;
		}

		onChange(
			clampCrop(image, {
				...state.start,
				x: state.start.x + (a.x - oa.x) * pointerScale,
				y: state.start.y + (a.y - oa.y) * pointerScale,
			}),
		);
	}

	function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
		const state = gesture.current;
		if (state.pointers.delete(event.pointerId)) {
			restartGesture();
		}
		if (state.pointers.size === 0) {
			setDragging(false);
		}
	}

	function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		const moves: Record<string, () => Crop> = {
			ArrowLeft: () => clampCrop(image, { ...crop, x: crop.x - PAN_STEP }),
			ArrowRight: () => clampCrop(image, { ...crop, x: crop.x + PAN_STEP }),
			ArrowUp: () => clampCrop(image, { ...crop, y: crop.y - PAN_STEP }),
			ArrowDown: () => clampCrop(image, { ...crop, y: crop.y + PAN_STEP }),
			"+": () => zoomTo(image, crop, crop.zoom + ZOOM_STEP),
			"=": () => zoomTo(image, crop, crop.zoom + ZOOM_STEP),
			"-": () => zoomTo(image, crop, crop.zoom - ZOOM_STEP),
		};
		const move = moves[event.key];
		if (move) {
			event.preventDefault();
			onChange(move());
		}
	}

	return (
		<div
			ref={areaRef}
			role="application"
			aria-label={t("cropArea")}
			// biome-ignore lint/a11y/noNoninteractiveTabindex: the crop area is operated with the arrow keys
			tabIndex={0}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerEnd}
			onPointerCancel={onPointerEnd}
			onKeyDown={onKeyDown}
			className={cn(
				"relative aspect-square w-full max-w-80 touch-none overflow-hidden bg-popover shadow-sm ring-1 ring-foreground/10 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50",
				shape,
				dragging ? "cursor-grabbing" : "cursor-grab",
			)}
		>
			<CropImage source={source} crop={crop} />
			{/* The rule-of-thirds grid shows while dragging. */}
			<div
				className={cn(
					"pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-200",
					shape,
					dragging ? "opacity-100" : "opacity-0",
				)}
			>
				<div className="absolute inset-y-0 left-1/3 w-px bg-white/40" />
				<div className="absolute inset-y-0 left-2/3 w-px bg-white/40" />
				<div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
				<div className="absolute inset-x-0 top-2/3 h-px bg-white/40" />
			</div>
		</div>
	);
}

/** Percentage positioning keeps the responsive editor and previews aligned with the exported crop. */
function CropImage({ source, crop }: { source: Source; crop: Crop }) {
	const { image, url } = source;
	const scale = coverScale(image) * crop.zoom;

	return (
		// biome-ignore lint/performance/noImgElement: a local object URL that is transformed while cropping
		<img
			src={url}
			alt=""
			draggable={false}
			className="pointer-events-none absolute max-w-none"
			style={{
				width: `${((image.naturalWidth * scale) / VIEWPORT) * 100}%`,
				height: `${((image.naturalHeight * scale) / VIEWPORT) * 100}%`,
				left: `${50 + (crop.x / VIEWPORT) * 100}%`,
				top: `${50 + (crop.y / VIEWPORT) * 100}%`,
				transform: "translate(-50%, -50%)",
			}}
		/>
	);
}

function ZoomControl({ zoom, onZoom }: { zoom: number; onZoom: (zoom: number) => void }) {
	const t = useTranslations("avatar");
	const progress = ((zoom - 1) / (MAX_ZOOM - 1)) * 100;

	return (
		<div className="flex items-center gap-2">
			<Button variant="ghost" size="icon-sm" aria-label={t("zoomOut")} disabled={zoom <= 1} onClick={() => onZoom(zoom - ZOOM_STEP)}>
				<ZoomOut />
			</Button>
			<input
				type="range"
				min={1}
				max={MAX_ZOOM}
				step={0.01}
				value={zoom}
				aria-label={t("zoom")}
				onChange={(event) => onZoom(Number(event.target.value))}
				className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-background [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow-sm"
				style={{ background: `linear-gradient(to right, var(--primary) ${progress}%, var(--muted) ${progress}%)` }}
			/>
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label={t("zoomIn")}
				disabled={zoom >= MAX_ZOOM}
				onClick={() => onZoom(zoom + ZOOM_STEP)}
			>
				<ZoomIn />
			</Button>
		</div>
	);
}

/** The crop as it will appear at sizes the picture is shown at in the UI. */
function CropPreview({ source, crop, shape, size }: { source: Source; crop: Crop; shape: string; size: number }) {
	return (
		<div
			className={cn("relative shrink-0 overflow-hidden bg-popover ring-1 ring-foreground/10", shape)}
			style={{ width: size, height: size }}
		>
			<CropImage source={source} crop={crop} />
		</div>
	);
}

/**
 * Draws the part of the image inside the crop area's bounding square onto a square canvas.
 * WebP where the browser can encode it, PNG otherwise; the server re-encodes either way.
 */
async function renderCrop(image: HTMLImageElement, crop: Crop): Promise<Blob> {
	const scale = coverScale(image) * crop.zoom;
	const sourceSize = VIEWPORT / scale;
	const sourceX = image.naturalWidth / 2 - crop.x / scale - sourceSize / 2;
	const sourceY = image.naturalHeight / 2 - crop.y / scale - sourceSize / 2;

	const canvas = document.createElement("canvas");
	canvas.width = AVATAR_SIZE;
	canvas.height = AVATAR_SIZE;
	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("Canvas is not available");
	}
	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = "high";
	context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

	const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
	if (webp?.type === "image/webp") {
		return webp;
	}
	const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
	if (!png) {
		throw new Error("Encoding the picture failed");
	}
	return png;
}
