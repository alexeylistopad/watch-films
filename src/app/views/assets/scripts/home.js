const MAX_DATA_POINTS = 60;
let cpuChart, ramChart;
const ws = new WebSocket(`ws://${window.location.host}`);

// Цвета в стиле Apple
const chartColors = {
  cpu: {
    line: "#ff9f0a",
    fill: "rgba(255, 159, 10, 0.1)",
    hover: "#ffb340",
  },
  ram: {
    line: "#0a84ff",
    fill: "rgba(10, 132, 255, 0.1)",
    hover: "#339dff",
  },
};

// Конфигурация графиков
const chartConfig = {
  type: "line",
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 800,
      easing: "easeOutQuint",
    },
    layout: {
      padding: {
        left: 10,
        right: 15,
        top: 15,
        bottom: 10,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(255, 255, 255, 0.03)",
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
      tooltip: {
        backgroundColor: "rgba(28, 28, 30, 0.9)",
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
        titleFont: {
          family:
            "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
          size: 14,
          weight: "600",
        },
        bodyFont: {
          family:
            "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
          size: 13,
        },
        padding: 14,
        cornerRadius: 12,
        boxPadding: 8,
        displayColors: false,
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        intersect: false,
        mode: "index",
        caretSize: 6,
        caretPadding: 8,
      },
    },
    elements: {
      line: {
        tension: 0.4,
        borderWidth: 3,
        fill: true,
        borderJoinStyle: "round",
        borderCapStyle: "round",
      },
      point: {
        radius: 0,
        hitRadius: 10,
        hoverRadius: 5,
      },
    },
    interaction: {
      intersect: false,
      mode: "index",
    },
    hover: {
      mode: "index",
      intersect: false,
    },
  },
};

// Функция для инициализации графиков
function initCharts() {
  console.log("Инициализация графиков...");
  const cpuChartEl = document.getElementById("cpuChart");
  const ramChartEl = document.getElementById("ramChart");

  if (!cpuChartEl || !ramChartEl) {
    console.error("Элементы графиков не найдены!");
    return;
  }

  // Настройка графика CPU
  cpuChart = new Chart(cpuChartEl, {
    ...chartConfig,
    data: {
      labels: Array(MAX_DATA_POINTS).fill(""),
      datasets: [
        {
          data: Array(MAX_DATA_POINTS).fill(null),
          borderColor: chartColors.cpu.line,
          backgroundColor: chartColors.cpu.fill,
          fill: true,
          pointBackgroundColor: chartColors.cpu.line,
          pointHoverBackgroundColor: chartColors.cpu.hover,
          pointHoverBorderColor: "#ffffff",
        },
      ],
    },
    options: {
      ...chartConfig.options,
      scales: {
        ...chartConfig.options.scales,
        y: {
          ...chartConfig.options.scales.y,
          suggestedMax: 90, // Для температуры
        },
      },
    },
  });

  // Настройка графика RAM
  ramChart = new Chart(ramChartEl, {
    ...chartConfig,
    data: {
      labels: Array(MAX_DATA_POINTS).fill(""),
      datasets: [
        {
          data: Array(MAX_DATA_POINTS).fill(null),
          borderColor: chartColors.ram.line,
          backgroundColor: chartColors.ram.fill,
          fill: true,
          pointBackgroundColor: chartColors.ram.line,
          pointHoverBackgroundColor: chartColors.ram.hover,
          pointHoverBorderColor: "#ffffff",
        },
      ],
    },
    options: {
      ...chartConfig.options,
      scales: {
        ...chartConfig.options.scales,
        y: {
          ...chartConfig.options.scales.y,
          suggestedMax: 100, // Для использования RAM
        },
      },
    },
  });

  console.log("Графики инициализированы успешно");
}

// Обработка WebSocket сообщений
ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
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
      if (cpuTemp && cpuTemp !== "N/A") {
        cpuTempEl.textContent = `${cpuTemp}°C`;
        const tempValue = parseFloat(cpuTemp);
        cpuTempEl.className = `metric-badge ${
          tempValue >= 75 ? "high" : tempValue >= 60 ? "medium" : "low"
        }`;

        // Добавляем эффект пульсации при высокой температуре
        if (tempValue >= 75) {
          cpuTempEl.classList.add("pulse");
        } else {
          cpuTempEl.classList.remove("pulse");
        }

        // Обновляем график CPU если он инициализирован
        if (cpuChart) {
          // Добавляем текущую дату/время для метки времени в подсказке
          const now = new Date();
          const timeLabel = now.toLocaleTimeString();

          cpuChart.data.labels.push(timeLabel);
          cpuChart.data.labels.shift();

          cpuChart.data.datasets[0].data.push(tempValue);
          cpuChart.data.datasets[0].data.shift();
          cpuChart.update("none");
        }
      } else {
        cpuTempEl.className = "metric-badge";

        // Если график инициализирован, добавляем null значение
        if (cpuChart) {
          const now = new Date();
          const timeLabel = now.toLocaleTimeString();

          cpuChart.data.labels.push(timeLabel);
          cpuChart.data.labels.shift();

          cpuChart.data.datasets[0].data.push(null);
          cpuChart.data.datasets[0].data.shift();
          cpuChart.update("none");
        }
      }
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
    ramDetailEl.className = `metric-badge ${
      ramPercentage >= 80 ? "high" : ramPercentage >= 60 ? "medium" : "low"
    }`;

    // Добавляем эффект пульсации при высоком использовании RAM
    if (ramPercentage >= 80) {
      ramDetailEl.classList.add("pulse");
    } else {
      ramDetailEl.classList.remove("pulse");
    }

    // Обновляем график RAM если он инициализирован
    if (ramChart) {
      // Добавляем текущую дату/время для метки времени в подсказке
      const now = new Date();
      const timeLabel = now.toLocaleTimeString();

      ramChart.data.labels.push(timeLabel);
      ramChart.data.labels.shift();

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
    processUptime: document.querySelector('[data-key="processUptime"]'),
    port: document.querySelector('[data-key="port"]'),
    monitors: document.querySelector('[data-key="monitors"]'),
    debug: document.querySelector('[data-key="debug"]'),
  };

  if (elements.platform)
    elements.platform.textContent = `${system.os.platform} (${system.os.arch})`;
  if (elements.osRelease) elements.osRelease.textContent = system.os.release;
  if (elements.cpuModel) {
    // Устанавливаем краткое название процессора как текст
    elements.cpuModel.textContent = system.os.cpu.model;

    // Добавляем подсказку в стиле Apple
    if (system.os.cpu.fullModel) {
      elements.cpuModel.classList.add("has-tooltip");
      elements.cpuModel.setAttribute("data-tooltip", system.os.cpu.fullModel);

      // Убедимся, что есть обработчик событий для подсказок
      if (!window.tooltipsInitialized) {
        initTooltips();
        window.tooltipsInitialized = true;
      }
    }
  }
  if (elements.cpuCores)
    elements.cpuCores.textContent = `${system.os.cpu.count} ядер`;
  if (elements.osUptime) elements.osUptime.textContent = system.os.uptime;
  if (elements.processUptime)
    elements.processUptime.textContent = system.process.uptime;
  if (elements.port) elements.port.textContent = config.port;
  if (elements.monitors) elements.monitors.textContent = config.monitors;
  if (elements.debug)
    elements.debug.textContent = config.debug ? "Включен" : "Выключен";
}

// Функция инициализации подсказок в стиле Apple
function initTooltips() {
  // Создаем глобальный элемент подсказки
  if (!document.getElementById("apple-tooltip")) {
    const tooltip = document.createElement("div");
    tooltip.id = "apple-tooltip";
    tooltip.className = "apple-tooltip";
    document.body.appendChild(tooltip);
  }

  // Обработчики событий для показа/скрытия подсказок
  document.addEventListener("mouseover", (e) => {
    const target = e.target.closest(".has-tooltip");
    if (!target) return;

    const tooltipText = target.getAttribute("data-tooltip");
    if (!tooltipText) return;

    const tooltip = document.getElementById("apple-tooltip");
    tooltip.textContent = tooltipText;

    // Позиционирование подсказки
    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // Сначала показываем подсказку выше элемента
    tooltip.style.top = `${rect.top - tooltipRect.height - 8}px`;
    tooltip.style.left = `${
      rect.left + rect.width / 2 - tooltipRect.width / 2
    }px`;

    // Проверяем, не выходит ли подсказка за верхний край экрана
    if (rect.top - tooltipRect.height - 8 < 0) {
      // Если выходит, показываем её ниже элемента
      tooltip.style.top = `${rect.bottom + 8}px`;
    }

    // Добавляем класс для анимации появления
    tooltip.classList.add("visible");
  });

  document.addEventListener("mouseout", (e) => {
    const target = e.target.closest(".has-tooltip");
    if (!target) return;

    const tooltip = document.getElementById("apple-tooltip");
    tooltip.classList.remove("visible");
  });
}

// WebSocket события
ws.onopen = () => {
  console.log("WebSocket подключение установлено");

  // Определяем тип устройства
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  // Отправляем сообщение о подключении клиента с информацией о типе устройства
  ws.send(
    JSON.stringify({
      type: "clientConnected",
      clientType: "browser",
      deviceType: isMobile ? "mobile" : "desktop",
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    })
  );

  showNotification("Подключение к системе мониторинга установлено", "success");
};

ws.onerror = (error) => {
  console.error("WebSocket ошибка:", error);
  showNotification("Ошибка подключения к системе мониторинга", "error");
};

ws.onclose = () => {
  console.log("WebSocket соединение закрыто");

  // Показываем уведомление
  showNotification(
    "Соединение с системой мониторинга прервано. Попытка переподключения...",
    "warning"
  );

  // Пытаемся переподключиться через 3 секунды
  setTimeout(() => {
    // Создаем новое WebSocket подключение
    window.ws = new WebSocket(`ws://${window.location.host}`);

    // Инициализируем все обработчики для нового соединения
    initWebSocketHandlers(window.ws);
  }, 3000);
};

// Функция для инициализации обработчиков WebSocket
function initWebSocketHandlers(socket) {
  // Копируем все обработчики событий для нового соединения
  socket.onopen = ws.onopen;
  socket.onclose = ws.onclose;
  socket.onerror = ws.onerror;
  socket.onmessage = ws.onmessage;

  // Обновляем глобальную переменную
  window.ws = socket;
}

// Инициализация функционала после загрузки DOM
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM загружен, инициализация компонентов...");

  // Инициализируем графики
  initCharts();

  // Инициализируем подсказки
  initTooltips();
  window.tooltipsInitialized = true;

  // Инициализируем форму поиска
  const searchForm = document.getElementById("searchForm");
  if (searchForm) {
    searchForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const movieSearch = document.getElementById("movieSearch");
      if (!movieSearch) return;

      const movieName = movieSearch.value.trim();
      if (!movieName) {
        showNotification("Введите название фильма для поиска", "warning");
        return;
      }

      // Показываем уведомление о начале поиска
      showNotification(`Поиск фильма: "${movieName}"...`, "info");

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
  }
});

// Добавляем стили для визуальной индикации
document.addEventListener("DOMContentLoaded", () => {
  const style = document.createElement("style");
  style.textContent = `
    .info-value.has-tooltip {
      position: relative;
      cursor: default;
      border-bottom: none;
      position: relative;
    }
    
    .info-value.has-tooltip::after {
      content: "";
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 100%;
      height: 1px;
      background-color: var(--color-text-secondary);
      opacity: 0.3;
      transition: opacity 0.2s ease;
    }
    
    .info-value.has-tooltip:hover::after {
      opacity: 0.6;
    }
  `;
  document.head.appendChild(style);
});

// Функция для отображения уведомлений в стиле Apple
function showNotification(message, type = "info", duration = 5000) {
  const notificationsContainer = document.getElementById("notifications");
  if (!notificationsContainer) {
    console.error("Контейнер уведомлений не найден");
    return;
  }

  const notification = document.createElement("div");
  notification.className = `notification ${type}`;

  // Добавляем иконку уведомления
  const iconSVG = document.createElement("div");
  iconSVG.className = "notification-icon";

  let iconPath = "";
  switch (type) {
    case "success":
      iconPath =
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34c759" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
      break;
    case "error":
      iconPath =
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
      break;
    case "warning":
      iconPath =
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff9500" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
      break;
    default: // info
      iconPath =
        '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007aff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  }

  iconSVG.innerHTML = iconPath;

  const messageText = document.createElement("div");
  messageText.className = "notification-message";

  // Поддержка HTML-контента
  if (message.includes("<") && message.includes(">")) {
    messageText.innerHTML = message;
  } else {
    messageText.textContent = message;
  }

  notification.appendChild(iconSVG);
  notification.appendChild(messageText);

  notificationsContainer.appendChild(notification);

  // Добавляем CSS для пульсации
  if (!document.querySelector("style.pulse-animation")) {
    const style = document.createElement("style");
    style.className = "pulse-animation";
    style.textContent = `
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      .pulse {
        animation: pulse 1.5s infinite;
      }
    `;
    document.head.appendChild(style);
  }

  // Анимация появления
  setTimeout(() => {
    notification.classList.add("show");
  }, 50);

  // Автоматическое скрытие уведомления
  setTimeout(() => {
    notification.classList.remove("show");

    // Удаляем элемент после завершения анимации
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, duration);
}
