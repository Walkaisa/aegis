// Container entrypoint (started by tini): runs the Aegis server and the Next.js web UI as two
// child processes. The UI only listens on loopback; the server is the single public entry point
// and proxies pages to it. If either process exits, the other one is stopped too, so the
// container exits and Docker's restart policy takes over.
import { spawn } from "node:child_process";

// Below Docker's default stop timeout of 10 seconds, so a clean exit wins over SIGKILL.
const SHUTDOWN_TIMEOUT_MS = 8_000;

// The UI never needs Aegis secrets such as AEGIS_ENCRYPTION_KEY or AEGIS_DATABASE_URL.
const webEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("AEGIS_")));

const children = [
	spawn(process.execPath, ["server.js"], {
		cwd: "/app/web/apps/web",
		env: { ...webEnv, HOSTNAME: "127.0.0.1", PORT: "3001" },
		stdio: "inherit",
	}),
	spawn(process.execPath, ["dist/index.js"], {
		cwd: "/app/server/apps/server",
		env: { ...process.env, AEGIS_WEB_UPSTREAM: "http://127.0.0.1:3001" },
		stdio: "inherit",
	}),
];

let stopping = false;

const isRunning = (child) => child.exitCode === null && child.signalCode === null;

function stop(exitCode) {
	if (stopping) {
		return;
	}
	stopping = true;
	process.exitCode = exitCode;
	for (const child of children.filter(isRunning)) {
		child.kill("SIGTERM");
	}
	setTimeout(() => process.exit(exitCode), SHUTDOWN_TIMEOUT_MS).unref();
}

for (const child of children) {
	child.on("error", (error) => {
		console.error("[aegis] Failed to start a process", error);
		stop(1);
	});
	child.on("exit", (code) => {
		// An unexpected exit, even with code 0, stops the container.
		stop(stopping ? (process.exitCode ?? 0) : code || 1);
		if (!children.some(isRunning)) {
			process.exit(process.exitCode);
		}
	});
}

for (const signal of ["SIGINT", "SIGTERM"]) {
	process.on(signal, () => stop(0));
}
