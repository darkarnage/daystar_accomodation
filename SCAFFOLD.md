# Project scaffold

Placeholder files only: each new file has one comment describing its job. No features are implemented yet.

```text
design/              Google Stitch exports, one folder per area (see design/README.md)
public/              Static frontend served by Express
  *.html             Site pages (index, browse, property, login, register, submit-property, about, contact)
  admin/             Admin pages (login, dashboard, listings)
  assets/css|js      One stylesheet / script per area
  assets/images|icons
server/
  index.js, db.js    Existing: Express app and MySQL pool
  routes/            URL -> controller mapping (auth, listings, submissions, admin)
  controllers/       Request handling and database queries
  middleware/        auth (cookie), role (permissions), upload (images)
db/                  schema.sql, seed.js (existing)
uploads/             Uploaded listing images (not committed)
```

## Notes
- The route, controller and middleware files are **not wired into `server/index.js` yet**. They are empty placeholders.
- Folders that would otherwise be empty contain a `.gitkeep` so Git tracks them.
- `.env` is local only. Copy `.env.example` to `.env`.
