#!/bin/bash
# RiskPilot one-click setup for Mac/Linux. Double-click this file (or run: bash start-mac.command).
cd "$(dirname "$0")" || exit 1
fail() { echo; echo "  PROBLEM: $1"; echo "  Take a screenshot of this window and send it to whoever is helping you."; read -r -p "  Press Enter to close" _; exit 1; }
step() { echo; echo "  [$1/5] $2"; }

echo; echo "  =============================="; echo "    RiskPilot - setup"; echo "  =============================="

step 1 "Checking Node.js"
command -v node >/dev/null 2>&1 || fail "Node.js is not installed. Go to https://nodejs.org , install the LTS version, then open this file again."
MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$MAJOR" -ge 20 ] || fail "Your Node.js is too old ($(node -v)). Install the newest LTS from https://nodejs.org and try again."
echo "      Node.js $(node -v) - OK"

step 2 "Connecting to your database"
if [ ! -f .env ]; then
  echo; echo "      Paste your database connection string below, then press Enter."
  echo "      (It starts with postgresql:// - see START-HERE.txt, Part 2.)"; echo
  read -r -p "      Connection string: " DB
  DB=$(echo "$DB" | sed -e 's/^[[:space:]"'"'"']*//' -e 's/[[:space:]"'"'"']*$//')
  case "$DB" in postgres://*|postgresql://*) ;; *) fail "That does not look like a connection string. It must start with postgresql://" ;; esac
  SECRET=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 48)
  {
    echo "DATABASE_URL=\"$DB\""
    echo "AUTH_SECRET=\"$SECRET\""
    echo "AUTH_URL=\"http://localhost:3000\""
    echo "APP_URL=\"http://localhost:3000\""
    echo "PAYMENT_PROVIDER=\"mock\""
    echo "STORAGE_PROVIDER=\"local\""
    echo "STORAGE_LOCAL_DIR=\".uploads\""
  } > .env
  echo "      Saved."
else echo "      Already set up - OK"; fi

step 3 "Installing the app's parts (first time only - 3 to 6 minutes, please wait)"
if [ ! -d node_modules ]; then npm install --no-audit --no-fund || fail "The install failed. Check your internet connection and try again."; else echo "      Already installed - OK"; fi

step 4 "Preparing the database"
npx prisma generate || fail "Could not prepare the app code."
npx prisma migrate deploy || fail "Could not reach your database. Check the DATABASE_URL line in the .env file (use the DIRECT connection, not the 'pooled' one)."
if [ ! -f .seeded ]; then echo "      Adding demo data..."; npm run db:seed || fail "Could not add the demo data."; echo done > .seeded; fi

step 5 "Starting RiskPilot"
echo; echo "      Your browser will open in a few seconds. The first page can take ~30 seconds - that is normal."
echo "      Log in with:  demo@riskpilot.app  /  Passw0rd!"
echo "      KEEP THIS WINDOW OPEN while you use the app. Close it to stop RiskPilot."; echo
( sleep 12; (open "http://localhost:3000" || xdg-open "http://localhost:3000") >/dev/null 2>&1 ) &
npm run dev
