#!/usr/bin/env bash
# Starts a built image next to PostgreSQL and checks that Aegis works as a single process:
# migrations run, the API answers, the exported frontend is served without shadowing API or
# protocol routes, the setup opens the OpenID Connect endpoints, the health check passes and
# `docker stop` shuts Aegis down cleanly.
#
#   scripts/smoke-test.sh <image>
set -euo pipefail

image="${1:?Usage: scripts/smoke-test.sh <image>}"
network="aegis-smoke-$$"
base="http://localhost:3000"

cleanup() {
	docker logs aegis-smoke 2>&1 | tail -n 50 || true
	docker rm -f aegis-smoke aegis-smoke-db >/dev/null 2>&1 || true
	docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
	echo "FAIL: $1" >&2
	exit 1
}

# expect <method> <path> <status> [content type]: the response has this status and content type.
expect() {
	local result
	result=$(curl -sS -o /dev/null -X "$1" --max-time 10 -w '%{http_code} %{content_type}' "$base$2")
	[[ "$result" == "$3 ${4:-}"* ]] || fail "$1 $2 answered '$result', expected '$3 ${4:-}'"
	echo "ok: $1 $2 -> $result"
}

# header <path> <pattern>: a response header matches the extended regular expression.
header() {
	curl -sS -o /dev/null -D - --max-time 10 "$base$1" | grep -qiE "$2" || fail "$1 has no header matching '$2'"
	echo "ok: $1 has '$2'"
}

docker network create "$network" >/dev/null
docker run -d --name aegis-smoke-db --network "$network" \
	-e POSTGRES_DB=aegis -e POSTGRES_USER=aegis -e POSTGRES_PASSWORD=smoke \
	postgres:18-alpine >/dev/null
docker run -d --name aegis-smoke --network "$network" -p 127.0.0.1:3000:3000 \
	--health-interval 2s \
	-e AEGIS_ISSUER=http://localhost:3000 \
	-e AEGIS_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
	-e AEGIS_DATABASE_URL=postgres://aegis:smoke@aegis-smoke-db:5432/aegis \
	-e AEGIS_UPDATE_CHECK=false \
	"$image" >/dev/null

for _ in $(seq 1 60); do
	if [ "$(docker inspect -f '{{.State.Health.Status}}' aegis-smoke)" = "healthy" ]; then
		break
	fi
	sleep 2
done
[ "$(docker inspect -f '{{.State.Health.Status}}' aegis-smoke)" = "healthy" ] || fail "the container did not become healthy"
echo "ok: health check"

# Exactly one process: Node.js running the backend, no supervisor and no Next.js server.
processes=$(docker exec aegis-smoke sh -c 'for p in /proc/[0-9]*; do [ "${p#/proc/}" = "$$" ] || tr "\0" " " < "$p/cmdline"; echo; done' | sed '/^ *$/d')
[ "$processes" = "node dist/index.js " ] || fail "unexpected processes in the container: $processes"
echo "ok: single process"

expect GET /api/health 200 application/json
expect GET /api/instance 200 application/json

# A fresh instance leads every page to the setup; the protocol stays unavailable until then.
expect GET / 303
expect GET /users/123 303
expect GET /setup 200 text/html
header /setup "^content-security-policy: .*script-src 'self' 'sha256-"
header /setup "^cache-control: no-store"
expect GET /.well-known/openid-configuration 503 application/json
expect GET /oauth2/authorize 503 application/json

# Static files of the frontend, with long-lived caching only for content-hashed files.
asset=$(curl -fsS --max-time 10 "$base/setup" | grep -oE '/_next/static/[^"]+\.js' | head -n 1)
expect GET "$asset" 200 application/javascript
header "$asset" "^cache-control: public, max-age=31536000, immutable"
expect GET /favicon.ico 200
expect GET /manifest.webmanifest 200 application/manifest+json
expect GET /brand/logo.png 200 image/png
header /brand/logo.png "^cross-origin-resource-policy: cross-origin"

# Routes of the backend never fall through to the frontend.
expect GET /api 404 application/json
expect GET /api/unknown 404 application/json
expect GET /.well-known/unknown 404 application/json
expect POST /unknown 404 application/json

curl -fsS --max-time 30 -X POST -H 'content-type: application/json' \
	-d "{\"instanceName\":\"Smoke\",\"displayName\":\"Smoke Admin\",\"email\":\"admin@smoke.test\",\"password\":\"$(openssl rand -hex 16)\"}" \
	"$base/api/setup" >/dev/null
echo "ok: setup"

expect GET /.well-known/openid-configuration 200 application/json
expect GET /.well-known/jwks.json 200
expect GET /sign-in 200 text/html
# Both sign-ins share the URL; each is served from its own export and shows its own form without JavaScript.
curl -fsS --max-time 10 "$base/sign-in" | grep -q 'type="password"' || fail "/sign-in does not show the sign-in form"
curl -fsS --max-time 10 "$base/sign-in?challenge=smoke" | grep -q 'type="password"' && fail "/sign-in?challenge= shows the administration sign-in"
echo "ok: sign-in variants"
expect GET /setup 303
expect GET "/sign-in.txt?_rsc=smoke" 200 text/plain
# Without a session, administration pages lead to the sign-in, and their payloads are unavailable.
expect GET /users/123/settings 303
expect GET /users.txt 404 application/json

start=$(date +%s)
docker stop aegis-smoke >/dev/null
elapsed=$(($(date +%s) - start))
[ "$(docker inspect -f '{{.State.ExitCode}}' aegis-smoke)" = "0" ] || fail "Aegis did not exit cleanly on SIGTERM"
[ "$elapsed" -lt 10 ] || fail "docker stop took ${elapsed}s, so Aegis was killed after the timeout"
docker logs aegis-smoke 2>&1 | grep -q '"msg":"Shutting down"' || fail "Aegis did not log its shutdown"
echo "ok: graceful shutdown in ${elapsed}s"
