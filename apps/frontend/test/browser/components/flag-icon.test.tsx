import { describe, expect, it } from "vitest";
import { FlagIcon } from "@/components/flag-icon";
import { renderUi } from "../../support/render";

describe("FlagIcon", () => {
	it("draws the flags of the supported languages", async () => {
		const screen = await renderUi(
			<>
				<FlagIcon country="de" />
				<FlagIcon country="gb" />
			</>,
		);

		expect(screen.container.querySelectorAll("svg[viewBox='0 0 640 480']")).toHaveLength(2);
	});
});
