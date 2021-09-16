ipcRenderer.on("tallyConfigurationCounterUpdate", async (event, number) => {
    tallyConfigurationCounterUpdate(number);
});
ipcRenderer.on("tallyConfigurationWriteSuccessfull", async (event) => {
    console.log("Write successfull");
});

/** Gets called when a tally gets connected via USB */
function tallyConfigurationCounterUpdate(connectedTallyCounter) {
    if (connectedTallyCounter > 0) {
        document.querySelector("#updateTallyConfiguration").addEventListener("click", sendWifiInformation);
        document.querySelector("#tallyCounterUsb").style.display = "block";
        document.querySelector("#connectedTalliesCounterUsb").innerHTML = connectedTallyCounter;
    } else {
        document.querySelector("#tallyCounterUsb").style.display = "none";
        document.querySelector("#connectedTalliesCounterUsb").innerHTML = connectedTallyCounter;
    }
}

function sendWifiInformation() {
    var ssid = document.querySelector("#wifiSSID").value;
    var password = document.querySelector("#wifiPassword").value;
    ipcRenderer.send("sendWifiInformation", ssid, password);
}
