/**
 * Основной файл приложения
 * Отвечает за конфигурацию Express и запуск сервера
 */

const express = require("express");
const path = require("path");
const config = require("../config");
const router = require("./app/router");
const http = require("http");
const websocketService = require("./app/services/websocket-service");

const app = express();

// Настройка шаблонизатора EJS и пути к представлениям
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "app/views"));

// Подключаем статические файлы и настраиваем парсеры
app.use("/assets", express.static(path.join(__dirname, "app/views/assets")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Логгер всех входящих запросов
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Обработка запросов фавиконок
app.get("/favicon.ico", (req, res) => {
  res.sendFile(
    path.join(__dirname, "app/views/assets/images/icons/favicon.ico")
  );
});
app.get(
  ["/apple-touch-icon.png", "/apple-touch-icon-precomposed.png"],
  (req, res) => {
    res.sendFile(
      path.join(__dirname, "app/views/assets/images/icons/icon-180x180.png")
    );
  }
);

// Подключаем основные маршруты
app.use(router);

const PORT = config.server.port || 3060;
const HOST = config.server.host || "localhost";

const server = http.createServer(app);
websocketService.init(server);

// Запуск сервера
server.listen(PORT, HOST, () => {
  console.log(`Сервер запущен на http://${HOST}:${PORT}`);
  console.log(`API ключ: ${config.server.apiKey}`);
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Что-то пошло не так!" });
});
