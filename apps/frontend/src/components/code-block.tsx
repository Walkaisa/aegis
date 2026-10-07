"use client";

import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/utils";

/** A copyable code sample with its file name, as shown in integration guides. */
export function CodeBlock({ file, code, className }: { file: string; code: string; className?: string }) {
	return (
		<div className={cn("overflow-hidden rounded-lg border bg-muted/30", className)}>
			<div className="flex h-10 items-center justify-between gap-2 border-b bg-muted/50 pr-1.5 pl-4">
				<span className="truncate font-mono text-xs text-muted-foreground">{file}</span>
				<CopyButton value={code} />
			</div>
			<pre className="overflow-x-auto overflow-y-hidden p-4 font-mono text-[12.5px] leading-relaxed">
				<code>{code}</code>
			</pre>
		</div>
	);
}
