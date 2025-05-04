const browsers = [];

async function openMovieInBrowser(movieId) {
  console.log(`Открытие фильма с ID: ${movieId}`);
}

async function openMovieInfoInBrowser(movieData, backdropUrlList) {
  console.log(
    `Открытие информации о фильме: ${movieData.name}, изображения: ${backdropUrlList}`
  );
}

async function changeVolume(type) {
  console.log(`Изменение громкости: ${type}`);
}

async function closeAllBrowsers() {
  console.log("Закрытие всех браузеров");
}

async function playPauseButton() {
  console.log("Нажатие кнопки воспроизведения/паузы");
}

module.exports = {
  browsers,
  openMovieInBrowser,
  openMovieInfoInBrowser,
  changeVolume,
  closeAllBrowsers,
  playPauseButton,
};
