// Mengambil elemen-elemen global
const loadingOverlay = document.getElementById("loading-overlay");
const spinner = loadingOverlay.querySelector(".spinner");
const loadingText = document.getElementById("loading-text");
const progressContainer = document.getElementById("progress-container");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");

// Fungsi untuk menampilkan spinner
export function showSpinner(text = "Memproses...") {
  loadingText.textContent = text;
  spinner.style.display = "block";
  progressContainer.style.display = "none";
  loadingOverlay.classList.add("active");
}

// Fungsi untuk menampilkan progress bar
export function showProgressBar(text = "Mengunggah...") {
  loadingText.textContent = text;
  spinner.style.display = "none";
  progressContainer.style.display = "block";
  updateProgress(0); // Reset progress bar
  loadingOverlay.classList.add("active");
}

// Fungsi untuk memperbarui progress bar
export function updateProgress(percent) {
  progressBar.style.width = percent + "%";
  progressText.textContent = Math.round(percent) + "%";
}

// Fungsi untuk menyembunyikan overlay
export function hideOverlay() {
  loadingOverlay.classList.remove("active");
}
