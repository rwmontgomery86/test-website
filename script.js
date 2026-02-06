const toggleButton = document.querySelector(".menu-toggle");
const nav = document.querySelector(".main-nav");
const themeToggle = document.querySelector(".theme-toggle");
const root = document.documentElement;
const THEME_STORAGE_KEY = "novasight-theme";

if (toggleButton && nav) {
  toggleButton.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggleButton.setAttribute("aria-expanded", String(isOpen));
  });
}

function setTheme(theme) {
  root.setAttribute("data-theme", theme);

  if (themeToggle) {
    const nextTheme = theme === "dark" ? "light" : "dark";
    const label = nextTheme === "dark" ? "Dark Mode" : "Light Mode";
    themeToggle.textContent = label;
    themeToggle.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
  }
}

function getInitialTheme() {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }
  } catch (error) {
    return "light";
  }

  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

setTheme(getInitialTheme());

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const currentTheme = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    setTheme(nextTheme);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (error) {
      // Ignore storage issues (private mode or disabled storage).
    }
  });
}
