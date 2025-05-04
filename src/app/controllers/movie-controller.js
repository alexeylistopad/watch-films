const {
  searchMovie,
  getBackdropsImg,
} = require("../services/kinopoisk-service");
const {
  openMovieInBrowser,
  openMovieInfoInBrowser,
  closeAllBrowsers,
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

        case "closeAllBrowsers":
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
        res.status(404).json({
          status: "error",
          message: "Фильм не найден",
        });
        return;
      }

      this.backdropUrlList = [];
      try {
        this.backdropUrlList = await getBackdropsImg(this.movieData.id);
        console.log('Loaded backdrops:', this.backdropUrlList); // Отладка
      } catch (error) {
        console.error('Error loading backdrops:', error);
        this.backdropUrlList = [];
      }

      await Promise.all([
        openMovieInfoInBrowser(this.movieData, this.backdropUrlList),
        openMovieInBrowser(this.movieData.id),
      ]);

      res.json({
        status: "success",
        message: `${this.movieData.isSeries ? "Сериал" : "Фильм"} "${
          this.movieData.name
        }" включён. Приятного просмотра!`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Неизвестная ошибка";
      res.status(400).json({
        status: "error",
        message: errorMessage,
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

    await closeAllBrowsers();
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
