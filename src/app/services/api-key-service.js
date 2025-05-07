const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

class ApiKeyService {
  #keyPath;

  constructor() {
    this.#keyPath = path.join(__dirname, "../../../.apikey");
  }

  generateKey() {
    const key = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(this.#keyPath, key);
    return key;
  }

  getKey() {
    try {
      return fs.readFileSync(this.#keyPath, "utf8").trim();
    } catch {
      return this.generateKey();
    }
  }
}

module.exports = new ApiKeyService();
