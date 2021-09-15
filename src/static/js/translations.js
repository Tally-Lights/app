document.querySelector("#languageSwitcher").onchange = function() {
    ipcRenderer.invoke("setDefaultLanguage", this.options[this.selectedIndex].text).then(() => {
        localizeHTML();
    });
};

function localizeHTML() {
    document.querySelectorAll("[translate]").forEach((element) => {
        translateElement(element);
    });
}

function populateLanguages() {
    ipcRenderer.invoke("getLanguages").then((result) => {
        var languageSwitcher = document.querySelector("#languageSwitcher");
        languageSwitcher.innerHTML = "";
        result[0].forEach((language) => {
            var option = document.createElement("option");
            option.text = language;
            if (language == result[1]) option.selected = true;
            languageSwitcher.add(option);
        });
    });
}

function translateElement(element, newID = null) {
    var property = element.hasAttribute("translateProperty") ? element.getAttribute("translateProperty") : "innerText";
    if (newID != null) element.setAttribute("translate", newID);
    ipcRenderer.invoke("getTranslation", element.getAttribute("translate")).then((result) => {
        element[property] = (result != undefined) ? result : element.getAttribute("translate");
    });
}

function translate(id) {
    return ipcRenderer.invoke("getTranslation", id);
}