const SerialPort = require('serialport');
var usbDetect = require('usb-detection');
var EventEmitter = require('eventemitter3');

class TallyConfiguration extends EventEmitter.EventEmitter {
    /** Start monitoring USB inserts/removals */
    constructor() {
        super();
        var updateTallyCounter = this.updateTallyCounter.bind(this);
        usbDetect.on('add:1027:24577', updateTallyCounter);
        usbDetect.on('remove:1027:24577', updateTallyCounter);
        usbDetect.startMonitoring();
    }

    /** Gets list of connected tallies
     * @returns List of connected tallies with USB specific information (path, VID, PID...)
     */
    getTallyList() {
        return new Promise((resolve) => {
            SerialPort.list().then((devices) => {
                resolve(devices.filter((device) => device.productId == "6001" && device.vendorId == "0403"));
            });
        });
    }

    /** Updates tally counter */
    updateTallyCounter() {
        this.getTallyList().then((connectedTallies) => {
            this.emit("tallyConfigurationCounterUpdate", connectedTallies.length);
        });
    }

    /** Sends WiFi configuration via USB serial port */
    sendWifiInformation(wifiSSID, wifiPassword) {
        this.getTallyList().then((connectedTallies) => {
            connectedTallies.forEach(async (tally) => {
                await new Promise((writeFinished) => {
                    var tallyConnection = new SerialPort(tally.path, {
                        baudRate: 115200
                    });
                    console.log(wifiSSID + "+" + wifiPassword + "\n");
                    tallyConnection.write("wifiConfiguration " + wifiSSID + "+" + wifiPassword + "\n", "utf8", () => {
                        tallyConnection.close();
                        writeFinished();
                    });
                });
            });
            this.emit("tallyConfigurationWriteSuccessful");
        });
    }
}

module.exports = TallyConfiguration;