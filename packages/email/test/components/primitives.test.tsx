import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Panel, Text } from "../../src/components/primitives";

describe("Panel", () => {
	it("renders a title only when given one", () => {
		expect(renderToStaticMarkup(<Panel title="Not you?">Body</Panel>)).toContain("Not you?");
		const untitled = renderToStaticMarkup(<Panel>Body</Panel>);
		expect(untitled).toContain("Body");
		expect(untitled).not.toContain("font-weight:600");
	});
});

describe("Text", () => {
	it("uses the regular size and tone by default", () => {
		const regular = renderToStaticMarkup(<Text>Hello</Text>);
		const small = renderToStaticMarkup(
			<Text tone="muted" size="sm">
				Hello
			</Text>,
		);
		expect(regular).toContain("font-size:15px");
		expect(small).toContain("font-size:13px");
		expect(small).not.toBe(regular);
	});
});
