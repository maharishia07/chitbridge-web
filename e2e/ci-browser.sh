#!/bin/sh
# ci-browser.sh: install Chromium for Playwright on a GitHub runner. Every workflow that drives a browser calls it from e2e/.
# --with-deps needs apt and the Ubuntu mirrors. On 11 Nov 2026 the runners could not resolve them on 24.04 or 26.04
# ("Temporary failure resolving 'azure.archive.ubuntu.com'"), so every walk and the proof went red with no code fault.
# Two tries with the system packages; then the browser alone, because the hosted image already carries Chrome's libraries.
set -u
for try in 1 2; do
  sudo apt-get -o Acquire::Retries=3 update -qq && npx playwright install --with-deps chromium && exit 0
  echo "browser install with system packages failed (try $try of 2), waiting 20 s"; sleep 20
done
echo "the Ubuntu mirrors are unreachable: installing the browser alone and using the image's own libraries"
npx playwright install chromium
