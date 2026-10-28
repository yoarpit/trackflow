const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const router = express.Router();
const safeUser = (user) => ({
  id: user._id, name: user.name, email: user.email, role: user.role,
  phone: user.phone, isOnline: user.isOnline, location: user.location
});
const makeToken = (user) => jwt.sign(
  { id: user._id.toString(), role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a driver or passenger
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name: { type: string, example: Arpit }
 *               email: { type: string, example: arpit@example.com }
 *               password: { type: string, example: ChangeMe123! }
 *               role: { type: string, enum: [driver, passenger] }
 *               phone: { type: string, example: "+91 9876543210" }
 *     responses:
 *       201: { description: Account created }
 *       400: { description: Invalid input or email already registered }
 */
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, role, phone = "" } = req.body;
    if (!name?.trim() || !email?.trim() || typeof password !== "string" || password.length < 8 ||
        !["driver", "passenger"].includes(role)) {
      return res.status(400).json({ message: "Provide name, valid email, password (at least 8 characters), and role (driver or passenger)." });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(400).json({ message: "Email is already registered" });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash, role, phone });
    return res.status(201).json({ token: makeToken(user), user: safeUser(user) });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: "Email is already registered" });
    next(err);
  }
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Log in
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid credentials }
 */
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    res.json({ token: makeToken(user), user: safeUser(user) });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get the logged-in user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Current user }
 *       401: { description: Unauthorized }
 */
router.get("/me", protect, (req, res) => res.json({ user: safeUser(req.user) }));

module.exports = router;
