// Middleware: guard the admin web pages (/admin/*.html). Without an admin session you are sent to the admin login page.
// (The admin API has its own check. This stops the pages themselves from being handed out to everyone.)
module.exports = (req, res, next) => {
  const isLoginPage = req.path === '/login.html' || req.path === '/login';
  if (isLoginPage || req.user?.role === 'admin') {
    res.set('Cache-Control', 'no-store');
    return next();
  }
  res.redirect('/admin/login.html?next=' + encodeURIComponent(req.originalUrl));
};
