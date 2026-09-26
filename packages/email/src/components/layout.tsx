import type { Locale } from "@aegis/contracts";
import type { ReactNode } from "react";
import { CONTENT_WIDTH, FONT_STACK, LIGHT, SURFACE, styleSheet } from "../theme";

/** Identity of the instance a message is sent on behalf of. */
export interface EmailBrand {
	instanceName: string;
	/** Public origin of the instance, e.g. `https://auth.example.com`. */
	issuer: string;
}

/** The brand mark served by the web UI; a remote image, so it needs a text fallback. */
function logoUrl(issuer: string): string {
	return `${issuer}/icons/icon-96.png`;
}

/**
 * The preheader: the line clients show next to the subject in the inbox list. Padded with
 * zero-width characters so the quoted body does not bleed into the preview.
 */
function Preheader({ children }: { children: string }) {
	return (
		<div
			data-skip-in-text="true"
			style={{
				display: "none",
				overflow: "hidden",
				lineHeight: "1px",
				opacity: 0,
				maxHeight: 0,
				maxWidth: 0,
			}}
		>
			{children}
			{"‌ ".repeat(80)}
		</div>
	);
}

/**
 * The frame shared by every message: brand above, a single card with the content, and a footer
 * explaining why it arrived. Light styles are inlined, the dark variants come from the class names
 * in `theme.ts`.
 */
export function EmailLayout({
	brand,
	locale,
	title,
	preview,
	footer,
	children,
}: {
	brand: EmailBrand;
	locale: Locale;
	/** The `<title>`; screen readers and some clients announce it. */
	title: string;
	/** The preheader line shown in the inbox list. */
	preview: string;
	/** Why this message was sent, shown below the card. */
	footer: ReactNode;
	children: ReactNode;
}) {
	return (
		<html lang={locale} dir="ltr">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta httpEquiv="x-ua-compatible" content="ie=edge" />
				<meta name="color-scheme" content="light dark" />
				<meta name="supported-color-schemes" content="light dark" />
				<meta name="x-apple-disable-message-reformatting" />
				<title>{title}</title>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a stylesheet is exactly what belongs here */}
				<style dangerouslySetInnerHTML={{ __html: styleSheet() }} />
			</head>
			<body
				className={SURFACE.body}
				style={{
					backgroundColor: LIGHT.background,
					fontFamily: FONT_STACK,
					margin: 0,
					padding: 0,
					WebkitTextSizeAdjust: "100%",
				}}
			>
				<Preheader>{preview}</Preheader>
				<table
					role="presentation"
					cellPadding={0}
					cellSpacing={0}
					border={0}
					width="100%"
					className={SURFACE.body}
					style={{ backgroundColor: LIGHT.background, width: "100%" }}
				>
					<tbody>
						<tr>
							<td align="center" style={{ padding: "32px 16px 48px" }}>
								<table
									role="presentation"
									cellPadding={0}
									cellSpacing={0}
									border={0}
									width={CONTENT_WIDTH}
									className={SURFACE.container}
									style={{ width: `${CONTENT_WIDTH}px`, maxWidth: "100%", textAlign: "left" }}
								>
									<tbody>
										<tr>
											<td style={{ padding: "0 0 20px" }}>
												<BrandHeader brand={brand} />
											</td>
										</tr>
										<tr>
											<td
												className={`${SURFACE.card} ${SURFACE.gutter}`}
												style={{
													backgroundColor: LIGHT.card,
													border: `1px solid ${LIGHT.border}`,
													borderRadius: "16px",
													padding: "32px 36px 12px",
												}}
											>
												{children}
											</td>
										</tr>
										<tr>
											<td className={SURFACE.gutter} style={{ padding: "24px 36px 0" }}>
												<Footer brand={brand}>{footer}</Footer>
											</td>
										</tr>
									</tbody>
								</table>
							</td>
						</tr>
					</tbody>
				</table>
			</body>
		</html>
	);
}

function BrandHeader({ brand }: { brand: EmailBrand }) {
	return (
		<table role="presentation" cellPadding={0} cellSpacing={0} border={0}>
			<tbody>
				<tr>
					<td style={{ paddingRight: "10px", verticalAlign: "middle" }}>
						<img
							src={logoUrl(brand.issuer)}
							width="28"
							height="28"
							alt=""
							style={{ display: "block", width: "28px", height: "28px", borderRadius: "7px", backgroundColor: "#191a1c" }}
						/>
					</td>
					<td
						className={SURFACE.brand}
						style={{
							fontFamily: FONT_STACK,
							color: LIGHT.foreground,
							fontSize: "15px",
							lineHeight: "22px",
							fontWeight: "600",
							letterSpacing: "-0.01em",
							verticalAlign: "middle",
						}}
					>
						{brand.instanceName}
					</td>
				</tr>
			</tbody>
		</table>
	);
}

function Footer({ brand, children }: { brand: EmailBrand; children: ReactNode }) {
	return (
		<>
			<p
				className={SURFACE.subtle}
				style={{
					fontFamily: FONT_STACK,
					color: LIGHT.subtle,
					fontSize: "12px",
					lineHeight: "18px",
					margin: "0 0 8px",
				}}
			>
				{children}
			</p>
			<p
				className={SURFACE.subtle}
				style={{ fontFamily: FONT_STACK, color: LIGHT.subtle, fontSize: "12px", lineHeight: "18px", margin: 0 }}
			>
				{brand.instanceName} ·{" "}
				<a className={SURFACE.link} href={brand.issuer} style={{ color: LIGHT.primary, textDecoration: "none" }}>
					{brand.issuer}
				</a>
			</p>
		</>
	);
}
