// middleware/checkRole.js
export function checkRole(allowedRoles) {
  return (req, res, next) => {
    const user = req.session.user;

    if (!user) {
      return res.status(401).render("Error", {
        title: "Unauthorized",
        message: "You must be logged in to access this page.",
        error: {},
      });
    }

    const userRole = user.role?.toLowerCase();
    const allowed = allowedRoles.map(r => r.toLowerCase());

    if (!allowed.includes(userRole)) {
      return res.status(403).render("Error", {
        title: "Access Denied",
        message: "You do not have permission to view this page.",
        error: {},
      });
    }

    next();
  };
}
