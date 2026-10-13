#!/bin/sh
# HX0 · point the site at ITS api. The pages name the api in one literal (the Railway host, ~30 places — docs/HOSTING-COUPLING.md,
# Web front-end); until they read one config, the container swaps that literal for CB_API_BASE when it starts. Unset = unchanged.
set -eu
RAILWAY='https://chitbridge-api-production.up.railway.app'
[ -n "${CB_API_BASE:-}" ] || { echo "cb-api-base: CB_API_BASE unset — the pages keep $RAILWAY"; exit 0; }
case "$CB_API_BASE" in http://*|https://*) ;; *) echo "cb-api-base: CB_API_BASE must start with http:// or https://" >&2; exit 1 ;; esac
BASE=$(printf '%s' "$CB_API_BASE" | sed 's#/*$##; s#[&|\\]#\\&#g')
n=0
for f in $(find /usr/share/nginx/html -type f \( -name '*.html' -o -name '*.js' \) -exec grep -l "$RAILWAY" {} +); do sed -i "s|$RAILWAY|$BASE|g" "$f"; n=$((n+1)); done
echo "cb-api-base: $n file(s) now call $CB_API_BASE"
