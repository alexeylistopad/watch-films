const kinopoiskService = require("../services/kinopoisk-service");
const puppeteerService = require("../services/puppeteer-service");

class MovieController {
  static #movieData = null;
  static #backdropUrlList = [];

  static getMovieData() {
    return this.#movieData;
  }

  static getBackdropUrlList() {
    return this.#backdropUrlList;
  }

  static async #handleSearchMovie(name, res) {
    try {
      if (!name?.trim()) {
        throw new Error("Название фильма не может быть пустым");
      }

      this.#movieData = await kinopoiskService.searchMovie(name);
      if (!this.#movieData) {
        throw new Error("Фильм не найден");
      }

      this.#backdropUrlList = await kinopoiskService.getBackdropsImg(
        this.#movieData.id
      );
      await puppeteerService.openMovie(this.#movieData.id);

      res.json({
        status: "success",
        message: `${this.#movieData.isSeries ? "Сериал" : "Фильм"} "${
          this.#movieData.name
        }" включён. Приятного просмотра!`,
      });
    } catch (error) {
      throw new Error(error.message);
    }
  }

  static async #handleCloseAllBrowsers(res) {
    if (!this.#movieData) {
      res.status(400).json({
        status: "error",
        message: "Нет открытого фильма для закрытия.",
      });
      return;
    }

    await puppeteerService.closeMovie();
    res.json({
      status: "success",
      message: `https://www.kinopoisk.ru/${
        this.#movieData.isSeries ? "series" : "film"
      }/${this.#movieData.id}/`,
    });
  }

  static handleCommand = async (req, res) => {
    const { command, name } = req.body;

    try {
      switch (command) {
        case "searchMovie":
          await this.#handleSearchMovie(name, res);
          break;
        case "closeMovie":
          await this.#handleCloseAllBrowsers(res);
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
}

module.exports = { MovieController };
