/**
 * Конфигурация приложения
 *
 * server:
 *   port - порт на котором запускается сервер
 *   host - хост для прослушивания (0.0.0.0 для доступа из сети)
 *
 * kinopoisk:
 *   apiKey - ключ API для доступа к Kinopoisk API (https://kinopoisk.dev)
 */

module.exports = {
  server: {
    port: 3060,
    host: "0.0.0.0",
  },
  kinopoisk: {
    apiKey: "MKWNBC6-HG84M2H-HYMW0MW-88VZY19",
  },
};
