const fs = require("fs");
const path = require("path");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

async function findInstalledChrome() {
  // Массив возможных путей к Chrome
  const paths = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(
      process.env.LOCALAPPDATA,
      "Google\\Chrome\\Application\\chrome.exe"
    ),
    path.join(
      process.env.PROGRAMFILES,
      "Google\\Chrome\\Application\\chrome.exe"
    ),
  ];

  // Попытка найти Chrome через реестр Windows
  try {
    const { stdout } = await exec(
      'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" /ve'
    );
    const match = /REG_SZ\s+([^\n]+)/.exec(stdout);
    if (match) {
      paths.unshift(match[1]);
    }
  } catch (e) {
    console.log("Не удалось найти Chrome в реестре Windows");
  }

  // Проверка каждого пути
  for (const browserPath of paths) {
    try {
      if (browserPath && fs.existsSync(browserPath)) {
        console.log("Found Chrome at:", browserPath);
        return browserPath;
      }
    } catch (err) {
      console.error("Error checking path:", browserPath, err);
    }
  }

  throw new Error("Chrome не найден в системе");
}

module.exports = { findInstalledChrome };
