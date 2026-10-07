import type { z } from "zod";

/** The codes of the issues a schema reports for an input, in order; empty when the input is valid. */
export function issueCodes(schema: z.ZodType, input: unknown): string[] {
	return schema.safeParse(input).error?.issues.map((issue) => issue.message) ?? [];
}
