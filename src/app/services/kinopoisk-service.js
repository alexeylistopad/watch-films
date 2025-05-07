const NodeCache = require("node-cache");
const config = require("../../../config");

class KinopoiskService {
  #cache;
  #apiKey;

  constructor() {
    this.#cache = new NodeCache({ stdTTL: 3600 });
    this.#apiKey = config.kinopoisk.apiKey;
  }

  async searchMovie(name) {
    if (config.debug?.useMockData) return this.#getMockMovie();

    const cacheKey = `movie:${name}`;
    const cached = this.#cache.get(cacheKey);
    if (cached) return cached;

    try {
      const url = new URL("https://api.kinopoisk.dev/v1.4/movie/search");
      url.searchParams.append("page", "1");
      url.searchParams.append("limit", "1");
      url.searchParams.append("query", name);

      const data = await this.#makeRequest(url);
      if (data.docs?.[0]) {
        this.#cache.set(cacheKey, data.docs[0]);
        return data.docs[0];
      }
      return null;
    } catch (error) {
      console.error(`Ошибка API Кинопоиска:`, error);
      throw new Error(`Ошибка при поиске фильма: ${error.message}`);
    }
  }

  async getBackdropsImg(movieId) {
    if (config.debug?.useMockData) return this.#getMockBackdrops();

    try {
      const url = new URL("https://api.kinopoisk.dev/v1.4/image");
      url.searchParams.append("movieId", movieId.toString());
      url.searchParams.append("type", "backdrops");
      url.searchParams.append("width", "1920");

      const data = await this.#makeRequest(url);
      return data.docs.map((doc) => doc.url);
    } catch (error) {
      console.error("Error in getBackdropsImg:", error);
      return [];
    }
  }

  async #makeRequest(url) {
    const response = await fetch(url.toString(), {
      headers: {
        "X-API-KEY": this.#apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  #getMockMovie() {
    return {
      id: 1143242,
      name: "Джентльмены",
      alternativeName: "The Gentlemen",
      rating: { kp: 8.5, imdb: 8.0 },
      year: 2019,
      shortDescription:
        "Наркобарон хочет уйти на покой, но криминальный мир не отпускает",
      movieLength: 113,
      ageRating: 18,
      backdrop: {
        url: "https://avatars.mds.yandex.net/get-ott/1531675/2a0000017f0262661ccd5f35f5d96a1c0ef5/orig",
      },
      logo: {
        url: "https://avatars.mds.yandex.net/get-ott/1648503/2a0000017f02626620b23f051a584a0ab12f/orig",
      },
      genres: [{ name: "криминал" }],
      countries: [{ name: "США" }],
      isSeries: false,
    };
  }

  #getMockBackdrops() {
    return [
      "https://avatars.mds.yandex.net/get-ott/1648503/2a0000017f02626620b23f051a584a0ab12f/orig",
      "https://avatars.mds.yandex.net/get-ott/1531675/2a0000017f0262661ccd5f35f5d96a1c0ef5/orig",
    ];
  }
}

module.exports = new KinopoiskService();
