document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  document.getElementById("loadButton").addEventListener("click", loadSettings);
  document.getElementById("saveButton").addEventListener("click", saveSettings);
});