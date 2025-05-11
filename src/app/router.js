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

// Эндпоинт для статуса API
router.get("/api/status", (req, res) => {
  res.json({
    status: "success",
    message: "API работает",
    timestamp: Date.now(),
  });
});

// Тестовый эндпоинт для проверки базового подключения
router.get("/api/test", (req, res) => {
  res.send("API работает");
});

// Эндпоинт для получения данных мониторинга (оптимизирован для виджетов iOS)
router.get("/api/monitoring-data", async (req, res) => {
  try {
    // Установка заголовков для предотвращения кеширования
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    // Сохраняем User-Agent для анализа
    const userAgent = req.headers["user-agent"] || "";

    // Проверяем, является ли запрос от Scriptable
    const isScriptableRequest = userAgent.includes("Scriptable");

    // Создаем объект с данными по умолчанию
    const defaultResponse = {
      status: "success",
      timestamp: Date.now(),
      cpuTemp: "45.0", // Всегда строка!
      memInfo: {
        total: 16, // Всегда числа!
        free: 8,
        used: 8,
      },
      cpuHistory: Array(60)
        .fill(0)
        .map((_, i) => Number(45 + Math.sin(i / 5) * 10)), // Явно преобразуем в числа
      ramHistory: Array(60)
        .fill(0)
        .map((_, i) => Number(50 + Math.cos(i / 5) * 10)), // Явно преобразуем в числа
    };

    try {
      // Температура CPU (всегда возвращаем как строку)
      const cpuTemp = await hardwareMonitorService.getCpuTemp();
      if (cpuTemp !== null && cpuTemp !== undefined) {
        defaultResponse.cpuTemp = String(cpuTemp).replace(",", ".");
      }

      // Информация о памяти (всегда возвращаем как числа)
      const memInfo = await hardwareMonitorService.getMemoryInfo();
      if (memInfo && typeof memInfo === "object") {
        defaultResponse.memInfo = {
          total: Number(memInfo.total) || 16,
          free: Number(memInfo.free) || 8,
          used: Number(memInfo.used) || 8,
        };
      }

      // История CPU (всегда массив чисел)
      const cpuHistory = hardwareMonitorService.getCpuHistory();
      if (Array.isArray(cpuHistory) && cpuHistory.length > 0) {
        // Преобразуем все элементы в числа, заменяя null и невалидные значения на 0
        defaultResponse.cpuHistory = cpuHistory.map((val) => {
          const num = Number(val);
          return isNaN(num) ? 0 : num;
        });
      }

      // История RAM (всегда массив чисел)
      const ramHistory = hardwareMonitorService.getRamHistory();
      if (Array.isArray(ramHistory) && ramHistory.length > 0) {
        // Преобразуем все элементы в числа, заменяя null и невалидные значения на 0
        defaultResponse.ramHistory = ramHistory.map((val) => {
          const num = Number(val);
          return isNaN(num) ? 0 : num;
        });
      }

      // Проверяем, что массивы историй не содержат null или undefined значений
      defaultResponse.cpuHistory = defaultResponse.cpuHistory.map((val) =>
        val === null || val === undefined || isNaN(val) ? 0 : Number(val)
      );

      defaultResponse.ramHistory = defaultResponse.ramHistory.map((val) =>
        val === null || val === undefined || isNaN(val) ? 0 : Number(val)
      );
    } catch (e) {
      console.error("Ошибка при получении данных:", e);
      // Продолжаем с данными по умолчанию
    }

    // Если это запрос от Scriptable, логируем это
    if (isScriptableRequest) {
      console.log(
        `[${new Date().toLocaleTimeString()}] Получен запрос от Scriptable виджета: ${userAgent}`
      );
    }

    // Отправляем ответ
    res.json(defaultResponse);
  } catch (error) {
    console.error("Общая ошибка API:", error);

    // Отправляем резервные данные в случае любой ошибки
    res.json({
      status: "success",
      timestamp: Date.now(),
      cpuTemp: "45.0",
      memInfo: { total: 16, free: 8, used: 8 },
      cpuHistory: Array(60)
        .fill(0)
        .map((_, i) => Number(45 + Math.sin(i / 5) * 10)),
      ramHistory: Array(60)
        .fill(0)
        .map((_, i) => Number(50 + Math.cos(i / 5) * 10)),
    });
  }
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
