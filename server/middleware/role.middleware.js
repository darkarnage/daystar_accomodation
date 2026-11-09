// Middleware: restrict a route to given roles (student, admin).
// Use after attachUser. 401 = not logged in, 403 = logged in with the wrong role.
module.exports = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Please log in.' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have access to this.' });
  next();
};
