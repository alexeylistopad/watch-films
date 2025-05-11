// RAM Widget - Нативный виджет мониторинга памяти
// Версия 2.0

// Настройка подключения к серверу - измените IP-адрес и порт на свои
const API_URL = "http://YOUR_SERVER_IP:PORT/api/monitoring-data";

// Стилевые константы, соответствующие нативным виджетам Apple
const STYLE = {
  bgColor: Color.dynamic(
    new Color("#F5F5F7", 0.85),
    new Color("#1C1C1E", 0.85)
  ),
  textColor: Color.dynamic(new Color("#000000"), new Color("#FFFFFF")),
  dimmedTextColor: Color.dynamic(
    new Color("#000000", 0.5),
    new Color("#FFFFFF", 0.5)
  ),
  tintColor: new Color("#0A84FF"), // Синий
  graphColor: Color.dynamic(
    new Color("#0A84FF", 0.2),
    new Color("#0A84FF", 0.3)
  ),
  fonts: {
    headline: Font.mediumSystemFont(13),
    value: Font.semiboldRoundedSystemFont(20),
    largeValue: Font.semiboldRoundedSystemFont(34),
    caption: Font.regularSystemFont(12),
    small: Font.regularSystemFont(10),
  },
};

// Создаем виджет
const widget = await createWidget();

// Обработка запуска - в виджете или в приложении
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentSmall();
}

Script.complete();

// Основная функция создания виджета
async function createWidget() {
  const w = new ListWidget();
  w.backgroundColor = STYLE.bgColor;
  w.setPadding(16, 16, 16, 16);

  try {
    // Получаем данные с сервера
    const data = await fetchData();

    // Добавляем контент на виджет в зависимости от размера
    if (config.widgetFamily === "large") {
      return createLargeWidget(w, data);
    } else if (config.widgetFamily === "medium") {
      return createMediumWidget(w, data);
    } else {
      return createSmallWidget(w, data);
    }
  } catch (error) {
    return createErrorWidget(w, error.message);
  }
}

// Создание маленького виджета (Apple-style)
function createSmallWidget(widget, data) {
  // Заголовок виджета в стиле Apple
  const titleStack = widget.addStack();
  titleStack.layoutHorizontally();

  const icon = SFSymbol.named("memorychip");
  icon.applyFont(Font.mediumSystemFont(12));
  const iconElement = titleStack.addImage(icon.image);
  iconElement.tintColor = STYLE.dimmedTextColor;
  iconElement.imageSize = new Size(14, 14);

  titleStack.addSpacer(4);

  const title = titleStack.addText("ОЗУ");
  title.textColor = STYLE.dimmedTextColor;
  title.font = STYLE.fonts.headline;

  titleStack.addSpacer();

  widget.addSpacer();

  // Основное значение (большим шрифтом) - теперь в ГБ
  const ramInfo = getRamInfo(data);
  const usedGB = ramInfo.used.toFixed(1);
  const valueText = widget.addText(`${usedGB} ГБ`);
  valueText.textColor = STYLE.textColor;
  valueText.font = STYLE.fonts.largeValue;
  valueText.minimumScaleFactor = 0.5;

  widget.addSpacer(2);

  // Индикатор статуса в стиле Apple (продолжаем использовать процент для определения цвета)
  const statusStack = widget.addStack();
  statusStack.layoutHorizontally();
  statusStack.centerAlignContent();

  const percentage = Math.round(ramInfo.percentage);
  const statusDot = createStatusDot(getRamUsageColor(percentage));
  const statusImage = statusStack.addImage(statusDot);
  statusImage.imageSize = new Size(8, 8);

  statusStack.addSpacer(4);

  // Добавляем показатель общей памяти
  const totalGB = ramInfo.total.toFixed(1);
  const statusText = statusStack.addText(`из ${totalGB} ГБ`);
  statusText.textColor = STYLE.dimmedTextColor;
  statusText.font = STYLE.fonts.small;

  widget.addSpacer();

  // Время обновления в одной строке
  const updatedText = widget.addText(`Обновлено: ${getCurrentTime()}`);
  updatedText.textColor = STYLE.dimmedTextColor;
  updatedText.font = STYLE.fonts.small;

  // Устанавливаем URL действие для открытия скрипта при нажатии
  widget.url = `scriptable:///run/${encodeURIComponent(Script.name())}`;

  return widget;
}

// Средний виджет с графиком (Apple-style)
function createMediumWidget(widget, data) {
  const ramInfo = getRamInfo(data);
  const usedGB = ramInfo.used.toFixed(1);
  const totalGB = ramInfo.total.toFixed(1);
  const percentage = Math.round(ramInfo.percentage);

  // Основная строка с информацией
  const mainStack = widget.addStack();
  mainStack.layoutHorizontally();

  // Левая колонка с заголовком и значением
  const leftColumn = mainStack.addStack();
  leftColumn.layoutVertically();

  // Заголовок
  const titleStack = leftColumn.addStack();
  titleStack.layoutHorizontally();

  const icon = SFSymbol.named("memorychip");
  icon.applyFont(Font.mediumSystemFont(12));
  const iconElement = titleStack.addImage(icon.image);
  iconElement.tintColor = STYLE.dimmedTextColor;
  iconElement.imageSize = new Size(14, 14);

  titleStack.addSpacer(4);

  const title = titleStack.addText("Память");
  title.textColor = STYLE.dimmedTextColor;
  title.font = STYLE.fonts.headline;

  leftColumn.addSpacer(2);

  // Значение использования ОЗУ в ГБ
  const valueStack = leftColumn.addStack();
  valueStack.layoutHorizontally();

  const valueText = valueStack.addText(`${usedGB} ГБ`);
  valueText.textColor = STYLE.textColor;
  valueText.font = STYLE.fonts.largeValue;

  leftColumn.addSpacer(4);

  // Используемая/общая память в ГБ
  const memoryText = leftColumn.addText(`из ${totalGB} ГБ (${percentage}%)`);
  memoryText.textColor = STYLE.dimmedTextColor;
  memoryText.font = STYLE.fonts.caption;

  leftColumn.addSpacer(4);

  // Индикатор статуса
  const statusStack = leftColumn.addStack();
  statusStack.layoutHorizontally();
  statusStack.centerAlignContent();

  const statusDot = createStatusDot(getRamUsageColor(percentage));
  const statusImage = statusStack.addImage(statusDot);
  statusImage.imageSize = new Size(8, 8);

  statusStack.addSpacer(4);

  // Текст состояния
  const status = getRamUsageStatus(percentage);
  const statusText = statusStack.addText(status);
  statusText.textColor = STYLE.dimmedTextColor;
  statusText.font = STYLE.fonts.small;

  mainStack.addSpacer();

  // Добавляем график в стиле Apple
  if (data.ramHistory && data.ramHistory.length > 0) {
    const graphStack = mainStack.addStack();
    graphStack.layoutVertically();
    graphStack.size = new Size(120, 80);

    const chartImage = createAppleStyleChart(
      data.ramHistory,
      120,
      70,
      STYLE.tintColor,
      STYLE.graphColor
    );
    graphStack.addImage(chartImage);

    graphStack.addSpacer(2);

    // Подпись для графика
    const graphLabelStack = graphStack.addStack();
    graphLabelStack.layoutHorizontally();
    graphLabelStack.centerAlignContent();

    graphLabelStack.addSpacer();
    const graphLabel = graphLabelStack.addText("60 мин");
    graphLabel.textColor = STYLE.dimmedTextColor;
    graphLabel.font = STYLE.fonts.caption;
    graphLabel.textOpacity = 0.7;
  }

  widget.addSpacer();

  // Время обновления
  const footerStack = widget.addStack();
  footerStack.layoutHorizontally();

  footerStack.addSpacer();

  const updateText = footerStack.addText(`Обновлено: ${getCurrentTime()}`);
  updateText.textColor = STYLE.dimmedTextColor;
  updateText.font = STYLE.fonts.small;

  // Устанавливаем URL действие для обновления
  widget.url = `scriptable:///run/${encodeURIComponent(Script.name())}`;

  return widget;
}

// Большой виджет (Apple-style)
function createLargeWidget(widget, data) {
  const ramInfo = getRamInfo(data);
  const usedGB = ramInfo.used.toFixed(1);
  const totalGB = ramInfo.total.toFixed(1);
  const percentage = Math.round(ramInfo.percentage);

  // Заголовок
  const titleStack = widget.addStack();
  titleStack.layoutHorizontally();

  const icon = SFSymbol.named("memorychip");
  icon.applyFont(Font.mediumSystemFont(12));
  const iconElement = titleStack.addImage(icon.image);
  iconElement.tintColor = STYLE.dimmedTextColor;
  iconElement.imageSize = new Size(14, 14);

  titleStack.addSpacer(4);

  const title = titleStack.addText("Использование памяти");
  title.textColor = STYLE.dimmedTextColor;
  title.font = STYLE.fonts.headline;

  titleStack.addSpacer();

  widget.addSpacer(16);

  // Использование памяти в ГБ (большим шрифтом)
  const valueText = widget.addText(`${usedGB} ГБ`);
  valueText.textColor = STYLE.textColor;
  valueText.font = Font.semiboldRoundedSystemFont(60);

  widget.addSpacer(4);

  // Информация о доступной/общей памяти в ГБ
  const memoryText = widget.addText(`из ${totalGB} ГБ (${percentage}%)`);
  memoryText.textColor = STYLE.dimmedTextColor;
  memoryText.font = STYLE.fonts.caption;

  widget.addSpacer(8);

  // Индикатор статуса
  const statusStack = widget.addStack();
  statusStack.layoutHorizontally();
  statusStack.centerAlignContent();

  const statusDot = createStatusDot(getRamUsageColor(percentage));
  const statusImage = statusStack.addImage(statusDot);
  statusImage.imageSize = new Size(10, 10);

  statusStack.addSpacer(4);

  // Текст состояния
  const status = getRamUsageStatus(percentage);
  const statusText = statusStack.addText(status);
  statusText.textColor = STYLE.dimmedTextColor;
  statusText.font = STYLE.fonts.caption;

  widget.addSpacer(16);

  // Заголовок для графика
  const graphTitleStack = widget.addStack();
  graphTitleStack.layoutHorizontally();

  const graphIcon = SFSymbol.named("chart.xyaxis.line");
  graphIcon.applyFont(Font.mediumSystemFont(12));
  const graphIconElement = graphTitleStack.addImage(graphIcon.image);
  graphIconElement.tintColor = STYLE.dimmedTextColor;
  graphIconElement.imageSize = new Size(14, 14);

  graphTitleStack.addSpacer(4);

  const graphTitle = graphTitleStack.addText("История использования");
  graphTitle.textColor = STYLE.dimmedTextColor;
  graphTitle.font = STYLE.fonts.headline;

  graphTitleStack.addSpacer();

  widget.addSpacer(8);

  // Добавляем график в стиле Apple
  if (data.ramHistory && data.ramHistory.length > 0) {
    const chartWidth = 320;
    const chartHeight = 120;
    const chartImage = createAppleStyleChart(
      data.ramHistory,
      chartWidth,
      chartHeight,
      STYLE.tintColor,
      STYLE.graphColor,
      true
    );
    widget.addImage(chartImage);

    widget.addSpacer(4);

    // Подписи для графика
    const graphLabelStack = widget.addStack();
    graphLabelStack.layoutHorizontally();

    const leftLabel = graphLabelStack.addText("0 мин");
    leftLabel.textColor = STYLE.dimmedTextColor;
    leftLabel.font = STYLE.fonts.caption;
    leftLabel.textOpacity = 0.7;

    graphLabelStack.addSpacer();

    const rightLabel = graphLabelStack.addText("60 мин");
    rightLabel.textColor = STYLE.dimmedTextColor;
    rightLabel.font = STYLE.fonts.caption;
    rightLabel.textOpacity = 0.7;
  }

  widget.addSpacer();

  // Время обновления
  const footerStack = widget.addStack();
  footerStack.layoutHorizontally();

  footerStack.addSpacer();

  const updateText = footerStack.addText(`Обновлено: ${getCurrentTime()}`);
  updateText.textColor = STYLE.dimmedTextColor;
  updateText.font = STYLE.fonts.small;

  // Устанавливаем URL действие для обновления
  widget.url = `scriptable:///run/${encodeURIComponent(Script.name())}`;

  return widget;
}

// Создание виджета ошибки (Apple-style)
function createErrorWidget(widget, errorMessage) {
  // Заголовок с иконкой ошибки
  const titleStack = widget.addStack();
  titleStack.layoutHorizontally();
  titleStack.centerAlignContent();

  const errorIcon = SFSymbol.named("exclamationmark.triangle");
  errorIcon.applyFont(Font.mediumSystemFont(12));
  const iconElement = titleStack.addImage(errorIcon.image);
  iconElement.tintColor = new Color("#FF3B30");
  iconElement.imageSize = new Size(14, 14);

  titleStack.addSpacer(4);

  const title = titleStack.addText("Ошибка подключения");
  title.textColor = new Color("#FF3B30");
  title.font = STYLE.fonts.headline;

  widget.addSpacer();

  // Сообщение об ошибке
  const messageText = widget.addText(
    "Возможно, вы не дома или сервер отключен"
  );
  messageText.textColor = STYLE.dimmedTextColor;
  messageText.font = STYLE.fonts.caption;
  messageText.centerAlignText();

  widget.addSpacer();

  // Кнопка повторной попытки
  const retryStack = widget.addStack();
  retryStack.layoutHorizontally();
  retryStack.centerAlignContent();

  retryStack.addSpacer();

  const retryIcon = SFSymbol.named("arrow.clockwise");
  retryIcon.applyFont(Font.mediumSystemFont(12));
  const retryIconElement = retryStack.addImage(retryIcon.image);
  retryIconElement.tintColor = STYLE.dimmedTextColor;
  retryIconElement.imageSize = new Size(12, 12);

  retryStack.addSpacer(4);

  const retryText = retryStack.addText("Нажмите для обновления");
  retryText.textColor = STYLE.dimmedTextColor;
  retryText.font = STYLE.fonts.small;

  retryStack.addSpacer();

  // Устанавливаем URL для обновления при нажатии
  widget.url = `scriptable:///run/${encodeURIComponent(Script.name())}`;

  return widget;
}

// Функция получения информации об использовании RAM
function getRamInfo(data) {
  if (!data || !data.memInfo) {
    return {
      used: 0,
      free: 0,
      total: 16,
      percentage: 0,
    };
  }

  const memInfo = data.memInfo;

  let total =
    typeof memInfo.total === "number"
      ? memInfo.total
      : parseFloat(memInfo.total) || 16;
  let used =
    typeof memInfo.used === "number"
      ? memInfo.used
      : parseFloat(memInfo.used) || 0;
  let free =
    typeof memInfo.free === "number"
      ? memInfo.free
      : parseFloat(memInfo.free) || total - used;

  // На случай если free и used не согласованы
  if (free + used > total) {
    free = total - used;
  }

  const percentage = (used / total) * 100;

  return {
    used: used,
    free: free,
    total: total,
    percentage: percentage,
  };
}

// Функция определения цвета в зависимости от использования RAM
function getRamUsageColor(percentage) {
  if (percentage >= 90) {
    return new Color("#FF3B30"); // Красный
  } else if (percentage >= 75) {
    return new Color("#FF3B30"); // Красный (изменено с оранжевого на красный)
  } else {
    return new Color("#34C759"); // Зеленый
  }
}

// Функция определения текстового статуса в зависимости от использования RAM
function getRamUsageStatus(percentage) {
  if (percentage >= 90) {
    return "Критично";
  } else if (percentage >= 75) {
    return "Много";
  } else {
    return "Нормально";
  }
}

// Создание графика в стиле Apple
function createAppleStyleChart(
  data,
  width,
  height,
  lineColor,
  fillColor,
  showLabels = false
) {
  // Нормализуем данные (проценты от 0 до 100)
  const points = data.slice(-60).map((p) => {
    if (typeof p === "string")
      return Math.min(100, Math.max(0, parseFloat(p) || 50));
    if (typeof p === "number" && !isNaN(p))
      return Math.min(100, Math.max(0, p));
    return 50;
  });

  const drawContext = new DrawContext();
  drawContext.size = new Size(width, height);
  drawContext.opaque = false;
  drawContext.respectScreenScale = true;

  // Находим минимальное и максимальное значения (как в CPU-виджете)
  let minValue = Math.min(...points) - 5;
  let maxValue = Math.max(...points) + 5;

  // Обеспечиваем минимальный диапазон для лучшего визуального представления
  if (maxValue - minValue < 15) {
    const mid = (maxValue + minValue) / 2;
    minValue = mid - 10;
    maxValue = mid + 10;
  }

  // Обеспечиваем нижнюю границу
  minValue = Math.max(0, minValue);

  // Обеспечиваем верхнюю границу
  maxValue = Math.min(100, maxValue);

  const range = maxValue - minValue;

  // Функция для преобразования значения в координату Y
  const getY = (value) => {
    return (
      height - (((value - minValue) / range) * height * 0.8 + height * 0.1)
    );
  };

  // Рисуем горизонтальные линии сетки
  if (showLabels) {
    const gridPath = new Path();
    const numLines = 4;

    for (let i = 0; i <= numLines; i++) {
      const y = height * (0.1 + 0.8 * (i / numLines));
      gridPath.move(new Point(0, y));
      gridPath.addLine(new Point(width, y));
    }

    drawContext.addPath(gridPath);
    drawContext.setStrokeColor(
      Color.dynamic(new Color("#CFCFCF"), new Color("#48484A"))
    );
    drawContext.setLineWidth(0.5);
    drawContext.strokePath();
  }

  // Рисуем область под графиком (заливка)
  const fillPath = new Path();

  // Начальная точка в левом нижнем углу
  fillPath.move(new Point(0, height));

  // Добавляем первую точку графика
  fillPath.addLine(new Point(0, getY(points[0])));

  // Создаем сглаженную кривую через все точки
  const step = width / (points.length - 1);
  for (let i = 1; i < points.length; i++) {
    const x = i * step;
    const y = getY(points[i]);

    if (i === 1) {
      fillPath.addLine(new Point(x, y));
    } else {
      const prevX = (i - 1) * step;
      const prevY = getY(points[i - 1]);

      // Контрольные точки для кривой Безье
      const cp1x = prevX + step / 3;
      const cp1y = prevY;
      const cp2x = x - step / 3;
      const cp2y = y;

      fillPath.addCurve(
        new Point(x, y),
        new Point(cp1x, cp1y),
        new Point(cp2x, cp2y)
      );
    }
  }

  // Завершаем контур заливки, добавляя линии вниз и влево
  fillPath.addLine(new Point(width, height));
  fillPath.addLine(new Point(0, height));
  fillPath.closeSubpath();

  // Рисуем заливку
  drawContext.addPath(fillPath);
  drawContext.setFillColor(fillColor);
  drawContext.fillPath();

  // Рисуем линию графика
  const linePath = new Path();

  // Начальная точка
  linePath.move(new Point(0, getY(points[0])));

  // Создаем сглаженную кривую через все точки (как и раньше)
  for (let i = 1; i < points.length; i++) {
    const x = i * step;
    const y = getY(points[i]);

    if (i === 1) {
      linePath.addLine(new Point(x, y));
    } else {
      const prevX = (i - 1) * step;
      const prevY = getY(points[i - 1]);

      const cp1x = prevX + step / 3;
      const cp1y = prevY;
      const cp2x = x - step / 3;
      const cp2y = y;

      linePath.addCurve(
        new Point(x, y),
        new Point(cp1x, cp1y),
        new Point(cp2x, cp2y)
      );
    }
  }

  // Рисуем линию
  drawContext.addPath(linePath);
  drawContext.setStrokeColor(lineColor);
  drawContext.setLineWidth(2);
  drawContext.strokePath();

  return drawContext.getImage();
}

// Создание индикатора статуса
function createStatusDot(color) {
  const size = 12;
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  // Создаем круг
  const path = new Path();
  path.addEllipse(new Rect(1, 1, size - 2, size - 2));
  ctx.addPath(path);
  ctx.setFillColor(color);
  ctx.fillPath();

  return ctx.getImage();
}

// Получение текущего времени
function getCurrentTime() {
  const now = new Date();
  const formatter = new DateFormatter();
  formatter.dateFormat = "HH:mm";
  return formatter.string(now);
}

// Функция для получения данных от сервера
async function fetchData() {
  try {
    // Добавляем случайный параметр для предотвращения кеширования
    const noCacheUrl = `${API_URL}?nocache=${Date.now()}`;

    const request = new Request(noCacheUrl);
    request.timeoutInterval = 20;
    request.headers = {
      "Cache-Control": "no-cache",
      Accept: "application/json",
    };

    const data = await request.loadJSON();

    // Проверка данных
    if (!data || !data.memInfo) {
      throw new Error("Данные недоступны");
    }

    return data;
  } catch (error) {
    console.error(`Ошибка: ${error.message}`);
    throw new Error("Возможно, вы не дома или сервер отключен");
  }
}

// Обработка нажатия на виджет - обновление данных
async function handleWidgetTap() {
  // При нажатии на виджет, запускаем обновление
  try {
    // Создаем новый виджет с актуальными данными
    const newWidget = await createWidget();

    // Обновляем виджет с новыми данными
    Script.setWidget(newWidget);

    // Сообщаем системе, что можно обновить виджет
    Script.complete();

    // Если виджет запущен в приложении, показываем сообщение
    if (!config.runsInWidget) {
      const notification = new Notification();
      notification.title = "RAM Виджет обновлен";
      notification.body = "Данные успешно обновлены";
      notification.schedule();
    }
  } catch (error) {
    console.error("Ошибка при обновлении виджета:", error);
  }
}

// Устанавливаем URL для обработки нажатия
if (config.runsInWidget) {
  // URL для запуска этого же скрипта
  widget.url = `scriptable:///run/${encodeURIComponent(
    Script.name()
  )}?refresh=true`;

  // Устанавливаем время следующего автоматического обновления
  widget.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000); // через 5 минут
}

// Проверяем, был ли скрипт запущен через URL с параметром refresh
const refreshParam = args.queryParameters?.refresh;
if (refreshParam === "true" && !config.runsInWidget) {
  await handleWidgetTap();
}

Script.complete();
