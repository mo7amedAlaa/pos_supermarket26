const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "غير مصرح - لا يوجد توكن" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user || !req.user.isActive) {
      return res.status(401).json({ message: "المستخدم غير موجود أو غير مفعل" });
    }
    next();
  } catch (err) {
    return res.status(401).json({ message: "توكن غير صالح" });
  }
};

// usage: authorize("admin") or authorize("admin", "cashier")
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "ليس لديك صلاحية للقيام بهذا الإجراء" });
  }
  next();
};

module.exports = { protect, authorize };
