/**
 * Маршрутизация приложения
 * Определяет все доступные эндпоинты
 */

const { Router } = require("express");
const { MovieController } = require("./controllers/movie-controller");

const router = Router();

/**
 * GET /watch
 * Страница просмотра фильма через плеер Kinobox
 */
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

/**
 * GET /info
 * Страница с информацией о фильме (описание, рейтинг и т.д.)
 */
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

/**
 * POST /command
 * API для управления просмотром (поиск фильма, закрытие и т.д.)
 */
router.post("/command", MovieController.handleCommand);

/**
 * GET /ping
 * Проверка работоспособности сервера
 */
router.get("/ping", (req, res) => {
  res.json({
    status: "success",
    message: "Сервер работает",
    timestamp: new Date().toISOString(),
  });
});

// Обработка 404 ошибки
router.use((req, res) => {
  res.status(404).json({
    error: "Страница не найдена",
  });
});

module.exports = router;
