const puppeteer = require("puppeteer-core");
const { monitors, server, paths } = require("../../../config");
const { findInstalledChrome } = require("../../utils/chrome-finder");

let mainBrowser = null;
let infoBrowser = null;

async function launchBrowser(url, isMainScreen) {
  try {
    const chromePath = await findInstalledChrome();

    const browser = await puppeteer.launch({
      headless: false,
      executablePath: chromePath,
      defaultViewport: null,
      ignoreDefaultArgs: ["--enable-automation"],
      args: [
        `--kiosk`,
        `--window-position=${
          isMainScreen ? monitors.positions.main : monitors.positions.secondary
        },0`,
      ],
    });

    // Используем первую страницу вместо создания новой
    const page = (await browser.pages())[0];
    await page.setDefaultNavigationTimeout(30000);

    console.log("Переход по URL:", url);
    await page.goto(url, { waitUntil: "networkidle0" });

    return { browser, page };
  } catch (error) {
    console.error("Ошибка запуска браузера:", error);
    if (error.message.includes("Failed to launch")) {
      throw new Error(`Не удалось запустить Chrome. Проверьте: 
        1. Установлен ли Chrome в системе
        2. Права на запуск Chrome
        Исходная ошибка: ${error.message}`);
    }
    throw error;
  }
}

const openMovieInBrowser = async (movieId) => {
  if (mainBrowser) {
    await mainBrowser.close();
  }

  const url = `${server.baseUrl}/watch?id=${movieId}`;
  const result = await launchBrowser(url, true);
  mainBrowser = result.browser;
  return result.page;
};

const openMovieInfoInBrowser = async (movieData) => {
  // Не открываем инфо если используется один монитор
  if (monitors.count === 1) {
    return null;
  }

  if (infoBrowser) {
    await infoBrowser.close();
  }

  const url = `${server.baseUrl}/info`;
  const result = await launchBrowser(url, false);
  infoBrowser = result.browser;
  return result.page;
};

const closeAllBrowsers = async () => {
  const browsers = [
    mainBrowser && mainBrowser.close(),
    infoBrowser && infoBrowser.close(),
  ].filter(Boolean);

  if (browsers.length) {
    await Promise.all(browsers);
  }

  mainBrowser = null;
  infoBrowser = null;
};

module.exports = {
  openMovieInBrowser,
  openMovieInfoInBrowser,
  closeAllBrowsers,
};
