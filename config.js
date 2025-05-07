/**
 * Конфигурация приложения
 *
 * server:
 *   port - порт на котором запускается сервер
 *   host - хост для прослушивания (0.0.0.0 для доступа из сети)
 *   baseUrl - базовый URL для сервера
 *   apiKey - ключ API для авторизации
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
const apiKeyService = require("./src/app/services/api-key-service");

module.exports = {
  server: {
    port: 3060,
    host: "0.0.0.0",
    baseUrl: "http://localhost:3060",
    get apiKey() {
      return apiKeyService.getKey();
    },
  },
  kinopoisk: {
    apiKey: "MKWNBC6-HG84M2H-HYMW0MW-88VZY19",
  },
  monitors: {
    count: 2,
    positions: {
      main: 0,
      secondary: -2560,
    },
  },
  debug: {
    useMockData: false,
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
