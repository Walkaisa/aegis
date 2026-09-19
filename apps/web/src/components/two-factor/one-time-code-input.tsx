"use client";

import { TOTP_DIGITS } from "@aegis/contracts";
import { type ComponentProps, type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const digitsOnly = (value: string) => value.replace(/\D/g, "").slice(0, TOTP_DIGITS);

/**
 * Six-digit code from an authenticator app, shown as a row of compact slots. A single
 * transparent input covers the slots, so typing, pasting and the one-time-code autofill of mobile
 * keyboards and password managers work as usual. `onComplete` fires once all digits are entered.
 */
export function OneTimeCodeInput({
	ref,
	value,
	onChange,
	onComplete,
	className,
	...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
	ref?: Ref<HTMLInputElement>;
	value: string;
	onChange: (value: string) => void;
	onComplete?: (value: string) => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [focused, setFocused] = useState(false);
	const completed = useRef(false);
	const latest = useRef({ value, onChange });
	latest.current = { value, onChange };
	const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";

	useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

	// Password managers may fill the field without a React change event; adopt what they put there.
	useEffect(() => {
		const input = inputRef.current;
		if (!input) {
			return;
		}
		const adopt = () =>
			queueMicrotask(() => {
				const filled = digitsOnly(input.value);
				if (filled !== latest.current.value) {
					latest.current.onChange(filled);
				}
			});
		input.addEventListener("input", adopt);
		input.addEventListener("change", adopt);
		return () => {
			input.removeEventListener("input", adopt);
			input.removeEventListener("change", adopt);
		};
	}, []);

	useEffect(() => {
		if (value.length < TOTP_DIGITS) {
			completed.current = false;
		} else if (!completed.current) {
			completed.current = true;
			onComplete?.(value);
		}
	}, [value, onComplete]);

	const activeIndex = Math.min(value.length, TOTP_DIGITS - 1);

	return (
		<div className={cn("relative w-fit", props.disabled && "opacity-50", className)}>
			<input
				{...props}
				ref={inputRef}
				type="text"
				inputMode="numeric"
				autoComplete="one-time-code"
				autoCapitalize="none"
				autoCorrect="off"
				spellCheck={false}
				maxLength={TOTP_DIGITS}
				value={value}
				onChange={(event) => onChange(digitsOnly(event.target.value))}
				onSelect={(event) => {
					// The caret always sits after the last digit, matching the highlighted slot.
					const input = event.currentTarget;
					const end = input.value.length;
					if (input.selectionStart !== end || input.selectionEnd !== end) {
						input.setSelectionRange(end, end);
					}
				}}
				onFocus={(event) => {
					setFocused(true);
					props.onFocus?.(event);
				}}
				onBlur={(event) => {
					setFocused(false);
					props.onBlur?.(event);
				}}
				className="absolute inset-0 z-20 size-full cursor-text opacity-0 disabled:cursor-not-allowed"
			/>
			<div aria-hidden="true" className="flex items-center gap-2">
				{Array.from({ length: TOTP_DIGITS }, (_, index) => {
					const digit = value[index];
					const active = focused && index === activeIndex;
					return (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: the slots are a fixed row
							key={index}
							className={cn(
								"flex h-11 w-10 items-center justify-center rounded-lg border border-input bg-background font-mono text-lg font-semibold tabular-nums shadow-xs transition-[border-color,box-shadow,background-color] duration-150 sm:h-12 sm:w-11 dark:bg-input/30",
								digit && "border-foreground/20 bg-muted/50 dark:bg-input/50",
								active && "border-ring ring-3 ring-ring/40",
								invalid && "border-destructive ring-destructive/20 dark:ring-destructive/40",
							)}
						>
							{digit ? (
								<span key={digit} className="animate-in duration-150 fade-in-0 zoom-in-75 motion-reduce:animate-none">
									{digit}
								</span>
							) : active ? (
								<span className="h-5 w-0.5 animate-caret-blink rounded-full bg-foreground" />
							) : null}
						</span>
					);
				})}
			</div>
		</div>
	);
}
