# CampusNest (Daystar Student Accommodation Finder)

University group project. Student accommodation finder for Daystar University, Athi River campus.
Deadline: 24 November 2026. Keep everything simple and beginner-friendly.

## Stack
HTML/CSS/vanilla JS frontend (`public/`), Node.js + Express backend (`server/`), MariaDB from XAMPP (`db/`, `127.0.0.1:3306`). XAMPP MariaDB is the only supported local database setup (no Docker): see `README.md`.
No frontend framework, no ORM, no TypeScript. Do not add dependencies without a clear need.

## Roles
Student (browse, favourites, sees owner contact), Admin (approves, rejects and deletes listings). There are no landlord accounts: property owners use the public submission form (no login) and give their contact details in it.

## Rules
- Normal database search/filtering must work on its own. Gemini natural-language search is an optional extra, added last.
- Public pages show only `approved` listings that are `available`. Taken, pending and rejected listings are hidden from public pages (admins can still see them). New submissions go to `pending`.
- The owner contact (name/phone/email on the listing) is visible only to logged-in students, and the API must not return it to anyone else.
- Login: random token in an HttpOnly, SameSite=Lax cookie; only its SHA-256 hash is stored (`sessions` table). Passwords are bcrypt hashes. Protect routes with `requireRole(...)`; the frontend's saved `cn_user` is only a display copy, the server decides access.
- Uploads (`POST /api/submissions`, multer): JPG/PNG only, checked by file contents, max 5 photos of 2 MB, random filenames, stored in `uploads/` with the relative path in `listing_images.file_path`. Files are written only after the whole submission is valid, and removed again if the database step fails.
- Admin: the only admin is created by `db/seed.js` from `.env` (no admin registration). Admin login is `POST /api/auth/admin/login` (8-hour session). Everything under `/api/admin` needs `requireRole('admin')`, and every change also needs the CSRF token (`X-CSRF-Token`, from `/api/auth/me`) and a same-site Origin. Admin pages (`/admin/*.html`) are only served to a logged-in admin.
- Photos of listings that are not public (pending, rejected, taken) are only served to a logged-in admin (`GET /uploads/:name` checks the listing).
- Favourites belong to one student and live in the `favourites` table (`GET /api/favourites`, `PUT` / `DELETE /api/favourites/:listingId`). Every query uses `req.user.id` from the session, never an id sent by the browser, and changes need the CSRF token. Only public listings are returned. The browser must never store favourites (no localStorage): it keeps an in-memory copy for the logged-in student and reloads it from the server on every page.
- AI search (optional extra, browse page): `POST /api/ai-search` sends only the visitor's sentence to Gemini (key in `.env`, server-side only) and gets back filters. Gemini never sees listings or contact details and never writes SQL; its answer is checked against fixed lists and ranges, then the browser runs the normal search. With no key the AI box is hidden and everything else works. Only `server/gemini.js` talks to Google.
- Contact form: `POST /api/contact` (public, no login). Same-origin check (Origin / Sec-Fetch-Site) instead of the session CSRF token, per-IP rate limit, validated server-side, saved to `contact_messages` with `?` placeholders. Messages are only stored: nothing is emailed, and there is no admin inbox yet. Schema changes for existing databases go in `db/migrations/` as non-destructive SQL.
- Validate input on every API endpoint (plain checks, no validation library).
- SQL: always `?` placeholders, never string-built queries.
- Deleting a listing (admin): DB rows cascade, but image files do not. Read `file_path` from `listing_images` first, delete rows, then `fs.unlink` each file.
- Never commit `.env`. Never store the admin password in plain text (`db/seed.js` hashes it).
- The app connects to MariaDB at `127.0.0.1:3306` as its own limited user (`daystar_app`, rights on the `daystar_accommodation` database only), never as `root`. MariaDB should accept connections from this computer only. Database setup is manual (create database and user, import `db/schema.sql`): `db/schema.sql` never drops or empties anything.
- SQL must work on MariaDB 10.4 or newer, which is what XAMPP ships (MariaDB-compatible syntax only, for example `DROP CONSTRAINT`, not MySQL's `DROP CHECK`).

## Commands
`npm install`, `npm run seed` (amenities + first admin only, no demo data), `npm run seed:demo` (optional sample listings/student, never in production), `npm run dev` (http://localhost:3000) or `npm start`, `npm run seed:test`, `npm test` (API checks). Tests only run against a separate test database (`TEST_DB_*` in `.env`, name ends in `_test`, never `DB_NAME`); they start their own servers and delete only records carrying their own run id (`test-support/testdb.js`). There are no other database scripts: start and stop MariaDB in the XAMPP Control Panel.

## Layout
See `SCAFFOLD.md`. Designs from Google Stitch go in `design/` and are the reference for the frontend.
