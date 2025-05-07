const config = require("../../../config");

function authMiddleware(req, res, next) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== config.server.apiKey) {
    return res.status(401).json({
      status: "error",
      message: "Неверный или отсутствующий API ключ",
    });
  }

  next();
}

module.exports = authMiddleware;
