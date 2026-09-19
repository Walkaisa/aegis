import { SNOWFLAKE_EPOCH, type Snowflake } from "@aegis/contracts";
import { Snowflake as SnowflakeGenerator } from "@sapphire/snowflake";

/** The increment has 12 bits: 4096 snowflakes per millisecond. */
const MAX_INCREMENT = 4095;

/** Aegis runs as a single process, so worker and process ID keep the library defaults. */
const generator = new SnowflakeGenerator(SNOWFLAKE_EPOCH);

let lastTimestamp = 0;
let increment = 0;

/**
 * A new snowflake for any entity: accounts, sessions, applications, audit events, keys.
 *
 * The increment restarts every millisecond. Snowflakes therefore strictly increase and never
 * repeat: after 4096 within one millisecond, or when the clock steps back, the timestamp keeps
 * counting up from the last one used instead.
 */
export function newId(): Snowflake {
	let timestamp = Math.max(Date.now(), lastTimestamp);
	if (timestamp === lastTimestamp) {
		increment += 1;
		if (increment > MAX_INCREMENT) {
			timestamp += 1;
			increment = 0;
		}
	} else {
		increment = 0;
	}
	lastTimestamp = timestamp;
	return generator.generate({ timestamp, increment: BigInt(increment) }).toString();
}
