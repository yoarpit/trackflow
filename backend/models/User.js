const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["driver", "passenger"], required: true },
  phone: { type: String, trim: true, maxlength: 24, default: "" },
  isOnline: { type: Boolean, default: false },
  location: {
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
    updatedAt: { type: Date }
  }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
