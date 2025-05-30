// app.js
require("dotenv").config();
const Hapi = require("@hapi/hapi");

const init = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 3000,
    host: "localhost",
    routes: {
      cors: {
        origin: ['http://localhost:5173'], // Allow your frontend origin
        credentials: true, 
      },
    },
  });

  const authRoutes = require('./routes/authRoutes');
  server.route(authRoutes);

  const leaveTypeRoutes = require('./routes/leaveTypeRoutes');
  server.route(leaveTypeRoutes);

  const holidayRoutes = require('./routes/holidayRoutes');
  server.route(holidayRoutes);

  const userRoutes = require('./routes/userRoutes');
  server.route(userRoutes);

  const leaveBalanceRoutes = require('./routes/leaveBalanceRoutes');
  server.route(leaveBalanceRoutes);

  const leaveRequestRoutes = require('./routes/leaveRequestRoutes');
  server.route(leaveRequestRoutes);
  
  return server;
};

module.exports = init;
