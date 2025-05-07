const MAX_DATA_POINTS = 60;
let cpuChart, ramChart;
const ws = new WebSocket(`ws://${window.location.host}`);

// Конфигурация графиков
const chartConfig = {
  type: "line",
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    layout: {
      padding: {
        left: 10,
        right: 10,
        top: 5,
        bottom: 5,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
          lineWidth: 0.5,
          drawBorder: false,
          drawTicks: false,
        },
        ticks: {
          display: false,
          count: 5,
        },
        border: {
          display: false,
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          display: false,
        },
        border: {
          display: false,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
    },
    elements: {
      line: {
        tension: 0.4,
        borderWidth: 2,
        fill: true,
      },
      point: {
        radius: 0,
      },
    },
  },
};

// Функция для инициализации графиков после полной загрузки страницы
function initCharts() {
  console.log("Инициализация графиков...");
  const cpuChartEl = document.getElementById("cpuChart");
  const ramChartEl = document.getElementById("ramChart");

  if (!cpuChartEl || !ramChartEl) {
    console.error("Элементы графиков не найдены!");
    return;
  }

  // Инициализация графика CPU
  cpuChart = new Chart(cpuChartEl, {
    ...chartConfig,
    data: {
      labels: Array(MAX_DATA_POINTS).fill(""),
      datasets: [
        {
          data: Array(MAX_DATA_POINTS).fill(0),
          borderColor: "#ff9800", // Оранжевый цвет для температуры
          backgroundColor: "rgba(255, 152, 0, 0.1)",
          fill: true,
        },
      ],
    },
  });

  // Инициализация графика RAM
  ramChart = new Chart(ramChartEl, {
    ...chartConfig,
    data: {
      labels: Array(MAX_DATA_POINTS).fill(""),
      datasets: [
        {
          data: Array(MAX_DATA_POINTS).fill(0),
          borderColor: "#2196f3",
          backgroundColor: "rgba(33, 150, 243, 0.1)",
          fill: true,
        },
      ],
    },
  });

  console.log("Графики инициализированы успешно");
}

// Обработка WebSocket сообщений
ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    console.log("Получены данные от WebSocket:", data);

    // Проверим наличие данных о температуре
    if (data.system && data.system.os && data.system.os.cpu) {
      console.log("Температура CPU:", data.system.os.cpu.temp);
    } else {
      console.error(
        "Структура данных не содержит информацию о температуре CPU"
      );
    }

    updateUI(data);
  } catch (error) {
    console.error("Ошибка обработки данных:", error);
  }
};

// Обновление пользовательского интерфейса
function updateUI(data) {
  if (!data || !data.system) {
    console.error("Получены неверные данные для обновления UI");
    return;
  }

  const { system, config } = data;

  // Обновляем информацию о процессоре
  if (system.os && system.os.cpu) {
    const cpuTemp = system.os.cpu.temp;
    const cpuTempEl = document.querySelector('[data-value="cpu-temp"]');

    if (cpuTempEl) {
      // Проверяем, что cpuTemp не равен N/A
      if (cpuTemp && cpuTemp !== 'N/A') {
        console.log('Обновляем элемент температуры CPU:', cpuTemp);
        cpuTempEl.textContent = `${cpuTemp}°C`;
        
        const tempValue = parseFloat(cpuTemp);
        cpuTempEl.className = `metric-value ${
          tempValue >= 75
            ? "high"
            : tempValue >= 60
            ? "medium"
            : "low"
        }`;
        
        // Обновляем график CPU если он инициализирован
        if (cpuChart) {
          cpuChart.data.datasets[0].data.push(tempValue);
          cpuChart.data.datasets[0].data.shift();
          cpuChart.update("none");
        } else {
          console.warn('График CPU не инициализирован');
        }
      } else {
        console.warn('Температура CPU недоступна');
        cpuTempEl.textContent = 'Н/Д';
        cpuTempEl.className = 'metric-value';
        
        // Если график инициализирован, добавляем null значение
        if (cpuChart) {
          cpuChart.data.datasets[0].data.push(null);
          cpuChart.data.datasets[0].data.shift();
          cpuChart.update("none");
        }
      }
    } else {
      console.warn('Элемент для отображения температуры CPU не найден');
    }
  }

  // Обновляем информацию о RAM
  const totalRam = parseFloat(system.os.totalMemory);
  const freeRam = parseFloat(system.os.freeMemory);
  const usedRam = parseFloat(system.os.usedMemory);
  const ramPercentage = parseFloat(system.os.memoryUsagePercent);

  const ramDetailEl = document.querySelector('[data-value="ram-detail"]');
  if (ramDetailEl) {
    ramDetailEl.textContent = `${usedRam.toFixed(1)} / ${totalRam.toFixed(
      1
    )} GB`;
    ramDetailEl.className = `metric-value ${
      ramPercentage >= 80 ? "high" : ramPercentage >= 60 ? "medium" : "low"
    }`;

    // Обновляем график RAM если он инициализирован
    if (ramChart) {
      ramChart.data.datasets[0].data.push(ramPercentage);
      ramChart.data.datasets[0].data.shift();
      ramChart.update("none");
    }
  }

  // Обновляем системную информацию
  updateSystemInfo(data);
}

// Обновление системной информации
function updateSystemInfo(data) {
  const { system, config } = data;

  const elements = {
    platform: document.querySelector('[data-key="platform"]'),
    osRelease: document.querySelector('[data-key="osRelease"]'),
    cpuModel: document.querySelector('[data-key="cpuModel"]'),
    cpuCores: document.querySelector('[data-key="cpuCores"]'),
    osUptime: document.querySelector('[data-key="uptime"]'),
    nodeVersion: document.querySelector('[data-key="nodeVersion"]'),
    processUptime: document.querySelector('[data-key="processUptime"]'),
    port: document.querySelector('[data-key="port"]'),
    monitors: document.querySelector('[data-key="monitors"]'),
    debug: document.querySelector('[data-key="debug"]'),
  };

  if (elements.platform)
    elements.platform.textContent = `${system.os.platform} (${system.os.arch})`;
  if (elements.osRelease) elements.osRelease.textContent = system.os.release;
  if (elements.cpuModel)
    elements.cpuModel.textContent = system.os.cpu.model
      .replace(/\((R|TM)\)|CPU|@\s/g, "")
      .trim();
  if (elements.cpuCores)
    elements.cpuCores.textContent = `${system.os.cpu.count} ядер`;
  if (elements.osUptime) elements.osUptime.textContent = system.os.uptime;
  if (elements.nodeVersion)
    elements.nodeVersion.textContent = system.process.nodeVersion;
  if (elements.processUptime)
    elements.processUptime.textContent = system.process.uptime;
  if (elements.port) elements.port.textContent = config.port;
  if (elements.monitors) elements.monitors.textContent = config.monitors;
  if (elements.debug)
    elements.debug.textContent = config.debug ? "Включен" : "Выключен";
}

// WebSocket событие открытия соединения
ws.onopen = () => {
  console.log("WebSocket подключение установлено");
};

// WebSocket ошибка
ws.onerror = (error) => {
  console.error("WebSocket ошибка:", error);
};

// Добавляем обработчик поиска
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM загружен, инициализация компонентов...");

  // Инициализируем графики после загрузки DOM
  initCharts();

  // Инициализируем форму поиска
  const searchForm = document.getElementById("searchForm");
  if (searchForm) {
    searchForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const movieSearch = document.getElementById("movieSearch");
      if (!movieSearch) return;

      const movieName = movieSearch.value.trim();
      if (!movieName) return;

      try {
        const response = await fetch("/command", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": window.apiKey,
          },
          body: JSON.stringify({
            command: "searchMovie",
            name: movieName,
          }),
        });

        const data = await response.json();

        if (data.status === "success") {
          movieSearch.value = "";
          showNotification(data.message, "success");
        } else {
          showNotification(data.message || "Произошла ошибка", "error");
        }
      } catch (error) {
        showNotification("Ошибка при поиске фильма", "error");
      }
    });
  } else {
    console.error("Форма поиска не найдена!");
  }
});

// Функция для отображения уведомлений
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add("show");
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }, 100);
}
