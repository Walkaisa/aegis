import type { IncomingMessage, ServerResponse } from "node:http";
import type Provider from "oidc-provider";
import { ApiError } from "../lib/errors.js";
import { createProvider, type OidcDependencies } from "./provider.js";

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

const setupRequired = () => new ApiError(503, "setup_required", "The initial setup has not been completed");

/**
 * Holds the current oidc-provider instance. Key material and lifetimes are fixed at construction
 * time, so the provider is rebuilt after setup, key rotation and settings changes. All persistent
 * state lives in PostgreSQL, so in-flight sign-ins survive a rebuild.
 */
export class OidcRuntime {
	private readonly deps: OidcDependencies;
	private currentProvider: Provider | null = null;
	private handler: RequestHandler | null = null;

	public constructor(deps: OidcDependencies) {
		this.deps = deps;
	}

	public get provider(): Provider | null {
		return this.currentProvider;
	}

	public async reload(): Promise<void> {
		if (!this.deps.settings.isSetupComplete()) {
			this.currentProvider = null;
			this.handler = null;
			return;
		}
		const provider = await createProvider(this.deps);
		this.currentProvider = provider;
		this.handler = provider.callback() as RequestHandler;
	}

	public requireProvider(): Provider {
		if (!this.currentProvider) {
			throw setupRequired();
		}
		return this.currentProvider;
	}

	public handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
		if (!this.handler) {
			throw setupRequired();
		}
		return this.handler(req, res);
	}
}
