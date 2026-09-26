import type { CSSProperties, ReactNode } from "react";
import { FONT_STACK, LIGHT, MONO_STACK, SURFACE } from "../theme";

/*
 * The building blocks every template is written with. They render tables and inline styles rather
 * than modern layout, because that is the only thing every mail client agrees on: Outlook renders
 * with Word, Gmail strips most of `<head>`, and no client supports flex or grid reliably.
 */

const BASE_TEXT: CSSProperties = {
	fontFamily: FONT_STACK,
	color: LIGHT.foreground,
	margin: "0",
	WebkitFontSmoothing: "antialiased",
};

export function Heading({ children }: { children: ReactNode }) {
	return (
		<h1
			className={SURFACE.heading}
			style={{
				...BASE_TEXT,
				fontSize: "22px",
				lineHeight: "30px",
				fontWeight: "700",
				letterSpacing: "-0.01em",
				margin: "0 0 12px",
			}}
		>
			{children}
		</h1>
	);
}

export function Text({
	children,
	tone = "default",
	size = "md",
	style,
}: {
	children: ReactNode;
	tone?: "default" | "muted" | "subtle";
	size?: "sm" | "md";
	style?: CSSProperties;
}) {
	const colors = { default: LIGHT.foreground, muted: LIGHT.mutedForeground, subtle: LIGHT.subtle };
	const classes = { default: SURFACE.text, muted: SURFACE.muted, subtle: SURFACE.subtle };

	return (
		<p
			className={classes[tone]}
			style={{
				...BASE_TEXT,
				color: colors[tone],
				fontSize: size === "sm" ? "13px" : "15px",
				lineHeight: size === "sm" ? "20px" : "24px",
				margin: "0 0 16px",
				...style,
			}}
		>
			{children}
		</p>
	);
}

/**
 * The call to action. A padded table cell with the link stretched across it: Outlook's Word engine
 * ignores padding on an anchor, but honours it on a cell, so the hit area survives everywhere.
 * The rounded corners simply fall away in Outlook, which is the accepted trade-off.
 */
export function Button({ href, children }: { href: string; children: ReactNode }) {
	return (
		<table role="presentation" cellPadding={0} cellSpacing={0} border={0} style={{ margin: "0 0 20px" }}>
			<tbody>
				<tr>
					<td
						className={SURFACE.button}
						align="center"
						style={{ backgroundColor: LIGHT.primary, borderRadius: "10px", padding: "13px 28px" }}
					>
						<a
							href={href}
							style={{
								...BASE_TEXT,
								display: "block",
								color: LIGHT.primaryForeground,
								fontSize: "15px",
								lineHeight: "20px",
								fontWeight: "600",
								textDecoration: "none",
								whiteSpace: "nowrap",
							}}
						>
							{children}
						</a>
					</td>
				</tr>
			</tbody>
		</table>
	);
}

/**
 * The same link as plain text, for anyone whose client swallows the button. The plain-text part
 * already carries the URL from the button, so this block is left out of it.
 */
export function LinkFallback({ label, href }: { label: string; href: string }) {
	return (
		<div data-skip-in-text="true" style={{ margin: "0 0 24px" }}>
			<p
				className={SURFACE.subtle}
				style={{ ...BASE_TEXT, color: LIGHT.subtle, fontSize: "12px", lineHeight: "18px", margin: "0 0 6px" }}
			>
				{label}
			</p>
			<a
				className={SURFACE.link}
				href={href}
				style={{
					...BASE_TEXT,
					color: LIGHT.primary,
					fontFamily: MONO_STACK,
					fontSize: "12px",
					lineHeight: "18px",
					wordBreak: "break-all",
					textDecoration: "underline",
				}}
			>
				{href}
			</a>
		</div>
	);
}

/** A boxed aside: what happens next, or what to do if the message was unexpected. */
export function Panel({ title, children }: { title?: ReactNode; children: ReactNode }) {
	return (
		<table
			role="presentation"
			cellPadding={0}
			cellSpacing={0}
			border={0}
			width="100%"
			// Separate borders, so the rounded corners apply to the border as well.
			style={{ margin: "0 0 20px", borderCollapse: "separate" }}
		>
			<tbody>
				<tr>
					<td
						className={SURFACE.panel}
						style={{
							backgroundColor: LIGHT.muted,
							border: `1px solid ${LIGHT.border}`,
							borderRadius: "10px",
							padding: "16px 18px",
						}}
					>
						{title ? (
							<p
								className={SURFACE.text}
								style={{ ...BASE_TEXT, fontSize: "13px", lineHeight: "20px", fontWeight: "600", margin: "0 0 4px" }}
							>
								{title}
							</p>
						) : null}
						<div style={{ margin: "0" }}>{children}</div>
					</td>
				</tr>
			</tbody>
		</table>
	);
}

/** Label/value rows, e.g. the browser and IP address a request came from. */
export function FactList({ items }: { items: { label: string; value: string }[] }) {
	return (
		<table
			role="presentation"
			data-text-format="dataTable"
			cellPadding={0}
			cellSpacing={0}
			border={0}
			width="100%"
			style={{ margin: "0 0 20px" }}
		>
			<tbody>
				{items.map((item) => (
					<tr key={item.label}>
						<td
							className={SURFACE.muted}
							style={{
								...BASE_TEXT,
								color: LIGHT.mutedForeground,
								fontSize: "13px",
								lineHeight: "20px",
								padding: "5px 16px 5px 0",
								verticalAlign: "top",
								whiteSpace: "nowrap",
							}}
						>
							{item.label}
						</td>
						<td
							className={SURFACE.text}
							style={{
								...BASE_TEXT,
								fontSize: "13px",
								lineHeight: "20px",
								fontWeight: "600",
								padding: "5px 0",
								wordBreak: "break-word",
							}}
						>
							{item.value}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
