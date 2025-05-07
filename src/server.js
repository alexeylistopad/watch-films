const express = require("express");
const path = require("path");
const config = require("../config");
const os = require("os");
const process = require("process");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.static(path.join(__dirname, "assets")));

const getSystemInfo = () => {
  const formatMemory = (bytes) =>
    (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  return {
    os: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: formatMemory(os.totalmem()),
      freeMemory: formatMemory(os.freemem()),
      uptime: formatUptime(os.uptime()),
    },
    process: {
      nodeVersion: process.version,
      uptime: formatUptime(process.uptime()),
      memoryUsage: formatMemory(process.memoryUsage().heapUsed),
    },
  };
};

app.get("/ping", (req, res) => {
  res.render("ping-view", {
    timestamp: new Date()
      .toLocaleString("ru-RU", {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
      .replace(",", ""),
    system: getSystemInfo(),
    config: {
      port: config.server.port,
      monitors: config.monitors.count,
      debug: config.debug.useMockData,
    },
  });
});

app.listen(config.server.port, config.server.host, () => {
  console.log(`Сервер запущен на http://localhost:${config.server.port}`);
});
