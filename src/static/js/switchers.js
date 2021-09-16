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

  var switcherJS = getSwitcherFilePath(switcherFolderName, switcherConfiguration["jsFile"]);
  ipcRenderer.send("switcherChosen", switcherJS);
  if (switcherConfiguration["mdns"]) {
    ipcRenderer.send("searchNetworkSwitchers");
    document.querySelector("#networkSwitchersList").innerHTML = "";
  } else {
    document.querySelector("#networkSwitchers").style.display = "none";
  }
}

/** Hide the switcher configuration, show the switcher list and eventually disconnect from the current switcher */
function showSwitcherList() {
  document.querySelector("#switcherSelectionContainer").style.display = "";
  document.querySelector("#switcherConfigurationContainer").style.display = "none";
  ipcRenderer.send("deleteSwitcher");
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
ipcRenderer.on("updateNetworkSwitchers", async (event, switcherList) => {
  updateNetworkSwitchers(switcherList);
});

/** Connect button clicked */
function connect() {
  ipcRenderer.send("stopSearchNetworkSwitchers");
  translateElement(document.querySelector("#switcherStatus"), "Connecting");
  document.querySelector("#ipAddress").disabled = true;
  document.querySelector("#connectToSwitcher").disabled = true;
  document.querySelector("#networkSwitchers").style.pointerEvents = "none";
  document.querySelector("#connectToSwitcher").removeEventListener("click", connect);
  document.querySelectorAll("#configurationContainer *").forEach((el) => el.style.color = "var(--buttonBackground)");

  // Send a connect message to the main process, which will actually connect to the switcher
  ipcRenderer.send("switcherConnect", document.querySelector("#ipAddress").value);
}
/** Disconnect button clicked */
function disconnect() {
  ipcRenderer.send("switcherDisconnect");
}
/** Executes once the switcher is connected */
function switcherConnected() {
  translateElement(document.querySelector("#switcherStatus"), "Connected");
  translateElement(document.querySelector("#connectToSwitcher"), "Disconnect");
  document.querySelector("#connectToSwitcher").disabled = false;
  document.querySelector("#connectToSwitcher").removeEventListener("click", connect);
  document.querySelector("#connectToSwitcher").addEventListener("click", disconnect);
  document.querySelectorAll("#configurationContainer *").forEach((el) => el.style.color = "var(--buttonBackground)");
  document.querySelector("#networkSwitchers").style.pointerEvents = "none";
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
  translateElement(document.querySelector("#switcherStatus"), "NotConnected");
  document.querySelector("#switcherInputs").innerHTML = "";
  document.querySelector("#connectToSwitcher").disabled = false;
  document.querySelector("#ipAddress").disabled = false;
  translateElement(document.querySelector("#connectToSwitcher"), "Connect");
  document.querySelector("#connectToSwitcher").removeEventListener("click", disconnect);
  document.querySelector("#connectToSwitcher").addEventListener("click", connect);
  document.querySelector("#networkSwitchers").style.pointerEvents = "";
  document.querySelectorAll("#configurationContainer *").forEach((el) => el.style.color = "");
  if (document.querySelector("#switcherConfigurationContainer").style.display != "none" &&
      document.querySelector("#networkSwitchersList").style.display != "none") {
    ipcRenderer.send("searchNetworkSwitchers");
  }
}
function updateNetworkSwitchers(switcherList) {
  var selected = document.querySelector("[selectedNetworkSwitcher=true]");
  if (selected) selected.getAttribute("ip");
  document.querySelector("#networkSwitchersList").innerHTML = "";
  switcherList.forEach(switcher => {
    var clone = document.querySelector("#networkSwitcherTemplate").content.cloneNode(true);
    clone.querySelector(".networkSwitcher").innerHTML = switcher["name"];
    clone.querySelector(".networkSwitcher").setAttribute("ip", switcher["ip"]);
    clone.querySelector(".networkSwitcher").addEventListener("click", networkSwitcherSelected);
    document.querySelector("#networkSwitchersList").append(clone);
  });
}
function networkSwitcherSelected() {
  document.querySelector("#ipAddress").value = this.getAttribute("ip");
  connect();
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