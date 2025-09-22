// Menunggu hingga seluruh halaman selesai dimuat sebelum menjalankan skrip apapun
document.addEventListener("DOMContentLoaded", function () {
  // Panggil semua fungsi inisialisasi fitur
  initSmoothScroll();
  initLightbox();
  initModal();
  initLiveEventHighlight();
  initScrollAnimation();
  initGalleryFilter();
  initHamburgerMenu();
});

// --- FUNGSI UNTUK SMOOTH SCROLL ---
function initSmoothScroll() {
  const navLinks = document.querySelectorAll('.nav a[href^="#"]');
  navLinks.forEach((link) => {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      const targetId = this.getAttribute("href").substring(1);
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

// --- FUNGSI UNTUK LIGHTBOX ---
function initLightbox() {
  const galleryItems = document.querySelectorAll(".gallery-item");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const closeBtn = document.querySelector(".close-button");

  if (!lightbox) return; // Keluar jika elemen tidak ada

  galleryItems.forEach((item) => {
    item.addEventListener("click", () => {
      const imgSrc = item.querySelector("img").src;
      lightboxImg.src = imgSrc;
      lightbox.classList.add("active");
    });
  });

  const closeLightbox = () => lightbox.classList.remove("active");
  closeBtn.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
}

// --- FUNGSI UNTUK MODAL ---
function initModal() {
  const openModalButtons = document.querySelectorAll(".cta-button");
  const modal = document.getElementById("join-modal");
  const closeModalButton = document.querySelector(".close-modal-button");

  if (!modal) return; // Keluar jika elemen tidak ada

  const openModal = () => modal.classList.add("active");
  const closeModal = () => modal.classList.remove("active");

  openModalButtons.forEach((button) => {
    if (!button.classList.contains("modal-button")) {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        openModal();
      });
    }
  });

  closeModalButton.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
}

// --- FUNGSI UNTUK LIVE EVENT ---
// GANTI FUNGSI LAMA INI DI FILE script.js ANDA DENGAN VERSI BARU INI
function initLiveEventHighlight() {
  const eventCards = document.querySelectorAll(".event-card");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const monthMap = {
    januari: 0,
    februari: 1,
    maret: 2,
    april: 3,
    mei: 4,
    juni: 5,
    juli: 6,
    agustus: 7,
    september: 8,
    oktober: 9,
    november: 10,
    desember: 11,
  };

  eventCards.forEach((card) => {
    const dateElement = card.querySelector(".event-date");
    if (!dateElement) return;

    const dateText = dateElement.textContent.toLowerCase();

    // Pola Regex untuk mendeteksi format tanggal LENGKAP DENGAN JAM
    const dateTimeRegex =
      /(\d{1,2})\s(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s(\d{4}).*?(\d{2}):(\d{2})/;

    // Pola Regex untuk mendeteksi format HANYA TANGGAL
    const dateOnlyRegex =
      /(\d{1,2})\s(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s(\d{4})/;

    const dateTimeParts = dateText.match(dateTimeRegex);
    const dateOnlyParts = dateText.match(dateOnlyRegex);

    // KONDISI 1: Cek apakah formatnya LENGKAP DENGAN JAM (lebih spesifik)
    if (dateTimeParts) {
      const eventStartDate = new Date(
        parseInt(dateTimeParts[3], 10),
        monthMap[dateTimeParts[2]],
        parseInt(dateTimeParts[1], 10),
        parseInt(dateTimeParts[4], 10),
        parseInt(dateTimeParts[5], 10)
      );
      const eventEndDate = new Date(
        eventStartDate.getTime() + 3 * 60 * 60 * 1000
      );
      const oneHourBefore = new Date(eventStartDate.getTime() - 60 * 60 * 1000);

      if (now >= oneHourBefore && now <= eventEndDate) {
        card.classList.add("live-event");
        const badge = document.createElement("div");
        badge.className = "live-badge";
        badge.textContent = now < eventStartDate ? "Segera" : "LIVE";
        card.style.position = "relative";
        card.appendChild(badge);
      }
    }
    // KONDISI 2: Jika tidak, cek apakah formatnya HANYA TANGGAL
    else if (dateOnlyParts) {
      const day = parseInt(dateOnlyParts[1], 10);
      const month = monthMap[dateOnlyParts[2]];
      const year = parseInt(dateOnlyParts[3], 10);

      const deadlineDate = new Date(year, month, day, 23, 59, 59);

      if (today <= deadlineDate) {
        card.classList.add("ongoing-event");
        const badge = document.createElement("div");
        badge.className = "ongoing-badge";
        badge.textContent = "On-Going";
        card.style.position = "relative";
        card.appendChild(badge);
      }
    }
  });
}

// --- FUNGSI UNTUK SCROLL ANIMATION ---
function initScrollAnimation() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.remove("hidden-on-scroll");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  const hiddenElements = document.querySelectorAll(
    ".feature-card, .gallery-item, .event-card, .testimonial-card, .footer-column"
  );
  hiddenElements.forEach((el) => {
    el.classList.add("hidden-on-scroll");
    observer.observe(el);
  });
}

// --- FUNGSI UNTUK FILTER GALERI ---
function initGalleryFilter() {
  const filterButtons = document.querySelectorAll(".filter-btn");
  const galleryItems = document.querySelectorAll(".gallery-item");
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      const filterValue = button.getAttribute("data-filter");
      galleryItems.forEach((item) => {
        const itemCategory = item.getAttribute("data-category");
        if (filterValue === "all" || itemCategory === filterValue) {
          item.classList.remove("hide");
        } else {
          item.classList.add("hide");
        }
      });
    });
  });
}

// --- FUNGSI UNTUK MENU HAMBURGER ---
function initHamburgerMenu() {
  const hamburger = document.querySelector(".hamburger");
  const navMenu = document.querySelector(".nav");
  hamburger.addEventListener("click", () => {
    hamburger.classList.toggle("active");
    navMenu.classList.toggle("active");
  });
  document.querySelectorAll(".nav a").forEach((link) => {
    link.addEventListener("click", () => {
      hamburger.classList.remove("active");
      navMenu.classList.remove("active");
    });
  });
}
