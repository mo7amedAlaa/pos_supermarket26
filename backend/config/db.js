const mongoose = require("mongoose");

let connectionPromise = null;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not defined");
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGO_URI, {
        maxPoolSize: Number(process.env.DB_MAX_POOL_SIZE || 20),
        minPoolSize: Number(process.env.DB_MIN_POOL_SIZE || 1),
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 45000,
      })
      .then((conn) => {
        console.log(`MongoDB Connected: ${conn.connection.host}`);

        return conn.connection;
      })
      .catch((error) => {
        connectionPromise = null;

        console.error(`MongoDB Connection Error: ${error.message}`);

        throw error;
      });
  }

  return connectionPromise;
};

module.exports = connectDB;
