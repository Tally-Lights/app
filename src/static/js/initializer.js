const fs = require('fs');
const path = require('path');

populateSwitcherList(); // Populate switcher selection
populateLanguages(); // Populate language switcher
localizeHTML(); // Translate whole page

ipcRenderer.on("updateReady", async (event) => {
  translate("updateReady").then((result) => alert(result));
});
ipcRenderer.on("version", async (event, version) => {
  document.querySelector("#version").innerHTML = version;
});