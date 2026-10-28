const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
const { Server } = require("socket.io");
const { attachSocketHandlers } = require("./sockets");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const corsOptions = { origin: CLIENT_URL, credentials: true };
app.use(cors(corsOptions));
app.use(express.json({ limit: "100kb" }));

const io = new Server(server, { cors: corsOptions });
app.set("io", io);

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.0",
    info: { title: "TrackFlow API", version: "1.0.0", description: "Ride booking and driver tracking API" },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
      }
    }
  },
  apis: [path.join(__dirname, "routes", "*.js")]
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/api", (_req, res) => res.json({ message: "TrackFlow API is running" }));
app.get("/api/health", (_req, res) => res.status(200).json({
  success: true,
  database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
}));

// Register each router once.
app.use("/api/auth", require("./routes/auth"));
app.use("/api/drivers", require("./routes/drivers"));
app.use("/api/rides", require("./routes/rides"));

app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ message: "Invalid JSON body" });
  }
  console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : "Internal server error" });
});

attachSocketHandlers(io);

async function start() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing. Copy backend/.env.example to backend/.env");
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
    throw new Error("JWT_SECRET must be set to a unique secret of at least 24 characters.");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");
  server.listen(PORT, () => {
    console.log(`TrackFlow API running at http://localhost:${PORT}`);
    console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
  });
}
start().catch((err) => {
  console.error("Startup failed:", err.message);
  process.exit(1);
});

module.exports = { app, server, io };
