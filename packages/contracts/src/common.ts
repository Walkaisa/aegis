/** Counts Unicode code points instead of UTF-16 code units. */
export function codePointLength(value: string): number {
	let length = 0;
	for (const _ of value) {
		length += 1;
	}
	return length;
}

export type IsoDateString = string;
