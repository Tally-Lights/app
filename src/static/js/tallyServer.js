ipcRenderer.on("tallyConnected", async (event, tallyDetails, livePreviewSources) => {
    tallyConnected(tallyDetails, livePreviewSources);
});
ipcRenderer.on("tallyTelemetryUpdated", async (event, tallyDetails, livePreviewSources) => {
    var tally = document.querySelector('[tallyID="' + tallyDetails["tallyID"] + '"]');
    updateTallyTelemetry(tally, tallyDetails, livePreviewSources);
});
ipcRenderer.on("switcherSourcesUpdated", async (event, switcherAllSources, switcherLivePreviewSources) => {
    updateTalliesSwitcherStatus(switcherLivePreviewSources);
});
ipcRenderer.on("tallyDisconnected", async (event, tallyDetails) => {
    tallyDisconnected(tallyDetails);
});

/** Clone the tally template and insert it in the connected tallies div */
function tallyConnected(tallyDetails, livePreviewSources) {
    var clone = document.querySelector("#tallyTemplate").content.cloneNode(true);
    clone.querySelector(".tally").setAttribute("tallyID", tallyDetails["tallyID"]);
    clone.querySelector(".cameraNumber").innerHTML = tallyDetails["cameraNumber"];
    updateTallySwitcherStatus(clone.querySelector(".tally"), livePreviewSources);
    updateTallyTelemetry(clone.querySelector(".tally"), tallyDetails);
    document.querySelector("#connectedTallies").append(clone);
}

/** Updates colors of every tally */
function updateTalliesSwitcherStatus(livePreviewSources) {
    document.querySelectorAll("#connectedTallies .tally").forEach(tally => {
        updateTallySwitcherStatus(tally, livePreviewSources);
    });
}
/** Update tally color */
function updateTallySwitcherStatus(tally, livePreviewSources) {
    var tallyCameraNumberElement = tally.querySelector(".cameraNumber");
    var tallyCameraNumber = parseInt(tallyCameraNumberElement.innerHTML, 10);
    tallyCameraNumberElement.classList.remove("liveSource", "previewSource");
    if (livePreviewSources["live"].includes(tallyCameraNumber)) {
        tallyCameraNumberElement.classList.add("liveSource");
    }
    if (livePreviewSources["preview"].includes(tallyCameraNumber)) {
        tallyCameraNumberElement.classList.add("previewSource");
    }
}

/** Update telemetry of a tally */
function updateTallyTelemetry(tally, tallyTelemetry, livePreviewSources) {
    if (tally.querySelector(".cameraNumber").innerHTML != tallyTelemetry["cameraNumber"]) {
        tally.querySelector(".cameraNumber").innerHTML = tallyTelemetry["cameraNumber"];
        updateTallySwitcherStatus(tally, livePreviewSources);
    }
    tally.querySelector(".batteryPercentage").innerHTML = tallyTelemetry["batteryPercentage"];
    if (tallyTelemetry["isCharging"]== 1) tally.querySelector(".charging").style.display = "block";
    else tally.querySelector(".charging").style.display = "none";
    tally.querySelector(".batteryLevel").style.width = (0 + (25 - 0) * (parseInt(tallyTelemetry["batteryPercentage"],10) - 0) / (100 - 0)).toString() + "px";
    switch (parseInt(tallyTelemetry["wifiStrength"], 10)) {
        case 1:
            translateElement(tally.querySelector(".tallyWiFiStrength"), "Weak");
            break;
        case 2:
            translateElement(tally.querySelector(".tallyWiFiStrength"), "Good");
            break;
    }
}

/** Remove tally from tallies list */
function tallyDisconnected(tallyDetails) {
    var tally = document.querySelector('[tallyID="' + tallyDetails["tallyID"] + '"]');
    tally.remove();
}