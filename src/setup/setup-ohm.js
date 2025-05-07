/**
 * Script for automatic downloading and installation of OpenHardwareMonitor
 * Runs automatically during npm install
 */

const fs = require("fs-extra");
const path = require("path");
const http = require("http");
const https = require("https");
const AdmZip = require("adm-zip");
const { execSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "../..");

const OHM_DOWNLOAD_URL =
  "https://github.com/openhardwaremonitor/openhardwaremonitor/releases/download/v0.9.6/OpenHardwareMonitor-0.9.6.zip";

const ALTERNATIVE_URLS = [
  "https://openhardwaremonitor.org/files/openhardwaremonitor-v0.9.6.zip",
  "https://sourceforge.net/projects/openhardwaremonitor/files/openhw-v0.9.6.zip/download",
];

const OHM_INSTALL_PATH = path.join(
  projectRoot,
  "node_modules",
  "open-hardware-monitor"
);

const VBS_PATH = path.join(OHM_INSTALL_PATH, "close_ohm.vbs");

// Suppress initial debug messages
const originalConsoleLog = console.log;
console.log = function (...args) {
  const msg = args.join(" ").toString();
  if (
    msg.includes("Корневая директория проекта:") ||
    msg.includes("Путь установки OpenHardwareMonitor:")
  ) {
    return;
  }
  originalConsoleLog.apply(console, args);
};

function createProgressBar(title, total = 100) {
  const barLength = 30;
  let current = 0;

  function update(progress) {
    current = Math.min(progress, total);
    const percentage = Math.floor((current / total) * 100);
    const filledLength = Math.floor((current / total) * barLength);
    const filled = "█".repeat(filledLength);
    const empty = "░".repeat(barLength - filledLength);

    process.stdout.write(`\r${title} [${filled}${empty}] ${percentage}%`);

    if (current === total) {
      process.stdout.write("\n");
    }
  }

  return { update };
}

async function downloadFile(primaryUrl, alternativeUrls, outputPath) {
  console.log(`Checking for OpenHardwareMonitor download...`);

  try {
    const success = await downloadWithProgress(primaryUrl, outputPath);
    if (success) {
      console.log(`✓ Downloaded successfully to ${outputPath}`);
      return true;
    }
    throw new Error("Primary download failed");
  } catch (error) {
    console.error(`Error downloading from primary URL: ${error.message}`);

    // Try alternative URLs
    for (const url of alternativeUrls) {
      console.log(`Attempting to download from alternative URL: ${url}`);
      try {
        const success = await downloadWithProgress(url, outputPath);
        if (success) {
          console.log(
            `✓ Downloaded successfully from alternative URL to ${outputPath}`
          );
          return true;
        }
      } catch (altError) {
        console.error(
          `Error downloading from alternative URL ${url}: ${altError.message}`
        );
      }
    }

    return false;
  }
}

function downloadWithProgress(url, outputPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;

    const request = client.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36",
        },
        timeout: 30000,
      },
      (response) => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          // Handle redirects
          return downloadWithProgress(response.headers.location, outputPath)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          return reject(
            new Error(`Failed to download, status code: ${response.statusCode}`)
          );
        }

        const totalLength = parseInt(response.headers["content-length"], 10);
        let downloadedLength = 0;

        const progressBar = totalLength
          ? createProgressBar("Downloading", totalLength)
          : null;

        fs.ensureDirSync(path.dirname(outputPath));
        const fileStream = fs.createWriteStream(outputPath);

        response.pipe(fileStream);

        response.on("data", (chunk) => {
          downloadedLength += chunk.length;
          if (progressBar) {
            progressBar.update(downloadedLength);
          }
        });

        fileStream.on("finish", () => {
          fileStream.close();
          resolve(true);
        });

        fileStream.on("error", (err) => {
          fs.unlinkSync(outputPath);
          reject(err);
        });
      }
    );

    request.on("error", (err) => {
      reject(err);
    });

    request.on("timeout", () => {
      request.abort();
      reject(new Error("Request timeout"));
    });
  });
}

function isValidZip(zipPath) {
  try {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    return entries.some((entry) =>
      entry.entryName.toLowerCase().includes("openhardwaremonitor.exe")
    );
  } catch (error) {
    console.error(`Ошибка при проверке ZIP-архива: ${error.message}`);
    return false;
  }
}

function extractZip(zipPath, extractPath) {
  console.log(`Extracting archive...`);

  try {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    const totalEntries = entries.length;
    const progressBar = createProgressBar("Extracting", totalEntries);
    let extractedCount = 0;

    const hasRootFolder = entries.some(
      (entry) =>
        entry.entryName.startsWith("OpenHardwareMonitor/") ||
        entry.entryName.startsWith("OpenHardwareMonitor\\")
    );

    if (hasRootFolder) {
      console.log(
        "Archive contains root folder. Extracting content without nested directories..."
      );

      for (const entry of entries) {
        const filePath = entry.entryName;
        if (
          filePath === "OpenHardwareMonitor/" ||
          filePath === "OpenHardwareMonitor\\"
        ) {
          extractedCount++;
          progressBar.update(extractedCount);
          continue;
        }

        if (
          filePath.startsWith("OpenHardwareMonitor/") ||
          filePath.startsWith("OpenHardwareMonitor\\")
        ) {
          const fileName = filePath.replace(/^OpenHardwareMonitor[\/\\]/, "");

          if (entry.isDirectory) {
            fs.ensureDirSync(path.join(extractPath, fileName));
          } else {
            const content = zip.readFile(entry);
            const targetPath = path.join(extractPath, fileName);
            fs.ensureDirSync(path.dirname(targetPath));
            fs.writeFileSync(targetPath, content);
          }
        }

        extractedCount++;
        progressBar.update(extractedCount);
      }
    } else {
      console.log("Extracting all archive contents...");

      for (const entry of entries) {
        if (entry.isDirectory) {
          fs.ensureDirSync(path.join(extractPath, entry.entryName));
        } else {
          const content = zip.readFile(entry);
          const targetPath = path.join(extractPath, entry.entryName);
          fs.ensureDirSync(path.dirname(targetPath));
          fs.writeFileSync(targetPath, content);
        }

        extractedCount++;
        progressBar.update(extractedCount);
      }
    }

    console.log("✓ Archive extracted successfully");
    return true;
  } catch (error) {
    console.error(`Error extracting archive: ${error.message}`);
    return false;
  }
}

function createVbsScript() {
  console.log(`Creating closing script...`);

  const vbsPath = path.join(OHM_INSTALL_PATH, "close_ohm.vbs");

  const vbsContent = `' Скрипт для остановки OpenHardwareMonitor без отображения окна
Option Explicit

Dim objShell
Set objShell = CreateObject("WScript.Shell")

objShell.Run "taskkill /F /IM OpenHardwareMonitor.exe /T", 0, True

Dim wmiCmd
wmiCmd = "powershell.exe -WindowStyle Hidden -Command ""Get-WmiObject Win32_Process -Filter """"Name='OpenHardwareMonitor.exe'"""" | ForEach-Object { $_.Terminate() }"""
objShell.Run wmiCmd, 0, True

Set objShell = Nothing`;

  try {
    fs.ensureDirSync(OHM_INSTALL_PATH);
    fs.writeFileSync(vbsPath, vbsContent);

    const readmePath = path.join(OHM_INSTALL_PATH, "README.md");
    const readmeContent = `# OpenHardwareMonitor

Hardware monitoring library for system temperature and performance monitoring.

## Files

- \`OpenHardwareMonitor.exe\` - Main executable file
- \`close_ohm.vbs\` - VBScript for closing OpenHardwareMonitor without console windows

## Usage

This package is installed automatically during \`npm install\` by the setup script located at \`src/setup/setup-ohm.js\`.

## Version

Current version: 0.9.6

## Project Integration

This module is used in the watch-films project for monitoring system hardware performance.`;

    fs.writeFileSync(readmePath, readmeContent);

    return true;
  } catch (error) {
    console.error(`Error creating script: ${error.message}`);
    return false;
  }
}

async function checkLocalFiles() {
  console.log("Checking for local files...");

  const possibleLocations = [
    path.join(__dirname, "../../releases/OpenHardwareMonitor"),
    path.join(__dirname, "../../downloads/OpenHardwareMonitor"),
    path.join(__dirname, "../../vendor/OpenHardwareMonitor"),
  ];

  for (const location of possibleLocations) {
    if (await fs.pathExists(location)) {
      console.log(`Найдена локальная папка: ${location}`);

      const exePath = path.join(location, "OpenHardwareMonitor.exe");
      if (await fs.pathExists(exePath)) {
        console.log(`Найден исполняемый файл: ${exePath}`);

        await fs.ensureDir(OHM_INSTALL_PATH);
        await fs.copy(location, OHM_INSTALL_PATH);

        console.log(`Файлы скопированы из ${location} в ${OHM_INSTALL_PATH}`);
        return true;
      }
    }
  }

  return false;
}

async function installOpenHardwareMonitor() {
  const tempDir = path.join(projectRoot, "temp");
  const zipPath = path.join(tempDir, "OpenHardwareMonitor.zip");

  try {
    const nodeModulesPath = path.join(projectRoot, "node_modules");
    if (!(await fs.pathExists(nodeModulesPath))) {
      console.log(`Creating node_modules directory`);
      await fs.ensureDir(nodeModulesPath);
    }

    if (
      await fs.pathExists(
        path.join(OHM_INSTALL_PATH, "OpenHardwareMonitor.exe")
      )
    ) {
      console.log("✓ OpenHardwareMonitor is already installed");

      if (!(await fs.pathExists(VBS_PATH))) {
        createVbsScript();
      }

      return true;
    }

    const localFilesFound = await checkLocalFiles();
    if (localFilesFound) {
      console.log("✓ Using local files");
      createVbsScript();
      return true;
    }

    await fs.ensureDir(tempDir);

    const downloadSuccess = await downloadFile(
      OHM_DOWNLOAD_URL,
      ALTERNATIVE_URLS,
      zipPath
    );
    if (!downloadSuccess) {
      throw new Error("Failed to download OpenHardwareMonitor from any source");
    }

    if (!isValidZip(zipPath)) {
      throw new Error(
        "Downloaded archive is corrupted or has incorrect format"
      );
    }

    if (await fs.pathExists(OHM_INSTALL_PATH)) {
      console.log(`Removing existing installation`);
      await fs.remove(OHM_INSTALL_PATH);
    }

    await fs.ensureDir(OHM_INSTALL_PATH);

    const extractSuccess = extractZip(zipPath, OHM_INSTALL_PATH);
    if (!extractSuccess) {
      throw new Error("Failed to extract archive");
    }

    if (
      !(await fs.pathExists(
        path.join(OHM_INSTALL_PATH, "OpenHardwareMonitor.exe")
      ))
    ) {
      console.log("Checking extracted file structure...");

      const nestedPath = path.join(
        OHM_INSTALL_PATH,
        "OpenHardwareMonitor",
        "OpenHardwareMonitor.exe"
      );
      if (await fs.pathExists(nestedPath)) {
        console.log("Correcting folder structure...");

        const tempExtractDir = path.join(tempDir, "extracted");
        await fs.ensureDir(tempExtractDir);

        await fs.copy(
          path.join(OHM_INSTALL_PATH, "OpenHardwareMonitor"),
          tempExtractDir
        );

        await fs.emptyDir(OHM_INSTALL_PATH);

        await fs.copy(tempExtractDir, OHM_INSTALL_PATH);

        console.log("✓ File structure corrected");
      }
    }

    createVbsScript();

    console.log("Cleaning up...");
    await fs.remove(tempDir);

    console.log("✓ OpenHardwareMonitor installed successfully");
    return true;
  } catch (error) {
    console.error(`❌ Installation error: ${error.message}`);
    console.error(
      "Please download and install OpenHardwareMonitor manually from:"
    );
    console.error("https://openhardwaremonitor.org/downloads/");

    return false;
  }
}

// Обновляем сообщение успешной установки
(async () => {
  const success = await installOpenHardwareMonitor();
  if (success) {
    console.log(
      "\nadded 1 package: open-hardware-monitor@0.9.6 (from src/setup/setup-ohm.js)"
    );
  } else {
    console.log(
      "\nfailed to add package: open-hardware-monitor@0.9.6 (from src/setup/setup-ohm.js)"
    );
    process.exit(1);
  }
})();
