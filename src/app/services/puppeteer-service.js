const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const { monitors, server, paths } = require("../../../config");

class PuppeteerService {
  #mainBrowser;
  #infoBrowser;
  #extensions;

  constructor() {
    this.#mainBrowser = null;
    this.#infoBrowser = null;
    this.#extensions = this.#initExtensions();
  }

  #initExtensions() {
    return (paths.extensions || [])
      .map(this.#getLatestExtensionPath)
      .filter(Boolean);
  }

  #getLatestExtensionPath(basePath) {
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

  async #launchBrowser(url, isMainScreen) {
    let browser;
    try {
      const baseArgs = [
        `--window-position=${
          isMainScreen ? monitors.positions.main : monitors.positions.secondary
        },0`,
        "--kiosk",
      ];

      if (this.#extensions?.length) {
        baseArgs.push(
          `--disable-extensions-except=${this.#extensions.join(",")}`
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

      const pages = await browser.pages();
      const [firstPage, ...otherPages] = pages;
      await Promise.all(otherPages.map((p) => p.close()));
      const page = firstPage;

      browser.on("targetcreated", async (target) => {
        if (target.type() === "page") {
          const newPage = await target.page();
          if (newPage !== page) await newPage.close();
        }
      });

      if (url) {
        await page
          .goto(url, { waitUntil: "networkidle0" })
          .catch(() => page.goto(url, { waitUntil: "domcontentloaded" }));
      }

      return { browser, page };
    } catch (error) {
      console.error("Ошибка запуска браузера:", error);
      if (browser) await browser.close().catch(() => {});
      throw error;
    }
  }

  async openMovie(movieId) {
    await this.closeMovie();

    const [mainResult, infoResult] = await Promise.all(
      [
        this.#launchBrowser(`${server.baseUrl}/watch?id=${movieId}`, true),
        monitors.count > 1
          ? this.#launchBrowser(`${server.baseUrl}/info`, false)
          : null,
      ].filter(Boolean)
    );

    this.#mainBrowser = mainResult.browser;
    this.#infoBrowser = infoResult?.browser || null;

    return {
      mainPage: mainResult.page,
      infoPage: infoResult?.page || null,
    };
  }

  async closeMovie() {
    const browsers = [
      this.#mainBrowser?.close(),
      this.#infoBrowser?.close(),
    ].filter(Boolean);

    if (browsers.length) {
      await Promise.all(browsers);
    }

    this.#mainBrowser = null;
    this.#infoBrowser = null;
  }
}

module.exports = new PuppeteerService();
