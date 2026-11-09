// Middleware: CSRF protection for requests that change data (POST, DELETE, ...).
// A page on another website can make the browser send our cookie, but it cannot read our pages, so it cannot know
// the session's CSRF token. Our own pages get the token from /api/auth/me and send it in an X-CSRF-Token header.
// Use after attachUser.
const crypto = require('crypto');

module.exports = (req, res, next) => {
  // 1. If the browser says where the request came from, it must be this site.
  const origin = req.headers.origin;
  if (origin) {
    let host = null;
    try { host = new URL(origin).host; } catch { /* bad Origin header */ }
    if (host !== req.headers.host) return res.status(403).json({ error: 'Request blocked: it came from another site.' });
  }
  // 2. The token in the header must match the one stored with this login session.
  const sent = req.headers['x-csrf-token'];
  const real = req.csrfToken;
  const matches = typeof sent === 'string' && real && sent.length === real.length &&
    crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(real));
  if (!matches) return res.status(403).json({ error: 'Security token missing or wrong. Please reload the page.' });
  next();
};
