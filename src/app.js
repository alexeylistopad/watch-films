/**
 * Основной файл приложения
 * Отвечает за конфигурацию Express и запуск сервера
 */

const express = require("express");
const path = require("path");
const config = require("../config");
const router = require("./app/router");

const app = express();

// Настройка шаблонизатора EJS и пути к представлениям
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "app/views"));

// Подключаем статические файлы (стили, скрипты, изображения)
// Доступны по пути /assets/*
app.use("/assets", express.static(path.join(__dirname, "app/views/assets")));

// Парсинг JSON в теле запроса
app.use(express.json());
// Парсинг данных форм
app.use(express.urlencoded({ extended: true }));

// Логгер всех входящих запросов
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Подключаем основные маршруты
app.use(router);

const PORT = config.server.port || 3060;
const HOST = config.server.host || "localhost";

// Запуск сервера
app.listen(PORT, HOST, () => {
  console.log(`Сервер запущен на http://${HOST}:${PORT}`);
  console.log("Для проверки откройте: http://localhost:3060/ping");
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Что-то пошло не так!" });
});
