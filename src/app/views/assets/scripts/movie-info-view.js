// Селекторы элементов
const elements = {
    background: document.querySelector('.background'),
    content: document.querySelector('.content')
};

// Расчет интервала ротации
const calculateRotationInterval = () => {
    const duration = window.__movieDuration || 120; // Длительность в минутах, по умолчанию 2 часа
    const imagesCount = window.__backdropUrls?.length || 1;
    
    // Распределяем все изображения равномерно на время фильма
    // Минимум 8 секунд, максимум 5 минут на изображение
    const baseInterval = (duration * 60 * 1000) / imagesCount; // Конвертируем минуты в миллисекунды
    return Math.min(Math.max(baseInterval, 8000), 300000);
};

// Параметры
const ROTATION_INTERVAL = calculateRotationInterval();
const FADE_DURATION = 1000;

// Установка фонового изображения
const setBackgroundImage = (url) => {
    if (!url) return;
    console.log('Setting background image:', url);
    
    elements.background.style.opacity = '0';
    
    setTimeout(() => {
        elements.background.style.backgroundImage = `url("${url}")`;
        elements.background.style.opacity = '1';
    }, FADE_DURATION);
};

// Ротация фонов
const startRotation = () => {
    if (!Array.isArray(window.__backdropUrls) || window.__backdropUrls.length <= 1) return;
    
    let currentIndex = 0;
    setInterval(() => {
        currentIndex = (currentIndex + 1) % window.__backdropUrls.length;
        setBackgroundImage(window.__backdropUrls[currentIndex]);
    }, ROTATION_INTERVAL);
};

// Инициализация
const init = () => {
    console.log('Initializing with:', {
        backdropUrls: window.__backdropUrls,
        mainBackdrop: window.__mainBackdrop
    });

    // Показываем контент
    elements.content.style.opacity = '1';

    // Устанавливаем первый фон
    const firstImage = window.__mainBackdrop || (window.__backdropUrls && window.__backdropUrls[0]);
    if (firstImage) {
        setBackgroundImage(firstImage);
        // Запускаем ротацию если есть дополнительные изображения
        if (window.__backdropUrls && window.__backdropUrls.length > 1) {
            setTimeout(startRotation, ROTATION_INTERVAL);
        }
    }
};

// Запуск
init();
