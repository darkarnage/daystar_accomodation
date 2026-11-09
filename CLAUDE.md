# CampusNest (Daystar Student Accommodation Finder)

University group project. Student accommodation finder for Daystar University, Athi River campus.
Deadline: 24 November 2026. Keep everything simple and beginner-friendly.

## Stack
HTML/CSS/vanilla JS frontend (`public/`), Node.js + Express backend (`server/`), MySQL 8 in Docker (`db/`).
No frontend framework, no ORM, no TypeScript. Do not add dependencies without a clear need.

## Roles
Student (browse, favourites, sees owner contact), Admin (approves/rejects listings). There are no landlord accounts: property owners use the public submission form (no login) and give their contact details in it.

## Rules
- Normal database search/filtering must work on its own. Gemini natural-language search is an optional extra, added last.
- Public pages show only `approved` listings that are `available`. Taken, pending and rejected listings are hidden from public pages (admins can still see them). New submissions go to `pending`.
- The owner contact (name/phone/email on the listing) is visible only to logged-in students, and the API must not return it to anyone else.
- Validate input on every API endpoint (plain checks, no validation library).
- SQL: always `?` placeholders, never string-built queries.
- Deleting a listing (admin): DB rows cascade, but image files do not. Read `file_path` from `listing_images` first, delete rows, then `fs.unlink` each file.
- Never commit `.env`. Never store the admin password in plain text (`db/seed.js` hashes it).
- MySQL is bound to `127.0.0.1:3308` only.

## Commands
`npm run db:up` / `db:down` / `db:reset`, `npm run seed`, `npm run dev` (http://localhost:3000), `npm test` (API checks; needs the server and database running).

## Layout
See `SCAFFOLD.md`. Designs from Google Stitch go in `design/` and are the reference for the frontend.
