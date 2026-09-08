# Running this on Windows (Command Prompt)

These steps use `cmd.exe` (Command Prompt) — not PowerShell, not Git Bash.
Click Start, type `cmd`, press Enter, and run everything below in that
window. This walks through running the school platform (**Winfield**, in
`apps\school`). The other app in this repo (`apps\marketplace`) follows the
same pattern — swap the folder name.

## 1. Install prerequisites (one-time)

1. **Node.js** — download the LTS installer from
   https://nodejs.org and run it (accept the defaults). This also installs
   `npm`.
2. **PostgreSQL** — download the installer from
   https://www.postgresql.org/download/windows/ and run it.
   - When asked for a password for the `postgres` user, set it to
     `postgres` (or pick your own — you'll use it below).
   - Keep the default port `5432`.
   - You can leave pgAdmin unused; the app talks to Postgres directly.
3. Confirm both installed correctly — in your `cmd` window:

   ```bat
   node -v
   npm -v
   psql --version
   ```

   Each should print a version number. If `psql` isn't recognized, open a
   **new** Command Prompt window (Windows only picks up new install paths
   in fresh windows) and try again.

## 2. Unzip the project

Unzip the delivered `.zip` file somewhere simple, e.g. `C:\klaso`, then in
`cmd`:

```bat
cd C:\klaso
```

(Adjust the path to wherever you unzipped it.)

## 3. Install dependencies

From the repo root (`C:\klaso`), install once — this sets up both apps:

```bat
npm install
```

This can take a few minutes the first time.

## 4. Create the database

Still in `cmd`:

```bat
psql -U postgres -h localhost -c "CREATE DATABASE klaso_school;"
```

It will prompt for the postgres password you set during install.

## 5. Configure environment variables

```bat
cd apps\school
copy .env.example .env
```

Open the new `apps\school\.env` file in Notepad:

```bat
notepad .env
```

Set `DATABASE_URL` to match what you created, e.g.:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/klaso_school?schema=public"
```

(Replace `postgres:postgres` with `postgres:<your password>` if you chose a
different one.) Save and close Notepad. `AUTH_SECRET` can be any random
string — for local testing you can leave the placeholder, but it's better
to generate a real one:

```bat
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Paste the output as the value of `AUTH_SECRET` in `.env`.

The AI assistant (`/dashboard/assistant` once you're signed in) is
optional — everything else in the app works without it. To turn it on,
paste a real key into `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in `.env`
before starting the app in step 7. With neither set, the assistant page
just says it isn't configured — it won't make anything else break.

## 6. Set up the database schema and demo data

Still inside `apps\school`:

```bat
npx prisma migrate dev
npm run db:seed
```

The seed command creates a demo school ("Winfield Montessori School") with staff
logins, a parent login and a student login, and 110 students, and prints the
login credentials to the screen — scroll up in the window to see them (all
use password `Passw0rd!23`).

## 7. Start the app

```bat
npm run dev
```

Leave this window open — it's your local server. Open a browser and go to:

```
http://localhost:3001
```

Sign in with one of the seeded accounts (e.g. `owner@winfield.demo` /
`Passw0rd!23`), or click **Set up your school** to run through the real
onboarding wizard and create a brand-new school. The seeded school also
comes with 110 generated invoices under **Finance → Invoices** — open one
and copy its "Share with a parent" link into a private/incognito window to
try the payer's side (no login) of paying online or by bank transfer.

To see the parent/student side, sign in as `parent@winfield.demo` or
`student@winfield.demo` (same password) — you'll land on `/portal` instead
of `/dashboard`, with that family's own attendance, results, assignments,
timetable, fees, announcements and messages.

To stop the server, click back into the `cmd` window and press `Ctrl+C`.

## Troubleshooting

- **`'npm' is not recognized...`** — Node.js isn't installed or you need a
  fresh Command Prompt window after installing it.
- **`psql` / database connection errors** — make sure the PostgreSQL
  service is running (Windows Services app → look for `postgresql-x64-...`
  → should say "Running"), and double-check the password in `.env` matches
  what you set during install.
- **Port already in use** — if something else is already using port 3001,
  stop it, or run `npm run dev -- -p 3002` and visit that port instead.
