const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Ride = require("../models/Ride");

function attachSocketHandlers(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.id);
      if (!user) return next(new Error("User not found"));
      socket.user = user;
      next();
    } catch (_err) {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    socket.join(`user:${user._id}`);
    socket.emit("socket:ready", { userId: user._id.toString(), role: user.role });

    // Only drivers can send GPS. Server validates and stores coordinates.
    socket.on("driver:location", async (coords, ack = () => {}) => {
      try {
        if (user.role !== "driver") return ack({ ok: false, message: "Only drivers can publish GPS" });
        const lat = Number(coords?.lat);
        const lng = Number(coords?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return ack({ ok: false, message: "Invalid coordinates" });
        }
        const dbUser = await User.findById(user._id);
        if (!dbUser?.isOnline) return ack({ ok: false, message: "Go online before sharing location" });
        dbUser.location = { lat, lng, updatedAt: new Date() };
        await dbUser.save();

        const activeRide = await Ride.findOne({
          driver: dbUser._id, status: { $in: ["accepted", "started"] }
        }).select("passenger");
        if (activeRide) {
          io.to(`user:${activeRide.passenger}`).emit("driver:location", {
            driverId: dbUser._id.toString(), lat, lng, updatedAt: dbUser.location.updatedAt
          });
          io.to(`user:${dbUser._id}`).emit("driver:location:ack", { ok: true });
        }
        ack({ ok: true });
      } catch (_err) {
        ack({ ok: false, message: "Could not save location" });
      }
    });

    socket.on("ride:watch", async ({ rideId } = {}, ack = () => {}) => {
      try {
        const ride = await Ride.findById(rideId);
        if (!ride) return ack({ ok: false, message: "Ride not found" });
        const userId = user._id.toString();
        if (ride.passenger.toString() !== userId && ride.driver?.toString() !== userId) {
          return ack({ ok: false, message: "You are not part of this ride" });
        }
        socket.join(`ride:${ride._id}`);
        ack({ ok: true });
      } catch (_err) { ack({ ok: false, message: "Unable to join ride room" }); }
    });
  });
}

module.exports = { attachSocketHandlers };
