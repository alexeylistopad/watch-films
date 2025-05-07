const express = require('express');
const router = express.Router();
const hardwareMonitorService = require('../services/hardware-monitor-service');

// Middleware для обработки входа на страницу Home
router.use((req, res, next) => {
  // Запоминаем текущий URL для отслеживания покидания страницы Home
  req.session.previousUrl = req.session.currentUrl || '';
  req.session.currentUrl = req.originalUrl;
  
  // Определяем, является ли текущий URL страницей Home
  const isHomePage = req.originalUrl === '/' || req.originalUrl.startsWith('/home');
  
  // Если переходим на страницу Home впервые
  if (isHomePage && !req.session.previousUrl.startsWith('/home') && req.session.previousUrl !== '/') {
    console.log('Пользователь открыл страницу Home');
    hardwareMonitorService.handleHomeOpen();
  }
  
  // Если покидаем страницу Home
  if (!isHomePage && (req.session.previousUrl === '/' || req.session.previousUrl.startsWith('/home'))) {
    console.log('Пользователь покинул страницу Home');
    hardwareMonitorService.handleHomeClose();
  }
  
  next();
});

// Роут для главной страницы
router.get('/', (req, res) => {
  // Запускаем мониторинг при открытии страницы
  hardwareMonitorService.handleHomeOpen();
  
  // Рендеринг страницы Home
  res.render('home', { title: 'Главная страница' });
});

module.exports = router;
