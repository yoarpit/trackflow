const express = require("express");
const User = require("../models/User");
const Ride = require("../models/Ride");
const { protect, allowRoles } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/drivers/online:
 *   get:
 *     tags: [Drivers]
 *     summary: List online drivers with their current coordinates
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Online drivers }
 */
router.get("/online", protect, async (req, res, next) => {
  try {
    const drivers = await User.find({ role: "driver", isOnline: true, "location.lat": { $exists: true }, "location.lng": { $exists: true } })
      .select("name isOnline location");
    // Keep this endpoint for finding a driver; production apps should only reveal precise location when operationally justified.
    res.json({ drivers: drivers.map(d => ({ id: d._id, name: d.name, isOnline: d.isOnline, location: d.location })) });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/drivers/status:
 *   patch:
 *     tags: [Drivers]
 *     summary: Set current driver's online status
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isOnline]
 *             properties:
 *               isOnline: { type: boolean }
 *     responses:
 *       200: { description: Status updated }
 */
router.patch("/status", protect, allowRoles("driver"), async (req, res, next) => {
  try {
    if (typeof req.body.isOnline !== "boolean") return res.status(400).json({ message: "isOnline must be boolean" });
    if (!req.body.isOnline) {
      const activeRide = await Ride.exists({ driver: req.user._id, status: { $in: ["accepted", "started"] } });
      if (activeRide) return res.status(409).json({ message: "Complete or cancel your active ride before going offline" });
    }
    req.user.isOnline = req.body.isOnline;
    await req.user.save();
    const io = req.app.get("io");
    io.emit("driver:availability", { driverId: req.user._id.toString(), isOnline: req.user.isOnline });
    res.json({ isOnline: req.user.isOnline });
  } catch (err) { next(err); }
});

module.exports = router;
