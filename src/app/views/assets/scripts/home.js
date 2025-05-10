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

  // Определяем, является ли устройство iOS для особых настроек
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  // Обновляем параметры конфигурации для графиков
  const chartConfigWithDisabledInteractions = {
    ...chartConfig,
    options: {
      ...chartConfig.options,
      // Отключаем все взаимодействия с точками для всех устройств
      elements: {
        ...chartConfig.options.elements,
        point: {
          radius: 0,
          hitRadius: 0, // Убираем hitRadius, чтобы точки невозможно было выбрать
          hoverRadius: 0, // Убираем hoverRadius, чтобы точки не подсвечивались
        },
      },
      hover: {
        mode: null, // Отключаем hover-режим
      },
      interaction: {
        mode: null, // Отключаем режим взаимодействия
        intersect: false,
      },
      events: isIOS
        ? []
        : ["mousemove", "mouseout", "click", "touchstart", "touchmove"], // Для iOS полностью отключаем события
    },
  };

  // Настройка графика CPU
  cpuChart = new Chart(cpuChartEl, {
    ...chartConfigWithDisabledInteractions,
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
      ...chartConfigWithDisabledInteractions.options,
      scales: {
        ...chartConfigWithDisabledInteractions.options.scales,
        y: {
          ...chartConfigWithDisabledInteractions.options.scales.y,
          suggestedMax: 90, // Для температуры
        },
      },
    },
  });

  // Настройка графика RAM
  ramChart = new Chart(ramChartEl, {
    ...chartConfigWithDisabledInteractions,
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
      ...chartConfigWithDisabledInteractions.options,
      scales: {
        ...chartConfigWithDisabledInteractions.options.scales,
        y: {
          ...chartConfigWithDisabledInteractions.options.scales.y,
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
    console.log(`Получены данные типа: ${data.type || "полные данные"}`);

    // Обрабатываем разные типы данных
    if (data.type === "systemData") {
      // Обрабатываем частичные данные для iOS (только CPU и RAM)
      updatePartialData(data);
    } else {
      // Полные данные - обновляем весь интерфейс
      updateUI(data);
    }
  } catch (error) {
    console.error("Ошибка обработки данных:", error, event.data);
  }
};

// Функция для обновления только CPU и RAM данных
function updatePartialData(data) {
  // Обновляем данные о температуре CPU
  if (data.cpuTemp !== undefined) {
    const cpuTempEl = document.querySelector('[data-value="cpu-temp"]');
    if (cpuTempEl) {
      if (data.cpuTemp && data.cpuTemp !== "N/A") {
        const tempValue = parseFloat(data.cpuTemp);
        cpuTempEl.textContent = `${data.cpuTemp}°C`;
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
          const now = new Date();
          const timeLabel = now.toLocaleTimeString();

          cpuChart.data.labels.push(timeLabel);
          cpuChart.data.labels.shift();

          cpuChart.data.datasets[0].data.push(tempValue);
          cpuChart.data.datasets[0].data.shift();
          cpuChart.update("none");
        }
      } else {
        cpuTempEl.textContent = "N/A";
        cpuTempEl.className = "metric-badge";
      }
    }
  }

  // Обновляем данные о памяти
  if (data.memInfo) {
    const ramDetailEl = document.querySelector('[data-value="ram-detail"]');
    if (ramDetailEl) {
      const totalRam = parseFloat(data.memInfo.total);
      const usedRam = parseFloat(data.memInfo.used);
      const ramPercentage = (usedRam / totalRam) * 100;

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
        const now = new Date();
        const timeLabel = now.toLocaleTimeString();

        ramChart.data.labels.push(timeLabel);
        ramChart.data.labels.shift();

        ramChart.data.datasets[0].data.push(ramPercentage);
        ramChart.data.datasets[0].data.shift();
        ramChart.update("none");
      }
    }
  }
}

// Функция обновления всего интерфейса
function updateUI(data) {
  if (!data || !data.system) {
    console.error("Получены неверные данные для обновления UI");
    return;
  }

  const { system, config } = data;
  console.log("Обновление полного UI с данными:", {
    cpuTemp: system.os.cpu.temp,
    ram: `${system.os.usedMemory}/${system.os.totalMemory}`,
  });

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
        cpuTempEl.textContent = "N/A";

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

// В функции, которая вызывается при открытии WebSocket соединения,
// добавляем запрос на начальные полные данные
ws.onopen = () => {
  console.log("WebSocket подключение установлено");

  // Определяем тип устройства
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  console.log(
    `Устройство: ${isMobile ? "мобильное" : "десктоп"}, iOS: ${isIOS}`
  );

  // Отправляем сообщение о подключении клиента с информацией о типе устройства
  ws.send(
    JSON.stringify({
      type: "clientConnected",
      clientType: "browser",
      deviceType: isMobile ? "mobile" : "desktop",
      isIOS: isIOS,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    })
  );

  // Явно запрашиваем полные данные для начальной загрузки
  setTimeout(() => {
    console.log("Запрос полных данных...");
    ws.send(JSON.stringify({ type: "requestData" }));
  }, 1000);

  // Удаляем уведомление об успешном подключении
  // showNotification("Подключение к системе мониторинга установлено", "success");
};

// Запрашиваем обновление данных каждые 30 секунд для гарантии актуальности
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    console.log("Периодический запрос полных данных...");
    ws.send(JSON.stringify({ type: "requestData" }));
  }
}, 30000);

// Определяем, является ли устройство iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// Функция для отображения уведомлений в стиле iOS
function showIOSNotification(title, message, type = "info", duration = 5000) {
  // Показываем только сообщения об ошибках
  if (type !== "error") return;

  const notificationsContainer = document.getElementById("notifications");
  if (!notificationsContainer) return;

  // Добавляем стили iOS-уведомлений, если они еще не добавлены
  if (!document.getElementById("ios-notification-styles")) {
    const iosStyles = document.createElement("style");
    iosStyles.id = "ios-notification-styles";
    iosStyles.textContent = `
      .ios-notification {
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%) translateY(-100%);
        width: 90%;
        max-width: 350px;
        background-color: rgba(28, 28, 30, 0.85);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-radius: 13px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        padding: 12px 15px;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        z-index: 100000;
        opacity: 0;
        transition: transform 0.4s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.4s cubic-bezier(0.23, 1, 0.32, 1);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .ios-notification.show {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
      
      .ios-notification-title {
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 2px;
        color: #ffffff;
      }
      
      .ios-notification-message {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.8);
        line-height: 1.4;
      }
      
      /* Эффект нажатия для iOS notification */
      .ios-tap-animation {
        animation: ios-tap 0.2s cubic-bezier(0.23, 1, 0.32, 1);
      }
      
      @keyframes ios-tap {
        0% { transform: translateX(-50%) scale(1); opacity: 1; }
        100% { transform: translateX(-50%) scale(0.96); opacity: 0.8; }
      }
    `;
    document.head.appendChild(iosStyles);
  }

  // Создаем уведомление в стиле iOS - теперь без класса типа
  const notification = document.createElement("div");
  notification.className = "ios-notification"; // Убираем класс типа

  notification.innerHTML = `
    <div class="ios-notification-title">${title}</div>
    <div class="ios-notification-message">${message}</div>
  `;

  notificationsContainer.appendChild(notification);

  // Добавляем обработчик клика для эффекта касания
  notification.addEventListener("click", () => {
    notification.classList.add("ios-tap-animation");
    // Закрываем уведомление при клике быстрее, чем автоматическое закрытие
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 400);
    }, 200);
  });

  // Таймаут для анимации появления (важен для правильной работы CSS-анимации)
  setTimeout(() => {
    notification.classList.add("show");
  }, 10);

  // Автоматическое скрытие уведомления
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => {
      notification.remove();
    }, 400);
  }, duration);
}

// Функция для отображения уведомлений, выбирающая нативный стиль в зависимости от платформы
function showNotification(message, type = "info", duration = 5000) {
  // Показываем только сообщения об ошибках
  if (type !== "error") return;

  console.log(`Показываю уведомление об ошибке: ${message}, isIOS: ${isIOS}`);

  // Если это iOS устройство, используем iOS-стиль уведомлений
  if (isIOS) {
    const title =
      {
        success: "Успешно",
        error: "Ошибка",
        warning: "Внимание",
        info: "Информация",
      }[type] || "Уведомление";

    showIOSNotification(title, message, type, duration);
    return;
  }

  // Оригинальный стиль уведомлений для других платформ
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

// Обновляем данные о WebSocket подключении, чтобы сервер знал, что это iOS устройство
ws.onopen = () => {
  console.log("WebSocket подключение установлено");

  // Определяем тип устройства и отправляем информацию на сервер
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  console.log(
    `Определен тип устройства: ${
      isMobile ? "мобильное" : "десктоп"
    }, iOS: ${isIOS}`
  );

  // Отправляем сообщение о подключении клиента с информацией о типе устройства
  ws.send(
    JSON.stringify({
      type: "clientConnected",
      clientType: "browser",
      deviceType: isMobile ? "mobile" : "desktop",
      isIOS: isIOS,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
    })
  );

  // Отправляем запрос на получение данных
  ws.send(JSON.stringify({ type: "requestData" }));

  // Удаляем уведомление об успешном подключении
  // showNotification("Подключение к системе мониторинга установлено", "success");
};

ws.onerror = (error) => {
  console.error("WebSocket ошибка:", error);
  showNotification("Ошибка подключения к системе мониторинга", "error");
};

ws.onclose = () => {
  console.log("WebSocket соединение закрыто");

  // Показываем уведомление об ошибке, так как это разрыв соединения
  showNotification(
    "Соединение с системой мониторинга прервано. Попытка переподключения...",
    "error"
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
        // Удалено уведомление о предупреждении
        return;
      }

      // Удалено уведомление о начале поиска

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
          // Удалено уведомление об успехе
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

// Обновляем функцию обработки данных системы
function updateSystemInfo(data) {
  if (!data || !data.system) {
    console.error("Некорректные данные для обновления системной информации");
    return;
  }

  const { system, config } = data;
  console.log("Обновление системной информации:", {
    platform: system.os.platform,
    cpuCores: system.os.cpu.count,
    uptime: system.os.uptime,
    processUptime: system.process.uptime,
  });

  // Находим все элементы, которые нужно обновить
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

  // Проверяем наличие каждого элемента перед обновлением
  if (elements.platform && system.os.platform)
    elements.platform.textContent = `${system.os.platform} (${system.os.arch})`;

  if (elements.osRelease && system.os.release)
    elements.osRelease.textContent = system.os.release;

  // Обновляем информацию о процессоре
  if (elements.cpuModel && system.os.cpu) {
    // Устанавливаем краткое название процессора как текст
    elements.cpuModel.textContent = system.os.cpu.model || "Неизвестно";

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

  // Обновляем количество ядер процессора
  if (elements.cpuCores && system.os.cpu && system.os.cpu.count !== undefined) {
    try {
      elements.cpuCores.textContent = `${system.os.cpu.count} ядер`;
      console.log(`Обновлено число ядер: ${system.os.cpu.count}`);
    } catch (error) {
      console.error("Ошибка при обновлении числа ядер:", error);
    }
  } else {
    console.warn("Не удалось обновить число ядер:", {
      elementExists: !!elements.cpuCores,
      cpuDataExists: !!system.os.cpu,
      cpuCountExists: system.os.cpu ? system.os.cpu.count !== undefined : false,
    });
  }

  // Обновляем время работы системы
  if (elements.osUptime && system.os.uptime) {
    try {
      elements.osUptime.textContent = system.os.uptime;
      console.log(`Обновлено время работы системы: ${system.os.uptime}`);
    } catch (error) {
      console.error("Ошибка при обновлении времени работы системы:", error);
    }
  } else {
    console.warn("Не удалось обновить время работы системы:", {
      elementExists: !!elements.osUptime,
      uptimeExists: !!system.os.uptime,
    });
  }

  // Обновляем время работы процесса
  if (elements.processUptime && system.process && system.process.uptime) {
    try {
      elements.processUptime.textContent = system.process.uptime;
      console.log(`Обновлено время работы процесса: ${system.process.uptime}`);
    } catch (error) {
      console.error("Ошибка при обновлении времени работы процесса:", error);
    }
  }

  // Обновляем информацию о конфигурации
  if (elements.port && config && config.port !== undefined)
    elements.port.textContent = config.port;

  if (elements.monitors && config && config.monitors !== undefined)
    elements.monitors.textContent = config.monitors;

  if (elements.debug && config && config.debug !== undefined)
    elements.debug.textContent = config.debug ? "Включен" : "Выключен";
}

// Добавим более частое обновление полных данных для устранения проблемы с отображением
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log("Запрос полных данных системы...");
    ws.send(JSON.stringify({ type: "requestData" }));
  }
}, 10000); // Каждые 10 секунд

// Функция для инициализации подсказок в стиле Apple
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

// Регистрация сервис-воркера для PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((registration) => {
        console.log("Service Worker зарегистрирован:", registration);
      })
      .catch((err) => {
        console.log("Ошибка регистрации Service Worker:", err);
      });
  });
}
