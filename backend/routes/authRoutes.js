const express = require("express");
const router = express.Router();
const { login, getMe, createUser, getUsers } = require("../controllers/authController");
const { protect, authorize } = require("../middleware/auth");
const { loginLimiter } = require("../middleware/rateLimiters");

router.post("/login", loginLimiter, login);
router.get("/me", protect, getMe);
router.post("/users", protect, authorize("admin"), createUser);
router.get("/users", protect, authorize("admin"), getUsers);

module.exports = router;
