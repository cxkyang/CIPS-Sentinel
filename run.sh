#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

# macOS / Linux often have a system CA bundle that Node's bundled roots may miss.
if [ -z "${NODE_EXTRA_CA_CERTS:-}" ]; then
  for ca in /etc/ssl/cert.pem /etc/ssl/certs/ca-certificates.crt; do
    if [ -f "$ca" ]; then
      export NODE_EXTRA_CA_CERTS="$ca"
      break
    fi
  done
fi

exec node server.mjs
