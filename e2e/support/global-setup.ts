import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, Network, Wait } from "testcontainers";

/** A port that is free right now; Aegis has to know it before it starts, since it is part of the issuer. */
function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			server.close(() => (typeof address === "object" && address ? resolve(address.port) : reject(new Error("No port"))));
		});
	});
}

/**
 * Starts PostgreSQL and the Aegis image under test on a network of their own, like a deployment
 * with `compose.yaml`, and hands the address to the tests through `AEGIS_E2E_URL`.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
	const network = await new Network().start();
	const database = await new PostgreSqlContainer("postgres:18-alpine")
		.withNetwork(network)
		.withNetworkAliases("database")
		.withDatabase("aegis")
		.withUsername("aegis")
		.withPassword("aegis")
		.start();

	const port = await freePort();
	const aegis = await new GenericContainer(process.env.AEGIS_E2E_IMAGE ?? "aegis:e2e")
		.withNetwork(network)
		.withExposedPorts({ container: 3000, host: port })
		.withEnvironment({
			AEGIS_ISSUER: `http://localhost:${port}`,
			AEGIS_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
			AEGIS_DATABASE_URL: "postgres://aegis:aegis@database:5432/aegis",
			AEGIS_UPDATE_CHECK: "false",
		})
		.withWaitStrategy(Wait.forHttp("/api/health", 3000))
		.start();

	process.env.AEGIS_E2E_URL = `http://localhost:${port}`;

	return async () => {
		await aegis.stop();
		await database.stop();
		await network.stop();
	};
}
