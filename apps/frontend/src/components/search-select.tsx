"use client";

import { ChevronsUpDown } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SearchSelectOption {
	value: string;
	label: string;
	/** Secondary text next to the label, e.g. "Default" or the resolved system value. */
	hint?: string;
	keywords?: string[];
	icon?: ReactNode;
	lang?: string;
}

/** A select with a search field; the combobox pattern from shadcn/ui. */
export function SearchSelect({
	id,
	value,
	onChange,
	options,
	placeholder,
	searchPlaceholder,
	emptyMessage,
	ariaLabel,
	disabled = false,
	className,
}: {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	options: SearchSelectOption[];
	placeholder: string;
	searchPlaceholder: string;
	emptyMessage: string;
	ariaLabel?: string;
	disabled?: boolean;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const selected = options.find((option) => option.value === value);

	return (
		<Popover open={open && !disabled} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					role="combobox"
					aria-expanded={open}
					aria-label={ariaLabel}
					disabled={disabled}
					className={cn("h-9 w-full justify-between gap-2 px-3 font-normal", className)}
				>
					<span className="flex min-w-0 items-center gap-2.5">
						{selected?.icon}
						<span className={cn("truncate", !selected && "text-muted-foreground")} lang={selected?.lang}>
							{selected?.label ?? placeholder}
						</span>
						{selected?.hint ? <span className="truncate text-muted-foreground">{selected.hint}</span> : null}
					</span>
					<ChevronsUpDown className="text-muted-foreground" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-56 p-0">
				<Command>
					<CommandInput placeholder={searchPlaceholder} />
					<CommandList className="max-h-72">
						<CommandEmpty>{emptyMessage}</CommandEmpty>
						<CommandGroup>
							{options.map((option) => (
								<CommandItem
									key={option.value}
									value={option.value}
									keywords={[option.label, ...(option.hint ? [option.hint] : []), ...(option.keywords ?? [])]}
									onSelect={() => {
										onChange(option.value);
										setOpen(false);
									}}
									data-checked={option.value === value}
									className="gap-2.5"
								>
									{option.icon}
									<span className="min-w-0 flex-1 truncate" lang={option.lang}>
										{option.label}
										{option.hint ? <span className="text-muted-foreground"> {option.hint}</span> : null}
									</span>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
