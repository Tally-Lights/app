const {ipcRenderer} = require('electron');

/** Populate the switcher selection with the switchers present in switchers folder */
function populateSwitcherList() {
  var directories = getSwitcherDirectiories();
  var switcherSelection = document.querySelector('#switcherSelection');

  for (var directory of directories) {
    var switcherInformation = getSwitcherInformation(directory);
    // Clone the switcher template and insert it in the selection div
    var clone = document.querySelector("#switcherTemplate").content.cloneNode(true);
    clone.querySelector(".switcher").setAttribute("switcherFolderName", directory);
    clone.querySelector(".switcherSelectionIcon").setAttribute("src", getSwitcherFilePath(directory, switcherInformation['icon']));
    clone.querySelector(".switcherFriendlyName").innerHTML = switcherInformation['friendlyName'];
    clone.querySelector(".switcher").addEventListener("click", populateSwitcherConfiguration);

    switcherSelection.appendChild(clone);
  }

  showSwitcherList();
}

/** Populate the switcher configuration with the configuration present in switcher folder */
function populateSwitcherConfiguration() {
  document.querySelector("#switcherSelectionContainer").style.display = "none";
  document.querySelector("#switcherConfigurationContainer").style.display = "";

  var switcherFolderName = this.getAttribute("switcherFolderName");
  var switcherConfiguration = getSwitcherInformation(switcherFolderName);
  var switcherIcon = getSwitcherFilePath(switcherFolderName, switcherConfiguration['icon']);
  document.querySelector("#backToSelection").addEventListener("click", showSwitcherList);
  document.querySelector("#selectedSwitcherIcon").setAttribute("src", switcherIcon);
  
  document.querySelector("#connectToSwitcher").setAttribute("switcherFolderName", switcherFolderName);
  document.querySelector("#connectToSwitcher").addEventListener("click", connect);
}

/** Hide the switcher configuration, show the switcher list and eventually disconnect from the current switcher */
function showSwitcherList() {
  document.querySelector("#switcherSelectionContainer").style.display = "";
  document.querySelector("#switcherConfigurationContainer").style.display = "none";
  disconnect();
}

// These functions get called when the main process wants to update the UI
ipcRenderer.on("switcherConnected", async (event) => {
  switcherConnected();
});
ipcRenderer.on("switcherSourcesUpdated", async (event, switcherAllSources, switcherLivePreviewSources) => {
  updateSwitcherSources(switcherAllSources, switcherLivePreviewSources);
});
ipcRenderer.on("switcherTimeout", async (event) => {
  switcherTimeout();
});
ipcRenderer.on("switcherDisconnected", async (event) => {
  switcherDisconnected();
});

/** Connect button clicked */
function connect() {
  translate("Connecting").then((result) => document.querySelector("#switcherStatus").innerHTML = result);
  document.querySelector("#ipAddress").disabled = true;
  document.querySelector("#connectToSwitcher").disabled = true;
  document.querySelector("#connectToSwitcher").removeEventListener("click", connect);

  var switcherFolder = this.getAttribute("switcherFolderName");
  var switcherInformation = getSwitcherInformation(switcherFolder);
  var switcherJS = getSwitcherFilePath(switcherFolder, switcherInformation["jsFile"]);
  // Send a connect message to the main process, which will actually connect to the switcher
  ipcRenderer.send("switcherConnect", switcherJS, document.querySelector("#ipAddress").value);
}
/** Disconnect button clicked */
function disconnect() {
  ipcRenderer.send("switcherDisconnect");
}
/** Executes once the switcher is connected */
function switcherConnected() {
  translate("Connected").then((result) => document.querySelector("#switcherStatus").innerHTML = result);
  translate("Disconnect").then((result) => document.querySelector("#connectToSwitcher").innerHTML = result);
  document.querySelector("#connectToSwitcher").disabled = false;
  document.querySelector("#connectToSwitcher").addEventListener("click", disconnect);
}
/** Updates the list of sources in the switcher panel by deleting and recreating the divs */
function updateSwitcherSources(switcherAllSources, switcherLivePreviewSources) {
  document.querySelector("#switcherInputs").innerHTML = "";
  for (const source of switcherAllSources) {
    var clone = document.querySelector("#switcherSourceTemplate").content.cloneNode(true);
    clone.querySelector(".sourceID").innerHTML = source[0];
    clone.querySelector(".sourceName").innerHTML = source[1];
    if (switcherLivePreviewSources["live"].includes(source[0])) clone.querySelector(".switcherSource").classList.add("liveSource");
    if (switcherLivePreviewSources["preview"].includes(source[0])) clone.querySelector(".switcherSource").classList.add("previewSource");
    document.querySelector("#switcherInputs").appendChild(clone);
  }
}
/** Gets called when the main script is not able to connect to the switcher */
function switcherTimeout() {
  translate("ConnectionFailed").then((result) => alert(result));
}
/** Gets called by the main process once the switcher is acutally disconnected */
function switcherDisconnected() {
  translate("NotConnected").then((result) => document.querySelector("#switcherStatus").innerHTML = result);
  document.querySelector("#switcherInputs").innerHTML = "";
  document.querySelector("#connectToSwitcher").disabled = false;
  document.querySelector("#ipAddress").disabled = false;
  translate("Connect").then((result) => document.querySelector("#connectToSwitcher").innerHTML = result);
  document.querySelector("#connectToSwitcher").removeEventListener("click", disconnect);
  document.querySelector("#connectToSwitcher").addEventListener("click", connect);
}


/** Returns all folders in folder */
function getSwitcherDirectiories() {
  return fs.readdirSync(path.resolve(__dirname, "modules/switchers")).filter(function (file) {
    return fs.statSync(path.resolve(__dirname, "modules/switchers", file)).isDirectory();
  });
}
/** Returns parsed JSON object including data fetched from the switcher's conf file */
function getSwitcherInformation(switcherFolderName) {
  return JSON.parse(getSwitcherFileContent(switcherFolderName, "conf.json"));
}
/** Returns file content in a switcher's folder */
function getSwitcherFileContent(switcherFolderName, fileName) {
  return fs.readFileSync(getSwitcherFilePath(switcherFolderName, fileName));
}
/** Returns full path to switcher file */
function getSwitcherFilePath(switcherFolderName, fileName) {
  return path.resolve(__dirname, "modules/switchers", switcherFolderName, fileName);
}