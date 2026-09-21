const jwt = require("jsonwebtoken");
const User = require("../models/User");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });

// @route POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "بيانات الدخول غير صحيحة" });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "بيانات الدخول غير صحيحة" });
    }
    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json(req.user);
};

// @route POST /api/auth/users  (admin only - create cashier/admin accounts)
exports.createUser = async (req, res) => {
  try {
    const { name, username, password, role } = req.body;
    const exists = await User.findOne({ username });
    if (exists) {
      return res.status(400).json({ message: "اسم المستخدم موجود بالفعل" });
    }
    const user = await User.create({ name, username, password, role });
    res.status(201).json({
      _id: user._id,
      name: user.name,
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/auth/users (admin only)
exports.getUsers = async (req, res) => {
  const users = await User.find().select("-password");
  res.json(users);
};
