import { AEGIS_REPOSITORY_URL } from "@aegis/contracts";
import type { FastifyBaseLogger } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpdateChecker } from "../../src/services/updates.js";

function logger() {
	return { info: vi.fn(), warn: vi.fn() };
}

function checker(options: { enabled?: boolean; currentVersion?: string } = {}) {
	const log = logger();
	const updates = new UpdateChecker({
		currentVersion: options.currentVersion ?? "1.2.0",
		enabled: options.enabled ?? true,
		log: log as unknown as FastifyBaseLogger,
	});
	return { updates, log };
}

const release = (tag: string, init?: ResponseInit) =>
	Response.json({ tag_name: tag, published_at: "2026-09-01T12:00:00Z", body: "ignored" }, { headers: { etag: '"abc"' }, ...init });

afterEach(() => {
	vi.useRealTimers();
});

describe("UpdateChecker", () => {
	it("reports a newer release and tells the log", async () => {
		const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(release("v1.3.0"));
		const { updates, log } = checker();

		const status = await updates.check();

		expect(status).toEqual({
			current: "1.2.0",
			checkEnabled: true,
			latest: { version: "1.3.0", url: `${AEGIS_REPOSITORY_URL}/releases/tag/v1.3.0`, publishedAt: "2026-09-01T12:00:00Z" },
			updateAvailable: true,
			checkedAt: expect.any(String),
			checkFailed: false,
		});
		expect(log.info).toHaveBeenCalledWith({ current: "1.2.0", latest: "1.3.0" }, expect.stringContaining("Aegis 1.3.0 is available"));
		const [url, init] = fetch.mock.calls[0] ?? [];
		expect(url).toBe("https://api.github.com/repos/Walkaisa/aegis/releases/latest");
		expect(init?.headers).toEqual({
			accept: "application/vnd.github+json",
			"user-agent": "Aegis/1.2.0",
			"x-github-api-version": "2026-03-10",
		});
	});

	it("stays quiet about the running or an older release", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(release("v1.2.0")).mockResolvedValueOnce(release("1.1.0"));
		const { updates, log } = checker();

		expect((await updates.check()).updateAvailable).toBe(false);
		expect((await updates.check()).updateAvailable).toBe(false);
		expect(log.info).not.toHaveBeenCalled();
	});

	it("asks again with the ETag and keeps the release on 304 Not Modified", async () => {
		const fetch = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(release("v1.3.0"))
			.mockResolvedValueOnce(new Response(null, { status: 304 }));
		const { updates } = checker();

		const first = await updates.check();
		const second = await updates.check();

		expect(fetch.mock.calls[1]?.[1]?.headers).toMatchObject({ "if-none-match": '"abc"' });
		expect(second.latest).toEqual(first.latest);
		expect(second.checkFailed).toBe(false);
	});

	it("marks the check as failed and keeps the last known release", async () => {
		vi.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(release("v1.3.0"))
			.mockResolvedValueOnce(new Response("rate limited", { status: 403, statusText: "Forbidden" }))
			.mockResolvedValueOnce(release("nightly"))
			.mockResolvedValueOnce(Response.json({ unexpected: true }))
			.mockRejectedValueOnce(new TypeError("fetch failed"))
			.mockResolvedValueOnce(release("v1.3.0"));
		const { updates, log } = checker();
		await updates.check();

		for (const message of ["GitHub answered 403 Forbidden", 'tagged "nightly"', "", "fetch failed"]) {
			const status = await updates.check();
			expect(status).toMatchObject({ checkFailed: true, latest: { version: "1.3.0" } });
			expect(log.warn).toHaveBeenLastCalledWith(
				{ err: expect.objectContaining({ message: expect.stringContaining(message) }) },
				"Could not look for new Aegis releases",
			);
		}
		expect((await updates.check()).checkFailed).toBe(false);
	});

	it("treats 304 without an earlier answer as a failure", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 304 }));
		const { updates } = checker();

		expect((await updates.check()).checkFailed).toBe(true);
	});

	it("shares one request between concurrent checks", async () => {
		const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(release("v1.2.0"));
		const { updates } = checker();

		await Promise.all([updates.check(), updates.check(), updates.check()]);
		await updates.check();

		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it("never asks GitHub while it is turned off", async () => {
		const fetch = vi.spyOn(globalThis, "fetch");
		const { updates } = checker({ enabled: false });

		expect((await updates.check()).checkEnabled).toBe(false);
		updates.start()();
		expect(fetch).not.toHaveBeenCalled();
	});

	it("checks a minute after the start and then every ten minutes until stopped", async () => {
		vi.useFakeTimers();
		const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => release("v1.2.0"));
		const { updates } = checker();

		const stop = updates.start();
		await vi.advanceTimersByTimeAsync(59_000);
		expect(fetch).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1_000);
		expect(fetch).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(20 * 60_000);
		expect(fetch).toHaveBeenCalledTimes(3);

		stop();
		await vi.advanceTimersByTimeAsync(60 * 60_000);
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it("can be stopped before the first check", async () => {
		vi.useFakeTimers();
		const fetch = vi.spyOn(globalThis, "fetch");
		const { updates } = checker();

		updates.start()();
		await vi.advanceTimersByTimeAsync(60 * 60_000);

		expect(fetch).not.toHaveBeenCalled();
	});
});
