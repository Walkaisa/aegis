#!/usr/bin/env bash
# Starts a built image next to PostgreSQL and checks that Aegis comes up: migrations run, the API
# answers and the web UI is reachable through the server. OpenID discovery stays unavailable
# until the setup is completed, so it is not checked here.
#
#   scripts/smoke-test.sh <image>
set -euo pipefail

image="${1:?Usage: scripts/smoke-test.sh <image>}"
network="aegis-smoke-$$"

cleanup() {
	docker logs aegis-smoke 2>&1 | tail -n 50 || true
	docker rm -f aegis-smoke aegis-smoke-db >/dev/null 2>&1 || true
	docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create "$network" >/dev/null
docker run -d --name aegis-smoke-db --network "$network" \
	-e POSTGRES_DB=aegis -e POSTGRES_USER=aegis -e POSTGRES_PASSWORD=smoke \
	postgres:18-alpine >/dev/null
docker run -d --name aegis-smoke --network "$network" -p 127.0.0.1:3000:3000 \
	-e AEGIS_ISSUER=http://localhost:3000 \
	-e AEGIS_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
	-e AEGIS_DATABASE_URL=postgres://aegis:smoke@aegis-smoke-db:5432/aegis \
	"$image" >/dev/null

for _ in $(seq 1 60); do
	if curl -fsS --max-time 10 http://localhost:3000/api/health >/dev/null 2>&1; then
		break
	fi
	sleep 2
done

curl -fsS --max-time 10 http://localhost:3000/api/health
echo
curl -fsS --max-time 10 http://localhost:3000/api/instance
echo
# A fresh instance redirects every page to the setup, which Next.js renders behind the server.
curl -fsS --max-time 10 -L -o /dev/null http://localhost:3000/
echo "Web UI: ok"
