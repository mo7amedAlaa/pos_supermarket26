const app = require("../server");
const connectDB = require("../config/db");

let initialized = false;

module.exports = async (req, res) => {
  if (!initialized) {
    await connectDB();
    initialized = true;
  }

  return app(req, res);
};
