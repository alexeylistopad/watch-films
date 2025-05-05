/**
 * Конфигурация приложения
 *
 * server:
 *   port - порт на котором запускается сервер
 *   host - хост для прослушивания (0.0.0.0 для доступа из сети)
 *   baseUrl - базовый URL для сервера
 *
 * kinopoisk:
 *   apiKey - ключ API для доступа к Kinopoisk API (https://kinopoisk.dev)
 *
 * monitors:
 *   count - количество мониторов: 1 или 2
 *   positions:
 *     main - позиция основного монитора
 *     secondary - позиция второго монитора
 *
 * debug:
 *   useMockData - флаг для использования тестовых данных
 *
 * paths:
 *   extensions - пути к расширениям
 *   chromeProfile - путь к профилю Chrome
 */

const path = require("path");

module.exports = {
  server: {
    port: 3060,
    host: "0.0.0.0",
    baseUrl: "http://localhost:3060", // Добавляем базовый URL
  },
  kinopoisk: {
    apiKey: "MKWNBC6-HG84M2H-HYMW0MW-88VZY19",
  },
  monitors: {
    count: 2, // количество мониторов: 1 или 2
    positions: {
      main: 0, // Позиция главного монитора
      secondary: -2560, // Позиция второго монитора (влево от главного)
    },
  },
  debug: {
    useMockData: true, // включаем моковые данные по умолчанию
  },
  paths: {
    extensions: [
      path.join(
        process.env.LOCALAPPDATA,
        "Google/Chrome/User Data/Default/Extensions/gighmmpiobklfepjocnamgkkbiglidom"
      ), // AdBlock
      path.join(
        process.env.LOCALAPPDATA,
        "Google/Chrome/User Data/Default/Extensions/bgnkhhnnamicmpeenaelnjfhikgbkllg"
      ), // AdGuard
    ],
    chromeProfile: path.join(
      process.env.LOCALAPPDATA,
      "Google/Chrome/User Data"
    ),
  },
};
