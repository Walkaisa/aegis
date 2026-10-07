import { describe, expect, it } from "vitest";
import * as account from "../src/account";
import * as api from "../src/api";
import * as audit from "../src/audit";
import * as clients from "../src/clients";
import * as identity from "../src/identity";
import * as contracts from "../src/index";
import * as updates from "../src/updates";
import * as users from "../src/users";

describe("public entry point", () => {
	it("exposes the modules of the package", () => {
		for (const module of [account, api, audit, clients, identity, updates, users]) {
			expect(contracts).toMatchObject(module);
		}
	});
});
