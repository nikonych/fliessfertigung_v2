// ui/router.js

/**
 * Простая навигация между страницами.
 * Работает как window.location.href = ... но централизованно.
 */
export function navigateTo(pageFileName) {
  window.location.href = pageFileName;
}
