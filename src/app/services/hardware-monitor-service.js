const path = require("path");
const fs = require("fs");
const child_process = require("child_process");
const os = require("os");

class HardwareMonitorService {
  constructor() {
    this.monitorProcess = null;
    const projectRoot = path.resolve(__dirname, "..", "..", "..");

    this.ohmPath = path.join(
      projectRoot,
      "node_modules",
      "open-hardware-monitor",
      "OpenHardwareMonitor.exe"
    );
    this.vbsPath = path.join(
      projectRoot,
      "node_modules",
      "open-hardware-monitor",
      "close_ohm.vbs"
    );

    // Путь к скрипту установки, если потребуется переустановка
    this.setupScript = path.join(projectRoot, "src", "setup", "setup-ohm.js");

    this.initialized = false;
    this.retriesCount = 0;
    this.maxRetries = 3;
    this.tempLogPath = path.join(os.tmpdir(), "ohm_temp_data.txt");
    this.memLogPath = path.join(os.tmpdir(), "ohm_mem_data.txt");
    this.updateInterval = null;
    this.activeConnections = 0;
    this.isMonitorRunning = false;
    this.wsServer = null;
    this.wsClients = new Set();
    this.lastMemLogTime = 0;
    this.lastTempLogTime = 0;
    this.logThreshold = 10000;

    // Переменные для управления переподключениями клиентов
    this.reconnectAttempts = {};
    this.maxReconnectAttempts = 5;
    this.reconnectTimeouts = {};
  }

  logWithThrottle(message, type = "memory") {
    const now = Date.now();
    let lastTime =
      type === "memory" ? this.lastMemLogTime : this.lastTempLogTime;

    if (now - lastTime > this.logThreshold) {
      console.log(message);
      if (type === "memory") {
        this.lastMemLogTime = now;
      } else {
        this.lastTempLogTime = now;
      }
    }
  }

  async registerConnection() {
    // Предотвращаем избыточное логирование при повторных соединениях
    const prevConnections = this.activeConnections;
    this.activeConnections++;

    if (prevConnections === 0) {
      console.log(`Подключение: активных ${this.activeConnections}`);
      if (!this.isMonitorRunning) {
        await this.init();
      }
    }
  }

  async unregisterConnection() {
    if (this.activeConnections > 0) {
      this.activeConnections--;
    }

    if (this.activeConnections === 0) {
      console.log(`Отключение: активных ${this.activeConnections}`);
      console.log("Нет активных подключений, останавливаем мониторинг");
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
      this.clearTempFiles();
      this.closeProgramWithElevatedRights();
      this.initialized = false;
      this.isMonitorRunning = false;
    }
  }

  async init() {
    try {
      if (this.isMonitorRunning) {
        return true;
      }

      if (!fs.existsSync(this.ohmPath)) {
        console.error("OpenHardwareMonitor.exe не найден:", this.ohmPath);
        console.error(
          "Пожалуйста, выполните `node src/setup/setup-ohm.js` для автоматической установки OpenHardwareMonitor"
        );
        return false;
      }

      try {
        const runningProcesses = child_process.execSync(
          "powershell.exe -Command \"Get-Process | Where-Object { $_.Name -eq 'OpenHardwareMonitor' } | Select-Object Id\"",
          { encoding: "utf8" }
        );

        if (runningProcesses && runningProcesses.includes("Id")) {
          console.log("OpenHardwareMonitor уже запущен");
          this.isMonitorRunning = true;
          this.startDataCollection();
          this.initialized = true;
          return true;
        }
      } catch (e) {
        // Процесс не найден
      }

      try {
        console.log("Запуск OpenHardwareMonitor...");
        child_process.execSync(
          `powershell.exe -Command "Start-Process '${this.ohmPath}' -WindowStyle Hidden -Verb RunAs"`,
          { stdio: "ignore" }
        );
        this.startDataCollection();
        this.initialized = true;
        this.isMonitorRunning = true;
        return true;
      } catch (psError) {
        try {
          child_process.execSync(
            `powershell.exe -Command "Start-Process '${this.ohmPath}' -WindowStyle Hidden"`,
            { stdio: "ignore" }
          );
        } catch (error) {
          console.error("Не удалось запустить OpenHardwareMonitor");
          return false;
        }
        this.startDataCollection();
        this.initialized = true;
        this.isMonitorRunning = true;
        return true;
      }
    } catch (error) {
      console.error("Ошибка инициализации:", error.message);
      return false;
    }
  }

  startDataCollection() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    if (this.activeConnections === 0) {
      return;
    }

    console.log("Запуск сбора данных");

    this.updateInterval = setInterval(async () => {
      try {
        if (this.activeConnections === 0) {
          clearInterval(this.updateInterval);
          this.updateInterval = null;
          return;
        }

        const tempData = await this.getTemperatureWithOHM();
        if (tempData !== null) {
          fs.writeFileSync(this.tempLogPath, tempData);
        }

        const memData = await this.getMemoryWithOHM();
        if (memData !== null) {
          const { total, free, used } = memData;
          fs.writeFileSync(
            this.memLogPath,
            `${total.toFixed(2)},${free.toFixed(2)},${used.toFixed(2)}`
          );
        }
      } catch (e) {
        this.logWithThrottle(`Ошибка сбора данных: ${e.message}`, "error");
      }
    }, 2000);
  }

  async getCpuTemp() {
    try {
      if (fs.existsSync(this.tempLogPath)) {
        const tempData = fs.readFileSync(this.tempLogPath, "utf8").trim();
        const temp = parseFloat(tempData);
        if (!isNaN(temp)) {
          return temp.toFixed(1);
        }
      }

      const tempData = await this.getTemperatureWithOHM();
      if (tempData !== null) {
        return tempData;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async getTemperatureWithOHM() {
    if (this.activeConnections === 0) {
      return null;
    }

    return new Promise((resolve) => {
      child_process.exec(
        "powershell.exe -Command \"Get-Process | Where-Object { $_.Name -eq 'OpenHardwareMonitor' } | Select-Object Id\"",
        (err, stdout) => {
          if (err || !stdout.trim() || !stdout.includes("Id")) {
            resolve(null);
            return;
          }

          const query =
            "powershell.exe -Command \"Get-WmiObject -Namespace root\\OpenHardwareMonitor -Class Sensor | Where-Object { $_.SensorType -eq 'Temperature' -and $_.Name -like '*CPU*' } | Select-Object Name,Value,SensorType | ConvertTo-Json -Depth 2\"";

          child_process.exec(query, (error, stdout, stderr) => {
            if (this.activeConnections === 0) {
              resolve(null);
              return;
            }

            if (error) {
              this.logWithThrottle("Ошибка при получении температуры", "temp");
              resolve(null);
              return;
            }

            if (!stdout.trim()) {
              resolve(null);
              return;
            }

            try {
              const data = JSON.parse(stdout);
              let temp = null;

              if (Array.isArray(data)) {
                for (const sensor of data) {
                  if (
                    sensor.Name &&
                    sensor.Name.includes("CPU") &&
                    sensor.Value
                  ) {
                    temp = parseFloat(sensor.Value).toFixed(1);
                    break;
                  }
                }

                if (!temp && data.length > 0 && data[0].Value) {
                  temp = parseFloat(data[0].Value).toFixed(1);
                }
              } else if (data && data.Value) {
                temp = parseFloat(data.Value).toFixed(1);
              }

              if (temp) {
                try {
                  const methodInfoPath = path.join(
                    os.tmpdir(),
                    "ohm_method_info.txt"
                  );
                  fs.writeFileSync(
                    methodInfoPath,
                    "Метод получения температуры: OpenHardwareMonitor WMI Provider"
                  );
                } catch (e) {}
                resolve(temp);
              } else {
                resolve(null);
              }
            } catch (e) {
              this.logWithThrottle(
                `Ошибка при обработке данных о температуре: ${e.message}`,
                "temp"
              );
              resolve(null);
            }
          });
        }
      );
    });
  }

  async getCurrentTemperatureMethod() {
    try {
      const methodInfoPath = path.join(os.tmpdir(), "ohm_method_info.txt");
      if (fs.existsSync(methodInfoPath)) {
        return fs.readFileSync(methodInfoPath, "utf8");
      }
      return "Информация о методе получения температуры недоступна";
    } catch (e) {
      console.error("Ошибка при чтении информации о методе:", e);
      return "Ошибка при определении метода";
    }
  }

  async getMemoryInfo() {
    try {
      if (fs.existsSync(this.memLogPath)) {
        const memData = fs.readFileSync(this.memLogPath, "utf8").trim();
        const [total, free, used] = memData.split(",").map(parseFloat);
        if (!isNaN(total) && !isNaN(free) && !isNaN(used)) {
          return {
            total,
            free,
            used,
          };
        }
      }

      const memData = await this.getMemoryWithOHM();
      if (memData !== null) {
        return memData;
      }

      const totalMemory = os.totalmem() / 1024 / 1024 / 1024;
      const freeMemory = os.freemem() / 1024 / 1024 / 1024;
      return {
        total: totalMemory,
        free: freeMemory,
        used: totalMemory - freeMemory,
      };
    } catch (error) {
      console.error("Ошибка при получении информации о памяти:", error);
      return null;
    }
  }

  async getMemoryWithOHM() {
    if (this.activeConnections === 0) {
      return null;
    }

    return new Promise((resolve) => {
      child_process.exec(
        "powershell.exe -Command \"Get-Process | Where-Object { $_.Name -eq 'OpenHardwareMonitor' } | Select-Object Id\"",
        (err, stdout) => {
          if (err || !stdout.trim() || !stdout.includes("Id")) {
            resolve(null);
            return;
          }

          child_process.exec(
            "powershell.exe -Command \"Get-WmiObject -Namespace root\\OpenHardwareMonitor -Class Sensor | Where-Object { $_.SensorType -eq 'Data' -and $_.Name -match '(Used|Available|Memory)' } | Select-Object Name,Value,SensorType,InstanceId | ConvertTo-Json -Depth 2\"",
            (error, stdout, stderr) => {
              if (this.activeConnections === 0) {
                resolve(null);
                return;
              }

              if (error) {
                this.logWithThrottle(
                  "Ошибка при получении данных о памяти",
                  "memory"
                );
                resolve(null);
                return;
              }

              try {
                if (!stdout || !stdout.trim()) {
                  resolve(null);
                  return;
                }

                const data = JSON.parse(stdout);
                if (!data || (!Array.isArray(data) && !data.Name)) {
                  resolve(null);
                  return;
                }

                const sensors = Array.isArray(data) ? data : [data];

                let totalGB = 0;
                let usedGB = 0;
                let freeGB = 0;

                for (const sensor of sensors) {
                  if (
                    sensor.Name.includes("Memory") &&
                    (sensor.Name.includes("Total") ||
                      sensor.Name.includes("Used") ||
                      sensor.Name.includes("Available"))
                  ) {
                    let value = parseFloat(sensor.Value);
                    if (value > 100 && !sensor.Name.includes("Percent")) {
                      value = value / 1024;
                    }

                    if (sensor.Name.includes("Total")) {
                      totalGB = value;
                    } else if (
                      sensor.Name.includes("Used") ||
                      sensor.Name.includes("Usage")
                    ) {
                      usedGB = value;
                    } else if (
                      sensor.Name.includes("Available") ||
                      sensor.Name.includes("Free")
                    ) {
                      freeGB = value;
                    }
                  }
                }

                if (totalGB === 0 && usedGB > 0 && freeGB > 0) {
                  totalGB = usedGB + freeGB;
                }

                if (totalGB > 0) {
                  if (usedGB > 0 && freeGB === 0) {
                    freeGB = totalGB - usedGB;
                  } else if (freeGB > 0 && usedGB === 0) {
                    usedGB = totalGB - freeGB;
                  }
                }

                if (totalGB > 0 && (usedGB > 0 || freeGB > 0)) {
                  resolve({
                    total: totalGB,
                    free: freeGB,
                    used: usedGB,
                  });
                } else {
                  resolve(null);
                }
              } catch (e) {
                this.logWithThrottle(
                  `Ошибка обработки данных о памяти: ${e.message}`,
                  "memory"
                );
                resolve(null);
              }
            }
          );
        }
      );
    });
  }

  clearTempFiles() {
    try {
      const tempFiles = [this.tempLogPath, this.memLogPath];

      for (const file of tempFiles) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      }

      const tempDir = os.tmpdir();
      const files = fs.readdirSync(tempDir);

      for (const file of files) {
        if (file.startsWith("ohm_") || file.includes("OpenHardwareMonitor")) {
          try {
            fs.unlinkSync(path.join(tempDir, file));
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  initWebSocketServer(server) {
    const WebSocket = require("ws");
    if (this.wsServer) {
      this.closeWebSocketServer();
    }
    this.wsServer = new WebSocket.Server({ server });

    this.wsServer.on("connection", (ws, req) => {
      const clientId =
        req.headers["sec-websocket-key"] || Date.now().toString();
      ws.clientId = clientId;

      this.wsClients.add(ws);
      this.registerConnection();
      this.startSendingDataToClient(ws);

      console.log(
        `WebSocket клиент подключен (ID: ${clientId}), активных подключений: ${this.wsClients.size}`
      );

      ws.on("close", () => {
        this.wsClients.delete(ws);
        console.log(
          `WebSocket клиент отключен (ID: ${clientId}), осталось подключений: ${this.wsClients.size}`
        );

        // Удаляем таймеры и данные для этого клиента
        if (this.reconnectTimeouts[clientId]) {
          clearTimeout(this.reconnectTimeouts[clientId]);
          delete this.reconnectTimeouts[clientId];
        }

        if (this.reconnectAttempts[clientId]) {
          delete this.reconnectAttempts[clientId];
        }

        if (ws._dataInterval) {
          clearInterval(ws._dataInterval);
          ws._dataInterval = null;
        }

        if (this.wsClients.size === 0) {
          this.unregisterConnection();
        }
      });

      // Добавляем обработчик сообщений от клиента
      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message);

          // Обработка различных типов сообщений от клиента
          if (data.type === "ping") {
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
    });

    console.log("WebSocket сервер запущен");
    return this.wsServer;
  }

  async sendCurrentData(ws) {
    const WebSocket = require("ws");
    if (ws.readyState !== WebSocket.OPEN) return;

    try {
      const cpuTemp = await this.getCpuTemp();
      const memInfo = await this.getMemoryInfo();

      ws.send(
        JSON.stringify({
          type: "systemData",
          timestamp: Date.now(),
          cpuTemp,
          memInfo,
        })
      );
    } catch (error) {
      console.error(`Ошибка отправки текущих данных: ${error.message}`);
    }
  }

  startSendingDataToClient(ws) {
    const WebSocket = require("ws");
    const interval = setInterval(async () => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(interval);
        return;
      }

      try {
        const cpuTemp = await this.getCpuTemp();
        const memInfo = await this.getMemoryInfo();

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
    }, 2000);

    ws._dataInterval = interval;
  }

  // Метод для проверки активных подключений и их поддержания
  checkConnections() {
    const WebSocket = require("ws");

    this.wsClients.forEach((client) => {
      if (
        client.readyState === WebSocket.CLOSED ||
        client.readyState === WebSocket.CLOSING
      ) {
        // Удаляем отключенных клиентов из набора
        this.wsClients.delete(client);

        if (client._dataInterval) {
          clearInterval(client._dataInterval);
          client._dataInterval = null;
        }
      }
    });

    // Проверяем, нужно ли останавливать мониторинг
    if (this.wsClients.size === 0 && this.activeConnections > 0) {
      this.unregisterConnection();
    }
  }

  // Метод для отправки данных всем подключенным клиентам
  broadcastData(data) {
    const WebSocket = require("ws");

    this.wsClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "systemBroadcast",
            timestamp: Date.now(),
            ...data,
          })
        );
      }
    });
  }

  // Запуск периодической проверки подключений
  startConnectionMonitoring() {
    if (this._connectionCheckInterval) {
      clearInterval(this._connectionCheckInterval);
    }

    this._connectionCheckInterval = setInterval(() => {
      this.checkConnections();
    }, 30000); // Проверка каждые 30 секунд
  }

  // Остановка проверки подключений
  stopConnectionMonitoring() {
    if (this._connectionCheckInterval) {
      clearInterval(this._connectionCheckInterval);
      this._connectionCheckInterval = null;
    }
  }

  handleHomeOpen() {
    // Не запускаем мониторинг здесь, так как это делается через WebSocket
    console.log("Страница Home открыта (через HTTP)");
    return Promise.resolve();
  }

  handleHomeClose() {
    console.log("Страница Home закрыта");

    // Проверяем, есть ли активные WebSocket клиенты перед закрытием
    if (this.wsClients && this.wsClients.size > 0) {
      console.log(
        `Не закрываем мониторинг: активных WebSocket клиентов: ${this.wsClients.size}`
      );
      return Promise.resolve();
    }

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.closeWebSocketServer();
    this.clearTempFiles();

    return Promise.resolve();
  }

  closeProgramWithElevatedRights() {
    try {
      try {
        const checkProcess = child_process.execSync(
          'powershell.exe -Command "Get-Process -Name OpenHardwareMonitor -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id"',
          { encoding: "utf8", timeout: 2000 }
        );
        if (!checkProcess || !checkProcess.trim()) {
          return;
        }

        console.log(
          `Закрытие OpenHardwareMonitor (PID: ${checkProcess.trim()})`
        );
      } catch (e) {
        return;
      }

      try {
        if (!fs.existsSync(this.vbsPath)) {
          const tempVbsPath = path.join(os.tmpdir(), "kill_ohm.vbs");
          const vbsContent =
            'Set objShell = CreateObject("WScript.Shell")\n' +
            'objShell.Run "taskkill /F /IM OpenHardwareMonitor.exe /T", 0, True\n';

          fs.writeFileSync(tempVbsPath, vbsContent);

          child_process.execSync(
            `powershell.exe -WindowStyle Hidden -Command "Start-Process -FilePath 'wscript.exe' -ArgumentList '${tempVbsPath}' -Verb RunAs -WindowStyle Hidden -Wait"`,
            { timeout: 5000, stdio: "ignore" }
          );

          try {
            fs.unlinkSync(tempVbsPath);
          } catch (e) {}
        } else {
          child_process.execSync(
            `powershell.exe -WindowStyle Hidden -Command "Start-Process -FilePath 'wscript.exe' -ArgumentList '${this.vbsPath}' -Verb RunAs -WindowStyle Hidden -Wait"`,
            { timeout: 5000, stdio: "ignore" }
          );
        }
      } catch (e) {
        try {
          child_process.execSync(
            'powershell.exe -WindowStyle Hidden -Command "Get-WmiObject Win32_Process -Filter \\"Name=\'OpenHardwareMonitor.exe\'\\" | ForEach-Object { $_.Terminate() }"',
            { timeout: 5000, stdio: "ignore" }
          );
        } catch (wmiError) {
          try {
            child_process.execSync("taskkill /F /IM OpenHardwareMonitor.exe", {
              stdio: "ignore",
              timeout: 3000,
            });
          } catch (e) {}
        }
      }
    } catch (error) {}
  }

  async shutdown() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.clearTempFiles();
    this.closeProgramWithElevatedRights();

    this.initialized = false;
    this.isMonitorRunning = false;
    console.log("Сервис мониторинга остановлен");
  }

  closeWebSocketServer() {
    console.log("Закрытие WebSocket сервера");
    const WebSocket = require("ws");

    try {
      this.stopConnectionMonitoring();

      if (this.wsServer) {
        for (const client of this.wsClients) {
          if (client._dataInterval) {
            clearInterval(client._dataInterval);
            client._dataInterval = null;
          }
          try {
            client.terminate();
          } catch (e) {}
        }

        this.wsClients.clear();

        // Очищаем все таймеры переподключений
        Object.keys(this.reconnectTimeouts).forEach((id) => {
          clearTimeout(this.reconnectTimeouts[id]);
        });
        this.reconnectTimeouts = {};
        this.reconnectAttempts = {};

        try {
          this.wsServer.close();
        } catch (e) {}
        this.wsServer = null;
      }
    } catch (e) {}

    this.activeConnections = 0;
    this.isMonitorRunning = false;
    this.initialized = false;
  }
}

const hardwareMonitorService = new HardwareMonitorService();

module.exports = hardwareMonitorService;
