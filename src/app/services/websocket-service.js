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

    this.wss.on("connection", async (ws, req) => {
      // Добавляем метаданные к соединению
      ws.isWebSocketClient = true;
      ws.clientId = req.headers["sec-websocket-key"] || Date.now().toString();
      ws.userAgent = req.headers["user-agent"] || "unknown";
      ws.isMobile = /mobile|android|iphone|ipad|ipod/i.test(ws.userAgent);

      // Регистрируем только новые соединения, если это первый клиент
      const isFirstClient = this.clients.size === 0;
      this.clients.add(ws);

      if (isFirstClient) {
        console.log("Новое WebSocket подключение");
        this.startBroadcast();
        await hardwareMonitor.registerConnection();
      }

      this.sendInitialData(ws);

      ws.on("message", async (message) => {
        try {
          const data = JSON.parse(message.toString());

          // Обрабатываем сообщение о подключении клиента
          if (data.type === "clientConnected") {
            // Обновляем информацию о клиенте на основе полученных данных
            ws.clientType = data.clientType || "browser";
            ws.deviceType =
              data.deviceType || (ws.isMobile ? "mobile" : "desktop");

            console.log(
              `Клиент подключен: ${ws.clientType} (${ws.deviceType})`
            );

            // Для мобильных устройств увеличиваем интервал опроса
            if (ws.deviceType === "mobile") {
              console.log(
                "Мобильное устройство: установка увеличенного интервала обновления"
              );
              this.adjustDataIntervalForClient(ws, 5000); // 5 секунд вместо 2 для мобильных
            }
          }

          // Обработка других типов сообщений
          else if (data.type === "ping") {
            ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          } else if (data.type === "requestData") {
            this.sendCurrentData(ws);
          }
        } catch (error) {
          console.error(
            `Ошибка обработки сообщения от клиента: ${error.message}`
          );
        }
      });

      ws.on("close", async () => {
        this.clients.delete(ws);

        if (this.clients.size === 0) {
          console.log("Все WebSocket подключения закрыты");
          this.stopBroadcast();
          await hardwareMonitor.unregisterConnection();
        } else {
          console.log(
            `WebSocket подключение закрыто, осталось активных: ${this.clients.size}`
          );
        }
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

      // Получаем полное название процессора
      const fullCpuModel = os.cpus()[0].model;

      // Создаем сокращенное название процессора
      let shortCpuModel = fullCpuModel;

      // Упрощенный и более надежный подход к извлечению имени процессора
      if (fullCpuModel.includes("Intel")) {
        // Удаляем служебные метки и номер частоты
        let cleaned = fullCpuModel
          .replace(/\(R\)|\(TM\)|CPU|@.*$|processor/gi, "")
          .replace(/\s+/g, " ")
          .trim();

        // Извлекаем серию и модель (например, Core i5-9600K или Xeon E3-1230)
        if (
          cleaned.includes("Core") ||
          cleaned.includes("Xeon") ||
          cleaned.includes("Pentium") ||
          cleaned.includes("Celeron")
        ) {
          // Находим базовое название (Core i5, Xeon E3, и т.д.)
          const parts = cleaned.split(/\s+/);
          const brandIndex = Math.max(
            parts.findIndex((p) => p.includes("Core")),
            parts.findIndex((p) => p.includes("Xeon")),
            parts.findIndex((p) => p.includes("Pentium")),
            parts.findIndex((p) => p.includes("Celeron"))
          );

          if (brandIndex >= 0) {
            // Core i5, Core i7, Xeon и т.д.
            shortCpuModel = `Intel ${parts[brandIndex]}`;

            // Добавляем серию (i3, i5, i7, i9) если есть
            if (parts[brandIndex] === "Core" && parts.length > brandIndex + 1) {
              // Извлекаем только серию (i5, i7, i9) без номера модели
              const seriesMatch = parts[brandIndex + 1].match(/^(i[3579])/);
              if (seriesMatch) {
                shortCpuModel += ` ${seriesMatch[1]}`;
              } else {
                shortCpuModel += ` ${parts[brandIndex + 1]}`;
              }
            }
          } else {
            shortCpuModel =
              "Intel " + cleaned.split(/\s+/).slice(0, 2).join(" ");
          }
        } else {
          // Если конкретная серия не найдена, берем первые 2-3 слова
          shortCpuModel = "Intel " + cleaned.split(/\s+/).slice(0, 2).join(" ");
        }
      } else if (fullCpuModel.includes("AMD")) {
        // Удаляем служебные метки и номер частоты
        let cleaned = fullCpuModel
          .replace(/\(R\)|\(TM\)|CPU|@.*$|processor/gi, "")
          .replace(/\s+/g, " ")
          .trim();

        // Проверяем на наличие ключевых серий AMD
        if (
          cleaned.includes("Ryzen") ||
          cleaned.includes("Athlon") ||
          cleaned.includes("FX") ||
          cleaned.includes("Phenom")
        ) {
          // Находим базовое название (Ryzen 5, Athlon 64, и т.д.)
          const parts = cleaned.split(/\s+/);
          const brandIndex = Math.max(
            parts.findIndex((p) => p.includes("Ryzen")),
            parts.findIndex((p) => p.includes("Athlon")),
            parts.findIndex((p) => p.includes("FX")),
            parts.findIndex((p) => p.includes("Phenom"))
          );

          if (brandIndex >= 0) {
            // Ryzen 5, Ryzen 7, Athlon и т.д.
            shortCpuModel = `AMD ${parts[brandIndex]}`;

            // Добавляем только номер серии без модели (например, "5" из "5 3600")
            if (
              parts.length > brandIndex + 1 &&
              /^\d+$/.test(parts[brandIndex + 1])
            ) {
              shortCpuModel += ` ${parts[brandIndex + 1]}`;

              // Ограничиваем до AMD Ryzen 5, без номера модели
              if (shortCpuModel.includes("AMD Ryzen")) {
                shortCpuModel = shortCpuModel.replace(/(\d+).*$/, "$1");
              }
            }
          } else {
            shortCpuModel = "AMD " + cleaned.split(/\s+/).slice(0, 2).join(" ");
          }
        } else {
          // Если конкретная серия не найдена, берем первые 2-3 слова
          shortCpuModel = "AMD " + cleaned.split(/\s+/).slice(0, 2).join(" ");
        }
      }

      // Окончательная обработка - удаляем лишние пробелы и ограничиваем длину
      shortCpuModel = shortCpuModel.replace(/\s+/g, " ").trim();
      if (shortCpuModel.length > 20) {
        shortCpuModel = shortCpuModel.substring(0, 18) + "...";
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
              model: shortCpuModel,
              fullModel: fullCpuModel,
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

    const fullCpuModel = os.cpus()[0].model;
    let shortCpuModel = "CPU";

    if (fullCpuModel.includes("Intel")) {
      shortCpuModel = "Intel CPU";
    } else if (fullCpuModel.includes("AMD")) {
      shortCpuModel = "AMD CPU";
    }

    return {
      timestamp: new Date().toLocaleString("ru-RU").replace(",", ""),
      system: {
        os: {
          platform: os.platform(),
          arch: os.arch(),
          release: os.release(),
          cpu: {
            model: shortCpuModel,
            fullModel: fullCpuModel,
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

  // Метод для регулировки интервала отправки данных для отдельного клиента
  adjustDataIntervalForClient(ws, newInterval = 2000) {
    // Если есть существующий интервал, очищаем его
    if (ws._dataInterval) {
      clearInterval(ws._dataInterval);
      ws._dataInterval = null;
    }

    // Создаем новый интервал с указанной частотой
    const WebSocket = require("ws");
    const interval = setInterval(async () => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(interval);
        return;
      }

      try {
        const cpuTemp = await hardwareMonitor.getCpuTemp();
        const memInfo = await hardwareMonitor.getMemoryInfo();

        ws.send(
          JSON.stringify({
            type: "systemData",
            timestamp: Date.now(),
            cpuTemp,
            memInfo,
          })
        );
      } catch (error) {
        console.error("Ошибка отправки данных:", error.message);
      }
    }, newInterval);

    ws._dataInterval = interval;
    return interval;
  }
}

module.exports = new WebSocketService();
