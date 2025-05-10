// Настройка уровня логирования
const MIN_LOG_LEVEL = process.env.NODE_ENV === "production" ? "error" : "info";

// Переопределяем console.log чтобы контролировать вывод
const originalConsoleLog = console.log;
console.log = function () {
  // В production выводим только ошибки и важные сообщения
  if (MIN_LOG_LEVEL === "error") {
    const message = Array.from(arguments).join(" ").toLowerCase();
    const importantKeywords = [
      "error",
      "critical",
      "failed",
      "shutting down",
      "exiting",
    ];

    if (!importantKeywords.some((keyword) => message.includes(keyword))) {
      return;
    }
  }
  originalConsoleLog.apply(console, arguments);
};

// Инициализация Express и HTTP сервера
const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);

// Импорт сервиса мониторинга
const hardwareMonitorService = require("./services/hardware-monitor-service");

// Инициализация WebSocket сервера и начало мониторинга соединений
hardwareMonitorService.initWebSocketServer(server);
hardwareMonitorService.startConnectionMonitoring();

// Объединяем обработчики закрытия приложения для уменьшения дублирования кода
const shutdownApp = (exitCode = 0) => {
  console.log("Завершение работы приложения...");
  hardwareMonitorService.closeWebSocketServer();
  hardwareMonitorService.closeProgramWithElevatedRights();
  hardwareMonitorService.stopConnectionMonitoring();

  setTimeout(() => {
    console.log("Завершаем работу приложения...");
    process.exit(exitCode);
  }, 1000);
};

// Добавление обработчиков событий
process.on("SIGINT", () => shutdownApp(0));
process.on("uncaughtException", (error) => {
  console.error("Необработанное исключение:", error);
  shutdownApp(1);
});
process.on("exit", () => hardwareMonitorService.closeWebSocketServer());

// Обработчик ошибок и завершения работы сервера
server.on("close", () => {
  console.log("Сервер закрывается...");
  hardwareMonitorService.closeWebSocketServer();
  hardwareMonitorService.shutdown();
});

// Экспорт для возможного использования в других модулях
module.exports = { app, server };
