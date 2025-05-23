// server.js
const init = require("./app");

const startServer = async () => {
  try {
    const server = await init();
    await server.start();
    console.log(`🚀 Server running on ${server.info.uri}`);
  } catch (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
};

startServer();
