#!/usr/bin/env bash
# Starts the production build with the local demo backend (for e2e tests and screenshots).
#   pnpm build:demo && pnpm serve:demo      -> http://localhost:3100
cd "$(dirname "$0")/.." && exec env NEXT_PUBLIC_VB_DEMO=true VB_SHOW_DRAFTS=true CRON_SECRET="${CRON_SECRET:-local-cron-secret}" PORT="${PORT:-3100}" pnpm -s start
