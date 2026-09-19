import { toValidationIssues } from "@aegis/contracts";
import type { z } from "zod";
import { ApiError } from "./errors.js";

export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
	const result = schema.safeParse(input ?? {});
	if (!result.success) {
		throw new ApiError(400, "validation_failed", "Request validation failed", toValidationIssues(result.error));
	}
	return result.data;
}
