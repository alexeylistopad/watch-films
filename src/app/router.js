const { Router } = require("express");
const { MovieController } = require("./controllers/movie-controller");
const authMiddleware = require("./middlewares/auth-middleware");
const config = require("../../config");
const hardwareMonitorService = require("./services/hardware-monitor-service");
const path = require("path");

const router = Router();

// Глобальные переменные для отслеживания последнего запроса
let lastUrl = "";
let currentUrl = "";
let homePageLoaded = false; // Флаг для отслеживания загрузки страницы Home

// Middleware для обработки входа и выхода со страницы Home без использования сессий
router.use((req, res, next) => {
  // Запоминаем текущий URL для отслеживания покидания страницы Home
  lastUrl = currentUrl;
  currentUrl = req.originalUrl;

  // Проверяем, не является ли запрос запросом к статическим ресурсам
  const isResourceRequest =
    /\.(ico|png|jpg|jpeg|gif|css|js|woff|woff2|ttf|svg)$/.test(currentUrl) ||
    currentUrl.includes("favicon") ||
    currentUrl.includes("apple-touch-icon") ||
    currentUrl.includes("manifest.json");

  // Если это запрос к ресурсу, не меняем состояние
  if (isResourceRequest) {
    // Восстанавливаем предыдущий URL, чтобы не сбросить статус "на домашней странице"
    currentUrl = lastUrl;
    return next();
  }

  // Определяем, является ли текущий URL страницей Home
  const isHomePage = currentUrl === "/" || currentUrl.startsWith("/home");

  // Пропускаем инициализацию для последующих запросов к домашней странице
  if (isHomePage) {
    // Считаем, что страница Home уже загружена, мониторинг будет инициализирован через WebSocket
    homePageLoaded = true;
  }
  // Если покидаем страницу Home и это не запрос к ресурсу
  else if (
    (lastUrl === "/" || lastUrl.startsWith("/home")) &&
    !isResourceRequest
  ) {
    console.log("Пользователь покинул страницу Home");
    hardwareMonitorService.handleHomeClose();
    homePageLoaded = false;
  }

  next();
});

// Обработка манифеста и сервис-воркера PWA
router.get("/manifest.json", (req, res) => {
  res.sendFile(path.join(__dirname, "views/assets/pwa/manifest.json"));
});

router.get("/service-worker.js", (req, res) => {
  res.sendFile(path.join(__dirname, "views/assets/pwa/service-worker.js"));
});

router.get("/watch", (req, res) => {
  const id = MovieController.getMovieData()?.id;
  if (!id) {
    return res.status(404).json({
      status: "error",
      message:
        "Информация о фильме недоступна. Сначала выполните команду searchMovie.",
    });
  }
  res.render("movie-view", { id });
});

router.get("/info", (req, res) => {
  const movieData = MovieController.getMovieData();
  const backdropUrlList = MovieController.getBackdropUrlList();
  if (!movieData) {
    return res.status(404).json({
      status: "error",
      message:
        "Информация о фильме недоступна. Сначала выполните команду searchMovie.",
    });
  }
  res.render("movie-info-view", { movieData, backdropUrlList });
});

router.post("/command", authMiddleware, MovieController.handleCommand);

router.get("/", (req, res) => {
  // Полностью исключаем запуск мониторинга при загрузке страницы,
  // так как это будет сделано через WebSocket соединение
  res.render("home", {
    apiKey: config.server.apiKey,
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
  });
});

router.use((req, res) => {
  res.status(404).json({ error: "Страница не найдена" });
});

module.exports = router;
