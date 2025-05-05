const {
  searchMovie,
  getBackdropsImg,
} = require("../services/kinopoisk-service");
const {
  openMovie,
  closeMovie,
  browsers,
} = require("../services/puppeteer-service");

class MovieController {
  static movieData = null;
  static backdropUrlList = [];

  static getMovieData() {
    return this.movieData;
  }

  static getBackdropUrlList() {
    console.log(this.backdropUrlList);
    return this.backdropUrlList;
  }

  static handleCommand = async (req, res) => {
    const { command, name } = req.body;

    try {
      switch (command) {
        case "searchMovie":
          await this.handleSearchMovie(name, res);
          break;

        case "closeMovie":
          await this.handleCloseAllBrowsers(res);
          break;

        case "isMovieOpened":
          await this.handleIsMovieOpened(res);
          break;

        default:
          res.status(400).json({
            status: "error",
            message: "Такой команды нет",
          });
      }
    } catch (error) {
      console.error(`Ошибка: ${error.message}`);
      res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
  };

  static async handleSearchMovie(name, res) {
    try {
      if (!name?.trim()) {
        throw new Error("Название фильма не может быть пустым");
      }

      this.movieData = await searchMovie(name);
      if (!this.movieData) {
        throw new Error("Фильм не найден");
      }

      // Запускаем оба браузера параллельно
      await Promise.all([
        // openMovieInfoInBrowser(this.movieData),
        openMovie(this.movieData.id),
      ]);

      res.json({
        status: "success",
        message: `${this.movieData.isSeries ? "Сериал" : "Фильм"} "${
          this.movieData.name
        }" включён. Приятного просмотра!`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Неизвестная ошибка при запуске фильма";

      res.status(400).json({
        status: "error",
        message: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  static async handleCloseAllBrowsers(res) {
    if (!this.movieData) {
      res.status(400).json({
        status: "error",
        message: "Нет открытого фильма для закрытия.",
      });
      return;
    }

    await closeMovie();
    res.json({
      status: "success",
      message: `https://www.kinopoisk.ru/${
        this.movieData.isSeries ? "series" : "film"
      }/${this.movieData.id}/`,
    });
  }

  static async handleIsMovieOpened(res) {
    if (browsers.length) {
      res.status(500).json({
        status: "error",
        message: "Закрыть уже открытый фильм?",
      });
    } else {
      res.json({
        status: "success",
      });
    }
  }
}

module.exports = { MovieController };
