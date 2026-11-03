// Starts the HTTP server.
const app = require("./src/app");
const config = require("./src/config");

app.listen(config.port, () => console.log(`Task Tracker API listening on port ${config.port}`));
