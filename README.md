# CampusNest

**Find a place to call home.**

CampusNest (the *Daystar Student Accommodation Finder*) is a student accommodation website for **Daystar University, Athi River**. Students can search for rooms, bedsits and hostels, compare rent and distance to campus, save favourites and contact the owner. Property owners can list a property without creating an account, and an admin checks every listing before students can see it.

CampusNest is an independent project and is not run by the university. It is a university group project.

## Contents

1. [Features](#features)
2. [Technology stack](#technology-stack)
3. [Prerequisites](#prerequisites)
4. [Get the code](#get-the-code)
5. [Install XAMPP and start MariaDB](#install-xampp-and-start-mariadb)
6. [Database setup](#database-setup)
7. [Environment configuration](#environment-configuration)
8. [Seed the database](#seed-the-database)
9. [Run the application](#run-the-application)
10. [Accounts and first use](#accounts-and-first-use)
11. [Testing](#testing)
12. [Project structure](#project-structure)
13. [Troubleshooting](#troubleshooting)
14. [Starting over, backups and security notes](#starting-over-backups-and-security-notes)

## Quick start for a new group member

Everyone on the team runs **their own copy** of CampusNest with **their own local XAMPP database and their own passwords**. Nobody shares a database, a `.env` file or credentials, and `.env` is never committed to Git (it is listed in `.gitignore`). The steps are explained in full in the sections below:

1. Install Node.js 20.10 or newer and XAMPP, then `git clone` the repository and run `npm install` ([Get the code](#get-the-code)).
2. Start **MySQL** (MariaDB) in the XAMPP Control Panel ([Install XAMPP](#install-xampp-and-start-mariadb)).
3. Create your own `daystar_accommodation` database and `daystar_app` user, and import `db/schema.sql` ([Database setup](#database-setup)).
4. Copy `.env.example` to `.env` and fill in **your** database password and **your** admin email and password ([Environment configuration](#environment-configuration)).
5. Run `npm run seed` to create the amenities and your admin account ([Seed the database](#seed-the-database)).
6. Run `npm run dev` and open <http://localhost:3000> ([Run the application](#run-the-application)).

A fresh database has **no listings and no student accounts**: add your own through the site, or load optional sample data (see [Optional sample data](#optional-sample-data)).

## Features

**For students**
- Browse approved accommodation without logging in.
- Search by area or keyword; filter by room type, maximum rent, distance to campus and amenities; sort by newest, rent or distance. Active filters show as chips, and every search has a shareable address.
- Create a free student account, save listings to **your own** favourites, and see the owner's phone and email (contact details are shown to logged-in students only).
- Optional **AI-assisted search** on the browse page: describe what you want in a sentence and Gemini turns it into the normal filters (see [Run the application](#run-the-application)).

**For property owners**
- List a property with a form: no account needed. Add up to 5 JPG or PNG photos (2 MB each) and your contact details.
- A contact form (`/contact.html`) saves visitors' messages in the database (`contact_messages`). Nothing is emailed and there is no admin inbox yet: read them in phpMyAdmin.
- Every submission starts as *pending*. It appears publicly only after an admin approves it, and only while it is marked available.

**For the admin**
- A separate admin login with a dashboard and a moderation page.
- Approve a listing, reject it with a required reason, or delete it (its uploaded photos are deleted too).
- The admin can see pending listings, their photos and the owner contact details.

**Built-in safety**
- Passwords are stored as bcrypt hashes. Logins use HttpOnly cookie sessions stored in the database.
- Changes to the admin area and to favourites need a CSRF token. Failed logins, property submissions and AI searches are rate limited.
- Photos of listings that are not public are only served to the admin. Uploaded files are checked by their real contents, not their names.

The optional sample listings (see [Optional sample data](#optional-sample-data)) use **illustrative stock photos** from Pexels. They are labelled "Sample photo", credited on `/image-sources.html`, and are not pictures of the listed properties.

## Technology stack

| Part | Technology |
|---|---|
| Frontend | HTML, CSS and vanilla JavaScript (no framework). DM Sans and Inter fonts are included in the project. |
| Backend | Node.js and Express 5 |
| Database | **MariaDB from XAMPP**, on `127.0.0.1:3306`, used through the `mysql2` package (no ORM) |
| Accounts | bcrypt password hashes, HttpOnly cookie sessions stored in the database |
| Uploads | `multer`; photos are stored in the `uploads/` folder and only their paths are stored in the database |
| AI search (optional) | Google Gemini, called from the server with Node's built-in `fetch` |
| Tests | Node's built-in test runner (`node --test`) |

## Prerequisites

Install these on your computer first. The steps below are written for **Windows 10 or 11** and PowerShell. XAMPP also exists for Linux and macOS: the steps are the same, but the Control Panel and folder paths differ.

- **XAMPP** from <https://www.apachefriends.org/>. The current Windows installers include MariaDB 10.11. Any XAMPP that includes **MariaDB 10.4 or newer** works.
- **Node.js 20.10 or newer** (the project is tested on Node 22) from <https://nodejs.org/>. This also installs `npm`.
- **Git** from <https://git-scm.com/>.
- A code editor such as **VS Code**.
- *Optional:* a Gemini API key from Google AI Studio, only for the AI search box. The site works fully without it.

Check Node and npm in PowerShell:

```powershell
node --version    # should print v20.10.0 or higher
npm --version
```

## Get the code

```powershell
git clone https://github.com/darkarnage/daystar_accomodation.git
cd daystar_accomodation
npm install
```

(The folder name `daystar_accomodation` is spelled that way in the repository.)

## Install XAMPP and start MariaDB

1. Run the XAMPP installer. Keep **MySQL** and **phpMyAdmin** ticked (phpMyAdmin also needs **Apache**). Install into the default folder, `C:\xampp`.
2. Open the **XAMPP Control Panel**.
3. Click **Start** next to **MySQL**. The module is still called *MySQL*, but XAMPP runs **MariaDB** there. When it turns green, MariaDB is listening on **port 3306**.
4. To use phpMyAdmin, also click **Start** next to **Apache**, then open <http://localhost/phpmyadmin>. If you prefer the command line, you do not need Apache.

MariaDB must be running (green) every time you work on CampusNest. You stop and start it in the Control Panel.

By default the XAMPP database account `root` has **no password**. You use `root` only for the one-time setup below. The application never uses `root`: it uses its own limited user.

**If MySQL will not start, or another program already uses port 3306:** another MySQL or MariaDB installation (for example a Windows service) may be using the port. Find it with `netstat -ano | findstr :3306`, then stop that service. If you must use a different port, change `port=` in XAMPP's `my.ini` (Control Panel, MySQL row, **Config**) and use the same number as `DB_PORT` in `.env`.

**Recommended:** make sure MariaDB only accepts connections from your own computer. In the Control Panel, click **Config** on the MySQL row, choose `my.ini`, add this line under the `[mysqld]` heading, save, and restart MySQL:

```ini
bind-address=127.0.0.1
```

## Database setup

You will create the `daystar_accommodation` database, create the database user the application uses, and import the tables. Do this **once**. You can use phpMyAdmin or the command line.

### Step 1: create the database and the application user

**phpMyAdmin:** open <http://localhost/phpmyadmin>, click the **SQL** tab, paste the statements below (after replacing `choose-a-strong-password`) and click **Go**.

**Command line:** open PowerShell in the project folder and start the MariaDB client as `root`:

```powershell
& "C:\xampp\mysql\bin\mysql.exe" -u root
```

(If you gave `root` a password, add `-p`.) Then paste the statements below at the `MariaDB [(none)]>` prompt. Type `exit` when you are done.

```sql
CREATE DATABASE IF NOT EXISTS daystar_accommodation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'daystar_app'@'localhost'  IDENTIFIED BY 'choose-a-strong-password';
CREATE USER IF NOT EXISTS 'daystar_app'@'127.0.0.1'  IDENTIFIED BY 'choose-a-strong-password';

GRANT ALL PRIVILEGES ON daystar_accommodation.* TO 'daystar_app'@'localhost';
GRANT ALL PRIVILEGES ON daystar_accommodation.* TO 'daystar_app'@'127.0.0.1';
FLUSH PRIVILEGES;
```

What this does:
- **The database** `daystar_accommodation` is created with the `utf8mb4` character set, so accents and emoji are stored correctly.
- **The user** `daystar_app` is the account the application logs in with. Use the **same password** in both `CREATE USER` lines, and remember it: it goes into `.env` as `DB_PASSWORD`. Use only letters and digits to avoid quoting problems.
- **Two user lines** (`localhost` and `127.0.0.1`) are needed because MariaDB treats them as different hosts, and Node connects over `127.0.0.1`.
- **The grants** give `daystar_app` full rights on this one database and nothing else. It cannot see or change any other database.

### Step 2: import the tables

The file `db/schema.sql` creates the eight tables (`users`, `listings`, `listing_images`, `amenities`, `listing_amenities`, `favourites`, `sessions`, `contact_messages`). It only creates tables and never deletes or empties anything.

**phpMyAdmin:** click the `daystar_accommodation` database in the left list, open the **Import** tab, choose the file `db\schema.sql` from the project folder, and click **Import**.

**Command line:** start the client as `root` again, from the project folder, and run:

```sql
USE daystar_accommodation;
SOURCE db/schema.sql;
```

### Step 3: check it worked

In phpMyAdmin the database should now list 8 tables, or in the client run:

```sql
USE daystar_accommodation;
SHOW TABLES;
```

Expected tables: `amenities`, `favourites`, `listing_amenities`, `listing_images`, `listings`, `sessions`, `users`.

If you import `schema.sql` a second time you will see *"table already exists"* errors. That is harmless: nothing is changed.

### Updating an existing database

If your database was created before a feature was added, it may be missing a table. The `db/migrations/` folder has small SQL files for that. They only **create** what is missing (`CREATE TABLE IF NOT EXISTS`): they never drop, empty or change existing tables or rows, and running one twice is harmless. Take a backup first (see [Starting over, backups and security notes](#starting-over-backups-and-security-notes)).

| Migration | Adds | Needed when |
|---|---|---|
| `db/migrations/001-contact-messages.sql` | The `contact_messages` table for the contact form | Your database has 7 tables, not 8. Until you run it, sending the contact form shows an error. |

phpMyAdmin: select your database (`daystar_accommodation`, and `daystar_accommodation_test` if you made one), open **Import**, choose the file, click **Import**. Or in the client: `USE daystar_accommodation; SOURCE db/migrations/001-contact-messages.sql;`. A new database made from `db/schema.sql` already has the table.

## Environment configuration

The application reads its settings from a file named **`.env`** in the project folder. It is not stored in Git because it contains passwords. Create it from the template:

```powershell
Copy-Item .env.example .env
code .env        # or open it in any editor
```

Save it as plain **UTF-8** text, and make sure the name is exactly `.env` (not `.env.txt`).

| Variable | Meaning |
|---|---|
| `PORT` | The port the website uses. Default `3000`. |
| `DB_HOST` | `127.0.0.1` (use this, not `localhost`). |
| `DB_PORT` | `3306` (XAMPP's MariaDB). |
| `DB_NAME` | `daystar_accommodation` |
| `DB_USER` | `daystar_app` |
| `DB_PASSWORD` | The password you chose in step 1. |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The one admin account that `npm run seed` creates. The password needs at least 8 characters. The tests also log in with these values, against the test database. |
| `GEMINI_API_KEY` | Optional. Leave empty to hide the AI search box. |
| `AI_TIMEOUT_MS` | Optional. How long the server waits for Gemini's response, in milliseconds. `.env.example` sets `15000` (15 seconds); if the line is missing the server uses 8000 (8 seconds). See [AI-assisted search](#run-the-application). |
| `GEMINI_MODEL`, `AI_SEARCH_LIMIT_PER_HOUR` | Optional AI settings (see `.env.example`). |
| `NODE_ENV` | Set to `production` only when serving over https. |

Never share `.env`, never commit it, and never paste real passwords or API keys into chats, issues or screenshots.

## Seed the database

With MariaDB running and `.env` filled in:

```powershell
npm run seed
```

This is the normal first-time setup. It creates only:
- the **10 amenities** the application needs (Wi-Fi, Water 24/7, and so on);
- the **first admin account**, from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your own `.env` (the password is stored only as a bcrypt hash).

It creates **no demo accounts and no sample listings**. It is safe to run again: it never changes or deletes an existing user or listing. Expect output like:

```text
Amenities ready. Admin created: <your admin email>
```

Notes:
- The seed never overwrites an existing admin, so changing `ADMIN_PASSWORD` in `.env` later does not change the password of an admin that already exists.
- There is no admin registration page. The admin is always created this way, from the `.env` on your own computer.

### Optional sample data

Only if you want to look around a site that already has listings (for development or a demonstration):

```powershell
npm run seed:demo
```

This is a separate, explicit command. Run `npm run seed` first. It adds 13 sample listings with stock photos (only when the listings table is completely empty) and one sample student, `faith@student.daystar.ac.ke` with the password `demo-password`. The sample student is for development only: the command refuses to run with `NODE_ENV=production`, and the account should never exist on a public site. It never changes or deletes existing users or listings. To remove the sample data again, delete those listings in the admin dashboard.

## Run the application

Start MariaDB in the XAMPP Control Panel first, then:

```powershell
npm run dev       # restarts automatically when you edit server files
# or
npm start         # plain start, no auto-restart
```

You should see `http://localhost:3000` and a line like `injected env (10) from .env` (any number above 0 is fine). If it says `injected env (0)`, the `.env` file was not found or is empty.

Open <http://localhost:3000>. Useful addresses:

| Address | What it is |
|---|---|
| <http://localhost:3000/> | Home page |
| <http://localhost:3000/browse.html> | Browse and search |
| <http://localhost:3000/submit-property.html> | List a property (no account needed) |
| <http://localhost:3000/register.html> and `/login.html` | Student sign-up and login |
| <http://localhost:3000/admin/login.html> | Admin login |
| <http://localhost:3000/api/health> | Should show `{"ok":true,"db":"connected"}` when the database is reachable |

Stop the server with `Ctrl+C`.

**AI-assisted search (optional).** Put your key in `.env` as `GEMINI_API_KEY=...` and restart the server. A "Describe what you're looking for" box then appears at the top of the browse page. Check <http://localhost:3000/api/ai-search/status>: it should show `{"enabled":true}`. The key stays on the server, and only the visitor's sentence is sent to Google; listings and contact details are never shared. Without a key, the box is hidden and everything else works normally. If Google rejects the default model, set `GEMINI_MODEL` in `.env` to a model your key can use. **Timeout:** `AI_TIMEOUT_MS` in `.env` is how long the server waits for Gemini's response, in milliseconds. `.env.example` sets it to `15000` (15 seconds); if the line is missing from your `.env`, the server waits 8000 milliseconds (8 seconds). If the search sometimes reports "AI search is not available right now" and the server log shows `TimeoutError`, add `AI_TIMEOUT_MS=15000` to your `.env` and restart the server.

## Accounts and first use

| Account | How to get it |
|---|---|
| **Admin** | Created by `npm run seed` from your `.env`. Log in at <http://localhost:3000/admin/login.html> with `ADMIN_EMAIL` and `ADMIN_PASSWORD`. |
| **Student** | Register at `/register.html`, then log in at `/login.html`. |
| **Property owners** | No account: use `/submit-property.html`. |

Try the full workflow: submit a property as a visitor, log in as admin and approve it, then register as a student and find it on the browse page.

## Testing

The automated tests write to a database and start their own servers, so they use a **separate test database**, never your normal one. They refuse to run until one is configured. The code never creates, drops or resets a database: you create it once, yourself.

### One-time setup of the test database

1. In phpMyAdmin (SQL tab) or the MariaDB command line, create an empty test database and a user that can only use it. Replace the placeholder password:

   ```sql
   CREATE DATABASE IF NOT EXISTS daystar_accommodation_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER IF NOT EXISTS 'daystar_test'@'localhost' IDENTIFIED BY 'choose-another-strong-password';
   CREATE USER IF NOT EXISTS 'daystar_test'@'127.0.0.1' IDENTIFIED BY 'choose-another-strong-password';
   GRANT ALL PRIVILEGES ON daystar_accommodation_test.* TO 'daystar_test'@'localhost';
   GRANT ALL PRIVILEGES ON daystar_accommodation_test.* TO 'daystar_test'@'127.0.0.1';
   FLUSH PRIVILEGES;
   ```

   Because `daystar_test` has rights on the test database only, even a mistake in the tests could not reach `daystar_accommodation`.
2. Import `db/schema.sql` into **`daystar_accommodation_test`** (a test database made earlier needs [the migration](#updating-an-existing-database) instead) (select that database first in phpMyAdmin, then *Import*; or `USE daystar_accommodation_test; SOURCE db/schema.sql;`). Check that it now has 8 tables.
3. Add these settings to `.env` (see `.env.example`), or set them in the terminal for one session:

   | Variable | Value |
   |---|---|
   | `TEST_DB_NAME` | `daystar_accommodation_test` (must end in `_test` and must differ from `DB_NAME`) |
   | `TEST_DB_USER`, `TEST_DB_PASSWORD` | `daystar_test` and the password from step 1 |
   | `TEST_DB_HOST`, `TEST_DB_PORT` | Optional. Default `127.0.0.1` and `3306`. The host must be this computer. |

4. Fill the test database with the amenities, the admin and the sample listings and student that some tests read. This writes to the test database only (it runs both `db/seed.js` and `db/seed-demo.js` against it):

   ```powershell
   npm run seed:test
   ```

   (It uses `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`; the tests log in with them.)

### Running the tests

```powershell
npm test
```

Keep ports **3951 to 3959** and **3961 to 3965** free: the tests start their own servers there, connected to the test database. You do not need to start the application, and the tests never use a server that is already running (so they cannot reach your normal database through one). `TEST_URL` is no longer supported. Run one file with, for example, `node --test test/safenext.test.js`. The summary at the end should show `fail 0`.

### What the tests can change

- **Safety checks.** `test-support/testdb.js` runs first in every database test. It stops the run if `TEST_DB_NAME` is missing, does not end in `_test`, equals `DB_NAME`, or if the host is not this computer. It then points the tests, and every server they start, at the test database, and checks the connection really is on it. It also blanks `GEMINI_API_KEY` so no test can call the real Gemini.
- **Unique run id.** Each test file gets a random id. Everything it creates carries it: listings are titled `TEST-<id> ...` and student accounts have emails like `...-<id>-...@example.test`.
- **Deleted at the end:** only the listings and student accounts that contain that id (their photos rows, favourites and sessions go with them through the foreign keys), the login-session rows the run inserted itself or created by logging in, and its temporary uploads folder. Nothing else is ever deleted, so other `TEST-` listings or `@example.test` accounts are left alone.
- **Changed during a test, then put back:** a few tests change the status or availability of their own `TEST-<id>` listings. One test temporarily adds a database rule (a CHECK constraint named `chk_force_fail_<id>`) to the `listings` table of the test database to prove that photos are removed when saving fails. It is skipped if a rule with that name already exists, and only a rule the test itself added is dropped.
- **Files.** Uploaded test photos go to a new folder made by the operating system under the temp directory (`campusnest-test-...`), never to the project's `uploads/`. Before deleting it, the tests check it really is such a folder. The tests never write to `public/`.
- **Not touched:** the sample listings, the admin account and the sample student are only read.

### What this does not protect

- `.env` is read when tests start (to find the `TEST_DB_*` and `ADMIN_*` values), but the normal `DB_*` values are never used by a test run.
- If you point `TEST_DB_USER` at an account that also has rights on your normal database, only the code checks stand between the tests and that database. Use the separate `daystar_test` user.
- The test database is disposable, but it is a real database: do not keep anything you care about in it.

## Project structure

```text
README.md             This guide
CLAUDE.md             Project rules for contributors and AI assistants
SCAFFOLD.md           Short map of the folders
package.json          Dependencies and npm scripts (start, dev, seed, seed:demo, seed:test, test)
.env.example          Template for your private .env file (placeholders only)

db/
  schema.sql          The 8 tables (import once into daystar_accommodation)
  migrations/         Safe, one-time SQL updates for databases that already exist (see below)
  seed.js             `npm run seed`: creates the amenities and the first admin (from .env)
  seed-demo.js        `npm run seed:demo`: optional sample listings and sample student
  demo-listings.js    The 13 sample listings used by seed-demo.js

server/
  index.js            Express app: wires routes and middleware together
  db.js               MariaDB connection pool (reads the DB_* settings from .env)
  gemini.js           The only file that talks to Google's Gemini API
  routes/             URL to controller mapping (auth, listings, submissions, favourites, admin, ai-search, uploads)
  controllers/        Request handling and database queries
  middleware/         Login cookie, roles, CSRF, admin pages guard, photo upload rules

public/               The website (served by Express)
  *.html              Public pages (home, browse, property, login, register, submit, favourites, about, contact; image-sources.html holds the photo credits)
  admin/              Admin pages (login, dashboard, moderation)
  assets/css, js      Styles and page scripts
  assets/images       Sample photos for the optional sample listings (full size and a small copy)
  assets/fonts, icons Fonts and the favicon

uploads/              Photos uploaded through the form (not stored in Git)
test/                 Automated tests (run with npm test)
test-support/         Test safety checks (separate test database, cleanup) and `npm run seed:test`
design/               Design exports and notes
```

## Troubleshooting

| What you see | Why, and what to do |
|---|---|
| Server prints `injected env (0) from .env` | There is no usable `.env`. Check that the file is named exactly `.env` (not `.env.txt`), is in the project folder next to `package.json`, and is UTF-8. |
| `GET /api/listings failed:` with nothing after it, or `/api/health` shows `"db":"unreachable"` | The database cannot be reached. Start MySQL (MariaDB) in the XAMPP Control Panel, and check `DB_HOST=127.0.0.1` and `DB_PORT=3306` in `.env`. Using `localhost` as the host can hide the real error on some Node versions. |
| `Access denied for user 'daystar_app'...` | The password in `.env` does not match, or the user was not created for both hosts. Run the two `CREATE USER` and `GRANT` pairs from step 1 again, or reset the password with `ALTER USER 'daystar_app'@'localhost' IDENTIFIED BY 'new-password';` and the same for `'127.0.0.1'`, then update `DB_PASSWORD`. |
| `Unknown database 'daystar_accommodation'` | Step 1 was not done, or `DB_NAME` is spelled differently. |
| `Table 'daystar_accommodation.users' doesn't exist` | The schema was not imported. Do step 2. |
| MySQL will not start in XAMPP | Port 3306 is probably in use by another MySQL service (see the port note above). |
| `EADDRINUSE ... :3000` | Another program, or another copy of CampusNest, is already using port 3000. Close it, or set `PORT` in `.env`. |
| `npm install` fails while building `bcrypt` | Use Node 20.10 or newer (Node 22 is tested). If it still fails, install the **Desktop development with C++** workload from Visual Studio Build Tools and try again. |
| Admin login fails | The admin is created only by `npm run seed`, from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`. An admin that already exists keeps its original password. |
| The AI box does not appear | `GEMINI_API_KEY` is empty or the server was not restarted after adding it. Check `/api/ai-search/status`. |
| The site shows no listings | A new database starts empty. Submit a property at `/submit-property.html` and approve it in the admin dashboard, or load the optional sample data with `npm run seed:demo`. |
| `npm test`: `Refusing to run the tests` | The test database is not configured, or is unsafe. Read the message and follow [Testing](#testing). |
| `npm test`: a port is already in use | Stop any server using ports 3951 to 3959 or 3961 to 3965. |

## Starting over, backups and security notes

**Back up before experimenting.** In phpMyAdmin, select the database, open the **Export** tab and save the `.sql` file. Photos uploaded through the form are in the `uploads/` folder, so copy that folder too.

**Starting over (this permanently deletes all data in the database).** Only do this if you really want an empty database. In phpMyAdmin, select `daystar_accommodation`, open **Operations**, and use *Drop the database*; or run `DROP DATABASE daystar_accommodation;`. Then repeat steps 1 and 2 of [Database setup](#database-setup) and run `npm run seed` (and `npm run seed:demo` if you want the sample data). Photos in `uploads/` are not deleted by this, so remove them yourself if you want them gone.

**Security notes**
- `.env` holds passwords: never commit or share it. The `.gitignore` already excludes it, along with `node_modules/` and uploaded photos.
- The application connects as `daystar_app`, which only has rights on the `daystar_accommodation` database. It never uses `root`.
- Keep MariaDB reachable from your own computer only (see `bind-address` above) and do not open port 3306 in a firewall.
- Before putting the site on the internet: serve it over https, set `NODE_ENV=production` in `.env` (this marks the login cookie Secure, and `npm run seed:demo` then refuses to run), and use a strong admin password.
- The project rules (access control, uploads, CSRF, AI search) are listed in `CLAUDE.md`.
