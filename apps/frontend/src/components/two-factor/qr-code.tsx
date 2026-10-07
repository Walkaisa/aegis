"use client";

import qrcode from "qrcode-generator";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

/** Modules of empty space around the code, which scanners need to find it. */
const QUIET_ZONE = 2;

/** A QR code as crisp SVG, always dark on white so every scanner reads it, also in dark mode. */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
	const { path, size } = useMemo(() => {
		const code = qrcode(0, "M");
		code.addData(value);
		code.make();

		const count = code.getModuleCount();
		const segments: string[] = [];
		for (let row = 0; row < count; row += 1) {
			for (let column = 0; column < count; column += 1) {
				if (code.isDark(row, column)) {
					segments.push(`M${column + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`);
				}
			}
		}
		return { path: segments.join(""), size: count + QUIET_ZONE * 2 };
	}, [value]);

	return (
		<svg
			viewBox={`0 0 ${size} ${size}`}
			role="img"
			aria-label={label}
			shapeRendering="crispEdges"
			className={cn("size-40 rounded-lg bg-white p-1", className)}
		>
			<title>{label}</title>
			<path d={path} fill="#0b0b0f" />
		</svg>
	);
}
