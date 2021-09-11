const fs = require('fs');
const path = require('path');

populateSwitcherList(); // Populate switcher selection

document.querySelectorAll("[translate]").forEach((element) => {
    var property = element.hasAttribute("translateProperty") ? element.getAttribute("translateProperty") : "innerText";
    ipcRenderer.invoke("getTranslation", element.getAttribute("translate")).then((result) => {
        element[property] = (result != undefined) ? result : element.getAttribute("translate");
    });
});
function translate(text) {
    return ipcRenderer.invoke("getTranslation", text);
}