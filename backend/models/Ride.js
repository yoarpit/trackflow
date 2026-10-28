const mongoose = require("mongoose");

const coordinateSchema = new mongoose.Schema({
  lat: { type: Number, required: true, min: -90, max: 90 },
  lng: { type: Number, required: true, min: -180, max: 180 }
}, { _id: false });

const rideSchema = new mongoose.Schema({
  passenger: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  pickup: { type: coordinateSchema, required: true },
  destination: { type: coordinateSchema, required: true },
  status: {
    type: String,
    enum: ["requested", "accepted", "started", "completed", "cancelled"],
    default: "requested"
  },
  requestedAt: { type: Date, default: Date.now },
  acceptedAt: Date,
  startedAt: Date,
  completedAt: Date
}, { timestamps: true });

module.exports = mongoose.model("Ride", rideSchema);
