import app from "./app.js";
import config from "./config.js";

app.listen(config.port, () => {
  console.log(`Budgify API démarrée sur le port ${config.port}`);
});
