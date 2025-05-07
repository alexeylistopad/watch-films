const express = require("express");
const router = express.Router();
const hardwareMonitor = require("../services/hardware-monitor-service");

router.get("/api/system/info", async (req, res) => {
  try {
    const data = {
      temperature: await hardwareMonitor.getCpuTemp(),
      memory: await hardwareMonitor.getMemoryInfo(),
      method: await hardwareMonitor.getCurrentTemperatureMethod(),
      timestamp: new Date().toISOString(),
      status: "success",
    };
    res.json(data);
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

router.post("/api/system/monitor", async (req, res) => {
  try {
    const action = req.body.action;
    if (action === "start") {
      await hardwareMonitor.init();
      res.json({ status: "success", message: "Мониторинг запущен" });
    } else if (action === "stop") {
      await hardwareMonitor.shutdown();
      res.json({ status: "success", message: "Мониторинг остановлен" });
    } else {
      res
        .status(400)
        .json({ status: "error", message: "Неизвестное действие" });
    }
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

module.exports = router;
