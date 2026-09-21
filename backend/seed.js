// Run once: node seed.js
// Creates a default admin account so you can log in for the first time.
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const exists = await User.findOne({ username: "admin" });
  if (exists) {
    console.log("Admin user already exists (username: admin)");
    process.exit(0);
  }

  await User.create({
    name: "المدير",
    username: "admin",
    password: "admin123", // change immediately after first login
    role: "admin",
  });

  console.log("Default admin created -> username: admin | password: admin123");
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
