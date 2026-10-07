/**
 * A stable pick from a non-empty list by a seed such as a hash: the item at `seed` modulo the length.
 * Seeds that are negative or not integers pick the first item.
 */
export function pickBy<T>(items: readonly [T, ...T[]], seed: number): T {
	return items[seed % items.length] ?? items[0];
}
