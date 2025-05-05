const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const { monitors, server, paths } = require("../../../config");

let mainBrowser = null;
let infoBrowser = null;
let cachedExtensionPaths = null;

function getLatestExtensionPath(basePath) {
  try {
    const versions = fs.readdirSync(basePath);
    const latest = versions.length
      ? path.join(basePath, versions[versions.length - 1])
      : null;
    return latest && fs.existsSync(path.join(latest, "manifest.json"))
      ? latest
      : null;
  } catch {
    return null;
  }
}

// Инициализируем расширения
cachedExtensionPaths = (paths.extensions || [])
  .map(getLatestExtensionPath)
  .filter(Boolean);

async function launchBrowser(url, isMainScreen) {
  let browser;
  try {
    const baseArgs = [
      `--window-position=${
        isMainScreen ? monitors.positions.main : monitors.positions.secondary
      },0`,
      "--kiosk",
    ];

    if (cachedExtensionPaths && cachedExtensionPaths.length) {
      baseArgs.push(
        `--disable-extensions-except=${cachedExtensionPaths.join(",")}`
      );
    }

    baseArgs.push("--new-window");

    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      channel: "chrome",
      ignoreDefaultArgs: ["--enable-automation"],
      args: baseArgs,
    });

    // Закрываем все вкладки кроме первой,так как блокеры рекламы срут своими приветствиями
    const pages = await browser.pages();
    const [firstPage, ...otherPages] = pages;
    await Promise.all(otherPages.map((p) => p.close()));
    let page = firstPage;

    // Автоматически закрываем новые вкладки
    browser.on("targetcreated", async (target) => {
      if (target.type() === "page") {
        const newPage = await target.page();
        if (newPage !== page) {
          await newPage.close();
        }
      }
    });

    if (url) {
      try {
        await page.goto(url, {
          waitUntil: "networkidle0",
        });
      } catch (error) {
        console.error("Ошибка при загрузке страницы:", error);
        // Если первая попытка не удалась, пробуем еще раз
        await page.goto(url, {
          waitUntil: "domcontentloaded",
        });
      }
    }

    return { browser, page };
  } catch (error) {
    console.error("Детали ошибки:", error);
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    throw error;
  }
}

const openMovie = async (movieId) => {
  await closeMovie();

  const [mainResult, infoResult] = await Promise.all(
    [
      launchBrowser(`${server.baseUrl}/watch?id=${movieId}`, true),
      monitors.count > 1
        ? launchBrowser(`${server.baseUrl}/info`, false)
        : null,
    ].filter(Boolean)
  );

  mainBrowser = mainResult.browser;
  if (infoResult) {
    infoBrowser = infoResult.browser;
  }

  return {
    mainPage: mainResult.page,
    infoPage: infoResult?.page || null,
  };
};

const closeMovie = async () => {
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
  openMovie,
  closeMovie,
};
