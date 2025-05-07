// Класс для работы с мониторингом оборудования через WebSocket
class HardwareMonitor {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
  }
  
  // Инициализация WebSocket соединения
  init() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('WebSocket соединение установлено');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Отображаем интерфейс мониторинга
      document.getElementById('hardware-monitor').style.display = 'block';
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.updateUI(data);
      } catch (error) {
        console.error('Ошибка при обработке данных WebSocket:', error);
      }
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket соединение закрыто');
      this.isConnected = false;
      
      // Пытаемся переподключиться, если страница всё еще активна
      if (document.visibilityState === 'visible' && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        this.reconnectTimeout = setTimeout(() => {
          console.log(`Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
          this.init();
        }, 2000);
      } else {
        // Скрываем интерфейс мониторинга при закрытии соединения
        document.getElementById('hardware-monitor').style.display = 'none';
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('Ошибка WebSocket:', error);
    };
    
    // Обработчик видимости страницы
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.close();
      } else if (document.visibilityState === 'visible' && !this.isConnected) {
        this.init();
      }
    });
    
    // Обработчик закрытия страницы
    window.addEventListener('beforeunload', () => {
      this.close();
    });
  }
  
  // Обновление пользовательского интерфейса
  updateUI(data) {
    if (data.cpuTemp) {
      document.getElementById('cpu-temp').textContent = `${data.cpuTemp}°C`;
    } else {
      document.getElementById('cpu-temp').textContent = 'Н/Д';
    }
    
    if (data.memInfo) {
      const { total, used, free } = data.memInfo;
      document.getElementById('mem-total').textContent = `${total.toFixed(1)} GB`;
      document.getElementById('mem-used').textContent = `${used.toFixed(1)} GB`;
      document.getElementById('mem-free').textContent = `${free.toFixed(1)} GB`;
      
      // Обновляем прогресс-бар использования памяти
      const percentUsed = (used / total) * 100;
      document.getElementById('mem-progress').style.width = `${percentUsed}%`;
    } else {
      document.getElementById('mem-total').textContent = 'Н/Д';
      document.getElementById('mem-used').textContent = 'Н/Д';
      document.getElementById('mem-free').textContent = 'Н/Д';
    }
  }
  
  // Закрытие соединения
  close() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    if (this.ws && this.isConnected) {
      this.ws.close();
      this.isConnected = false;
    }
  }
}

// Инициализация мониторинга при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  // Проверяем, находимся ли мы на странице Home
  if (window.location.pathname === '/' || window.location.pathname.startsWith('/home')) {
    const hardwareMonitor = new HardwareMonitor();
    hardwareMonitor.init();
    
    // Сохраняем экземпляр в глобальной переменной для возможного доступа из консоли
    window.hardwareMonitor = hardwareMonitor;
  }
});
