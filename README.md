# TrackFlow — Uber-style driver tracking MVP

A learning/demo ride-booking application built with React + Vite, Express, MongoDB/Mongoose, Socket.IO, JWT, Swagger, and Leaflet/OpenStreetMap.

## Features
- Passenger and driver registration/login with JWT.
- Role-based route protection.
- Drivers can go online/offline and publish GPS coordinates from the browser/device.
- Passengers can request a ride, see online drivers, and watch their assigned driver on a live map.
- Drivers can accept rides and update status: accepted → started → completed.
- Socket.IO location updates and ride events.
- Swagger API docs at `/api-docs`.

> This is an educational MVP, not a production ride-hailing service. It does not implement payments, identity verification, emergency dispatch, background GPS, fare calculation, or production-grade abuse prevention. Browser geolocation requires permission and works on `localhost` or HTTPS. Drivers must keep the app open for foreground GPS updates.

## Requirements
- Node.js 20+ recommended
- MongoDB Server running locally, or a MongoDB Atlas connection string

## Setup on Windows

### 1. Backend
```powershell
cd TrackFlow\backend
Copy-Item .env.example .env
npm install
```
Edit `.env`, especially `JWT_SECRET` and `MONGODB_URI`. Then:
```powershell
npm run dev
```
Backend: `http://localhost:5000`
Swagger: `http://localhost:5000/api-docs`

### 2. Frontend (second terminal)
```powershell
cd TrackFlow\frontend
Copy-Item .env.example .env
npm install
npm run dev
```
Open the Vite URL, normally `http://localhost:5173`.

### 3. Try it
1. Register one account with role `driver`, then log in and click **Go online**. Allow location permission.
2. Open a private/incognito window or another browser and register a `passenger`.
3. Request a ride from the passenger account.
4. Accept it in the driver account, then use the ride status controls.
5. Keep the driver dashboard open during the ride for live location updates.

## Project structure
```text
TrackFlow/
├── backend/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── sockets/
│   ├── .env.example
│   ├── package.json
│   └── server.js
└── frontend/
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── services/
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── styles.css
    ├── .env.example
    ├── index.html
    └── package.json
```

## Security and deployment notes
- Never commit `.env`; `.gitignore` excludes it.
- Use a long, unique `JWT_SECRET` and a restricted MongoDB user in deployment.
- Set `CLIENT_URL` and `VITE_API_URL` to your deployed HTTPS origins.
- Configure HTTPS and appropriate CORS origins for production.
- Do not expose precise driver location to arbitrary users: this MVP only sends it to the assigned passenger and lets authenticated users see the online-driver list. Add consent, retention limits, verification, rate limiting, and audit logging before real use.
