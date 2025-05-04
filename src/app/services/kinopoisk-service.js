const config = require("../../../config");
const NodeCache = require("node-cache");

const movieCache = new NodeCache({ stdTTL: 3600 });

// Тестовые данные
const mockData = {
  movie: {
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
  },
  backdrops: [
    "https://avatars.mds.yandex.net/get-ott/1648503/2a0000017f02626620b23f051a584a0ab12f/orig",
    "https://avatars.mds.yandex.net/get-ott/1531675/2a0000017f0262661ccd5f35f5d96a1c0ef5/orig",
  ],
};

async function searchMovie(name) {
  if (config.debug?.useMockData) {
    console.log(
      "[MOCK] Возвращаем тестовые данные для поиска:",
      mockData.movie
    );
    return mockData.movie;
  }

  const cacheKey = `movie:${name}`;
  const cached = movieCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  try {
    const url = new URL("https://api.kinopoisk.dev/v1.4/movie/search");
    url.searchParams.append("page", "1");
    url.searchParams.append("limit", "1");
    url.searchParams.append("query", name);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-API-KEY": config.kinopoisk.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.docs?.[0]) {
      movieCache.set(cacheKey, data.docs[0]);
      return data.docs[0];
    }

    return null;
  } catch (error) {
    console.error(`Ошибка API Кинопоиска:`, error);
    throw new Error(`Ошибка при поиске фильма: ${error.message}`);
  }
}

async function getMovieById(id) {
  if (config.debug?.useMockData) {
    console.log("[MOCK] Возвращаем тестовые данные для фильма");
    return mockData.movie;
  }

  try {
    const url = new URL(`https://api.kinopoisk.dev/v1.4/movie/${id}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-API-KEY": config.kinopoisk.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Ошибка ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data || null;
  } catch (error) {
    console.error(`Ошибка API Кинопоиска:`, error);
    throw new Error(`Ошибка при получении фильма: ${error.message}`);
  }
}

async function getBackdropsImg(movieId) {
  if (config.debug?.useMockData) {
    console.log("[MOCK] Возвращаем тестовые данные для backdrops");
    return mockData.backdrops;
  }

  try {
    console.log("Fetching backdrops for movie:", movieId);
    const url = new URL("https://api.kinopoisk.dev/v1.4/image");
    url.searchParams.append("movieId", movieId.toString());
    url.searchParams.append("type", "backdrops");
    url.searchParams.append("width", "1920");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-API-KEY": config.kinopoisk.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Ошибка при получении изображений: ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log("Received backdrops:", data.docs);
    return data.docs.map((doc) => doc.url);
  } catch (error) {
    console.error("Error in getBackdropsImg:", error);
    return [];
  }
}

module.exports = { searchMovie, getMovieById, getBackdropsImg };
