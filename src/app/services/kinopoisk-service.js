const { kinopoisk } = require("../../../config");
const NodeCache = require("node-cache");

const movieCache = new NodeCache({ stdTTL: 3600 });

async function searchMovie(name) {
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
        "X-API-KEY": kinopoisk.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Ошибка при поиске фильма: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.docs[0]) {
      movieCache.set(cacheKey, data.docs[0]);
    }

    return data.docs[0] || null;
  } catch (error) {
    console.error(`Ошибка в searchMovie: ${error.message}`);
    throw error;
  }
}

async function getMovieById(id) {
  try {
    const url = new URL(`https://api.kinopoisk.dev/v1.4/movie/${id}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-API-KEY": kinopoisk.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Ошибка при получении фильма по ID: ${response.statusText}`
      );
    }

    const data = await response.json();
    return data || null;
  } catch (error) {
    console.error(`Ошибка в getMovieById: ${error.message}`);
    throw error;
  }
}

async function getBackdropsImg(movieId) {
  try {
    console.log('Fetching backdrops for movie:', movieId);
    const url = new URL("https://api.kinopoisk.dev/v1.4/image");
    url.searchParams.append("movieId", movieId.toString());
    url.searchParams.append("type", "backdrops");
    url.searchParams.append("width", "1920");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-API-KEY": kinopoisk.apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Ошибка при получении изображений: ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log('Received backdrops:', data.docs);
    return data.docs.map((doc) => doc.url);
  } catch (error) {
    console.error('Error in getBackdropsImg:', error);
    return [];
  }
}

module.exports = { searchMovie, getMovieById, getBackdropsImg };
