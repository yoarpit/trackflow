const express = require("express");
const mongoose = require("mongoose");
const Ride = require("../models/Ride");
const User = require("../models/User");
const { protect, allowRoles } = require("../middleware/auth");

const router = express.Router();
const validPoint = p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
  p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180;
const populatedRide = id => Ride.findById(id)
  .populate("passenger", "name phone")
  .populate("driver", "name phone isOnline location");

function emitRide(io, ride, event = "ride:updated") {
  const payload = { ride };
  if (ride.passenger?._id) io.to(`user:${ride.passenger._id}`).emit(event, payload);
  if (ride.driver?._id) io.to(`user:${ride.driver._id}`).emit(event, payload);
}

/**
 * @openapi
 * /api/rides:
 *   post:
 *     tags: [Rides]
 *     summary: Request a ride (passenger)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pickup, destination]
 *             properties:
 *               pickup:
 *                 type: object
 *                 required: [lat, lng]
 *                 properties:
 *                   lat: { type: number, example: 23.2599 }
 *                   lng: { type: number, example: 77.4126 }
 *               destination:
 *                 type: object
 *                 required: [lat, lng]
 *                 properties:
 *                   lat: { type: number, example: 23.2156 }
 *                   lng: { type: number, example: 77.4010 }
 *     responses:
 *       201: { description: Ride requested }
 */
router.post("/", protect, allowRoles("passenger"), async (req, res, next) => {
  try {
    const { pickup, destination } = req.body;
    if (!validPoint(pickup) || !validPoint(destination)) {
      return res.status(400).json({ message: "pickup and destination must contain valid numeric lat and lng" });
    }
    const ride = await Ride.create({ passenger: req.user._id, pickup, destination });
    const fullRide = await populatedRide(ride._id);
    const io = req.app.get("io");
    io.emit("ride:requested", { ride: fullRide });
    res.status(201).json({ ride: fullRide });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/rides/available:
 *   get:
 *     tags: [Rides]
 *     summary: List unassigned ride requests (drivers)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Available rides }
 */
router.get("/available", protect, allowRoles("driver"), async (_req, res, next) => {
  try {
    const rides = await Ride.find({ status: "requested", driver: null })
      .sort({ requestedAt: 1 }).populate("passenger", "name phone");
    res.json({ rides });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/rides/mine:
 *   get:
 *     tags: [Rides]
 *     summary: List the current user's rides
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Ride history }
 */
router.get("/mine", protect, async (req, res, next) => {
  try {
    const filter = req.user.role === "driver" ? { driver: req.user._id } : { passenger: req.user._id };
    const rides = await Ride.find(filter).sort({ createdAt: -1 })
      .populate("passenger", "name phone")
      .populate("driver", "name phone isOnline location");
    res.json({ rides });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/rides/{id}/accept:
 *   patch:
 *     tags: [Rides]
 *     summary: Accept a ride (driver)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Ride accepted }
 *       409: { description: Ride no longer available }
 */
router.patch("/:id/accept", protect, allowRoles("driver"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid ride ID" });
    if (!req.user.isOnline) return res.status(409).json({ message: "Go online before accepting rides" });
    const activeRide = await Ride.exists({ driver: req.user._id, status: { $in: ["accepted", "started"] } });
    if (activeRide) return res.status(409).json({ message: "Finish your current ride first" });
    const ride = await Ride.findOneAndUpdate(
      { _id: req.params.id, status: "requested", driver: null },
      { $set: { driver: req.user._id, status: "accepted", acceptedAt: new Date() } },
      { new: true }
    );
    if (!ride) return res.status(409).json({ message: "Ride is no longer available" });
    const fullRide = await populatedRide(ride._id);
    emitRide(req.app.get("io"), fullRide);
    res.json({ ride: fullRide });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/rides/{id}/status:
 *   patch:
 *     tags: [Rides]
 *     summary: Update ride status (assigned driver)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [started, completed, cancelled] }
 *     responses:
 *       200: { description: Status updated }
 */
router.patch("/:id/status", protect, allowRoles("driver"), async (req, res, next) => {
  try {
    const { status } = req.body;
    const transitions = { accepted: ["started", "cancelled"], started: ["completed"] };
    const ride = await Ride.findOne({ _id: req.params.id, driver: req.user._id });
    if (!ride) return res.status(404).json({ message: "Assigned ride not found" });
    if (!transitions[ride.status]?.includes(status)) {
      return res.status(400).json({ message: `Cannot change ride from ${ride.status} to ${status}` });
    }
    ride.status = status;
    if (status === "started") ride.startedAt = new Date();
    if (status === "completed") {
      ride.completedAt = new Date();
      req.user.isOnline = true;
      await req.user.save();
    }
    if (status === "cancelled") ride.driver = null;
    await ride.save();
    const fullRide = await populatedRide(ride._id);
    emitRide(req.app.get("io"), fullRide);
    if (status === "cancelled") req.app.get("io").emit("ride:requested", { ride: fullRide });
    res.json({ ride: fullRide });
  } catch (err) { next(err); }
});

module.exports = router;
