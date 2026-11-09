# Project scaffold

The frontend in `public/` talks to the Express API in `server/` (MySQL for data, `uploads/` for photos). Favourites and a saved copy of the logged-in user are the only things kept in the browser. Gemini search is the one planned feature not built yet.

```text
design/              Google Stitch exports, one folder per area (see design/README.md)
public/              Static frontend served by Express
  *.html             Site pages (index, browse, property, login, register, submit-property, favourites, about, contact, credits)
  admin/             Admin pages (login, dashboard, listings)
  assets/css|js      One stylesheet / script per area
  assets/images|icons
server/
  index.js, db.js    Existing: Express app and MySQL pool
  routes/            URL -> controller mapping (auth, listings, submissions, admin)
  controllers/       Request handling and database queries
  middleware/        auth (cookie), role (student/admin), upload (images)
db/                  schema.sql, seed.js (existing)
uploads/             Uploaded listing images (not committed)
```

## Notes
- All route, controller and middleware files are wired into `server/index.js`. `npm test` runs the API tests (the server and database must be running).
- Folders that would otherwise be empty contain a `.gitkeep` so Git tracks them.
- `.env` is local only. Copy `.env.example` to `.env`.
