const { Router } = require("express");
const { MovieController } = require("./controllers/movie-controller");
const authMiddleware = require("./middlewares/auth-middleware");
const config = require("../../config");

const router = Router();

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
