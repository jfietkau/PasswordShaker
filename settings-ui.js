document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  document.getElementById("loadButton").addEventListener("click", loadSettings);
  document.getElementById("saveButton").addEventListener("click", saveSettings);
  document.getElementById("wipeButton").addEventListener("click", clearSettings);
  document.getElementById("showButton").addEventListener("click", debug_showSettings);
});