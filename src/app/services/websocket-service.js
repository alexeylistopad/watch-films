const WebSocket = require("ws");
const os = require("os");
const hardwareMonitor = require("./hardware-monitor-service");
const config = require("../../../config");

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Set();
    this.lastCpuInfo = null;
    this.broadcastInterval = null;
  }

  init(server) {
    this.wss = new WebSocket.Server({ server });
    console.log("WebSocket сервер запущен");

    this.wss.on("connection", async (ws) => {
      console.log("Новое WebSocket подключение");
      this.clients.add(ws);

      if (this.clients.size === 1) {
        this.startBroadcast();
      }

      await hardwareMonitor.registerConnection();
      this.sendInitialData(ws);

      ws.on("close", async () => {
        this.clients.delete(ws);
        console.log("WebSocket подключение закрыто");

        if (this.clients.size === 0) {
          this.stopBroadcast();
        }

        await hardwareMonitor.unregisterConnection();
      });
    });
  }

  startBroadcast() {
    if (!this.broadcastInterval) {
      console.log("Запуск интервала отправки системной информации");
      this.broadcastInterval = setInterval(() => this.broadcast(), 1000);
    }
  }

  stopBroadcast() {
    if (this.broadcastInterval) {
      console.log("Остановка интервала отправки системной информации");
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
  }

  async sendInitialData(ws) {
    try {
      const data = await this.collectData();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    } catch (error) {
      console.error("Ошибка отправки начальных данных:", error);
    }
  }

  getCpuUsage() {
    const cpus = os.cpus();
    if (!this.lastCpuInfo) {
      this.lastCpuInfo = cpus;
      return 0;
    }

    const usage = cpus.map((cpu, index) => {
      const prevCpu = this.lastCpuInfo[index];
      const prevTotal = Object.values(prevCpu.times).reduce((a, b) => a + b);
      const currentTotal = Object.values(cpu.times).reduce((a, b) => a + b);
      const idle = cpu.times.idle - prevCpu.times.idle;
      const total = currentTotal - prevTotal;
      return ((total - idle) / total) * 100;
    });

    this.lastCpuInfo = cpus;
    return usage.reduce((a, b) => a + b) / cpus.length;
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  }

  async collectData() {
    try {
      const cpuUsage = this.getCpuUsage();
      let cpuTemperature = null;
      let memoryInfo = null;

      if (this.clients.size > 0) {
        cpuTemperature = await hardwareMonitor.getCpuTemp();
        memoryInfo = await hardwareMonitor.getMemoryInfo();
      }

      let totalMemory, freeMemory, usedMemory;
      if (memoryInfo && memoryInfo.total) {
        totalMemory = memoryInfo.total;
        freeMemory = memoryInfo.free;
        usedMemory = memoryInfo.used;
      } else {
        totalMemory = os.totalmem() / 1024 / 1024 / 1024;
        freeMemory = os.freemem() / 1024 / 1024 / 1024;
        usedMemory = totalMemory - freeMemory;
      }

      return {
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
        system: {
          os: {
            platform: os.platform(),
            arch: os.arch(),
            release: os.release(),
            cpu: {
              model: os.cpus()[0].model,
              count: os.cpus().length,
              speed: (os.cpus()[0].speed / 1000).toFixed(2),
              load: cpuUsage.toFixed(1),
              temp: cpuTemperature || "N/A",
            },
            totalMemory: totalMemory.toFixed(2),
            freeMemory: freeMemory.toFixed(2),
            usedMemory: usedMemory.toFixed(2),
            memoryUsagePercent: ((usedMemory / totalMemory) * 100).toFixed(1),
            uptime: this.formatUptime(os.uptime()),
          },
          process: {
            nodeVersion: process.version,
            uptime: this.formatUptime(process.uptime()),
            memoryUsage:
              (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1) + " MB",
          },
        },
        config: {
          port: config.server.port,
          monitors: config.monitors.count,
          debug: !!config.debug?.useMockData,
        },
      };
    } catch (error) {
      console.error("Ошибка сбора данных:", error);
      return this.getFallbackData();
    }
  }

  getFallbackData() {
    const totalMemory = os.totalmem() / 1024 / 1024 / 1024;
    const freeMemory = os.freemem() / 1024 / 1024 / 1024;
    const usedMemory = totalMemory - freeMemory;

    return {
      timestamp: new Date().toLocaleString("ru-RU").replace(",", ""),
      system: {
        os: {
          platform: os.platform(),
          arch: os.arch(),
          release: os.release(),
          cpu: {
            model: os.cpus()[0].model,
            count: os.cpus().length,
            speed: (os.cpus()[0].speed / 1000).toFixed(2),
            load: "0.0",
            temp: "N/A",
          },
          totalMemory: totalMemory.toFixed(2),
          freeMemory: freeMemory.toFixed(2),
          usedMemory: usedMemory.toFixed(2),
          memoryUsagePercent: ((usedMemory / totalMemory) * 100).toFixed(1),
          uptime: this.formatUptime(os.uptime()),
        },
        process: {
          nodeVersion: process.version,
          uptime: this.formatUptime(process.uptime()),
          memoryUsage: "N/A",
        },
      },
      config: {
        port: config.server.port || 3060,
        monitors: config?.monitors?.count || 1,
        debug: !!config?.debug?.useMockData,
      },
    };
  }

  async broadcast() {
    if (this.clients.size === 0) return;

    try {
      const data = await this.collectData();
      this.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (error) {
      console.error("Ошибка отправки данных:", error);
    }
  }
}

module.exports = new WebSocketService();
