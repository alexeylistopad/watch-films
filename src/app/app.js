// Настройка уровня логирования
const MIN_LOG_LEVEL = process.env.NODE_ENV === "production" ? "error" : "info";

// Переопределяем console.log чтобы контролировать вывод
const originalConsoleLog = console.log;
console.log = function () {
  // В production выводим только ошибки и важные сообщения
  if (MIN_LOG_LEVEL === "error") {
    // Проверяем, содержит ли сообщение ключевые слова для важных событий
    const message = Array.from(arguments).join(" ").toLowerCase();
    const importantKeywords = [
      "error",
      "critical",
      "failed",
      "shutting down",
      "exiting",
    ];

    if (!importantKeywords.some((keyword) => message.includes(keyword))) {
      return; // Не выводим обычные информационные сообщения
    }
  }

  // Для отладки выводим все сообщения
  originalConsoleLog.apply(console, arguments);
};

// Инициализация Express и HTTP сервера
const express = require("express");
const http = require("http");
const session = require("express-session");
const app = express();
const server = http.createServer(app);

// Импорт сервиса мониторинга
const hardwareMonitorService = require("./services/hardware-monitor-service");

// Настройка сессий для отслеживания навигации пользователя
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

// Инициализация WebSocket сервера
hardwareMonitorService.initWebSocketServer(server);

// Добавление обработчика закрытия приложения
process.on("SIGINT", () => {
  console.log("Завершение работы приложения...");

  // Закрываем WebSocket соединения
  hardwareMonitorService.closeWebSocketServer();

  // Закрываем OpenHardwareMonitor
  hardwareMonitorService.closeProgramWithElevatedRights();

  // Завершаем работу после небольшой задержки
  setTimeout(() => {
    console.log("Завершаем работу приложения...");
    process.exit(0);
  }, 1000);
});

// Обработчик для необработанных исключений
process.on("uncaughtException", (error) => {
  console.error("Необработанное исключение:", error);

  // Закрываем WebSocket соединения
  hardwareMonitorService.closeWebSocketServer();

  // Завершаем работу
  setTimeout(() => process.exit(1), 1000);
});

process.on("exit", () => {
  hardwareMonitorService.closeWebSocketServer();
});

// Обработчик ошибок и завершения работы сервера
server.on("close", () => {
  console.log("Сервер закрывается...");
  hardwareMonitorService.closeWebSocketServer();
  hardwareMonitorService.shutdown();
});

// Экспорт для возможного использования в других модулях
module.exports = { app, server };
