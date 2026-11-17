# Project scaffold

The frontend in `public/` talks to the Express API in `server/` (MariaDB from XAMPP for data, `uploads/` for photos). Only a saved copy of the logged-in user's name is kept in the browser: favourites are stored per student in the database. AI-assisted search (Gemini) is an optional extra. For setup steps see `README.md`.

```text
README.md            Setup guide (XAMPP MariaDB), how to run and test
design/              Google Stitch exports, one folder per area (see design/README.md)
public/              Static frontend served by Express
  *.html             Site pages (index, browse, property, login, register, submit-property, favourites, about, contact, image-sources)
  admin/             Admin pages (login, dashboard, listings)
  assets/css|js      One stylesheet / script per area
  assets/images|icons|fonts
server/
  index.js, db.js    Express app and the MariaDB connection pool
  gemini.js          The only file that talks to Google's Gemini API
  routes/            URL -> controller mapping (auth, listings, submissions, favourites, admin, ai-search, uploads)
  controllers/       Request handling and database queries
  middleware/        auth (cookie), role (student/admin), csrf, adminpage, upload (images)
db/                  schema.sql (tables), seed.js (admin, demo data), demo-listings.js (demo listings)
test/                Automated API and unit tests (npm test)
test-support/        Test safety layer (separate test database, scoped cleanup) and seed:test
uploads/             Uploaded listing images (not committed)
```

## Notes
- All route, controller and middleware files are wired into `server/index.js`. `npm test` runs the API tests against a separate `_test` database (see README, "Testing"); the tests start their own servers.
- Folders that would otherwise be empty contain a `.gitkeep` so Git tracks them.
- `.env` is local only. Copy `.env.example` to `.env`.
