const express = require("express");
const path = require("path");
const config = require("../config");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.static(path.join(__dirname, "assets")));

app.listen(config.server.port, config.server.host, () => {
  console.log(`Сервер запущен на http://localhost:${config.server.port}`);
});
