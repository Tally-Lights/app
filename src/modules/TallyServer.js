var EventEmitter = require('eventemitter3');
const ciao = require("@homebridge/ciao");
var net = require('net');


class TallyServer extends EventEmitter.EventEmitter {
    mdnsAdvertisement;
    sourcesNumber; // Defines how many sources are connected to the switcher
    connectedTallies = {}; // Object of authenticated tallies
    nextTallyID = 0;
    server;

    open() {
        this.server = net.createServer((socket) => {
            socket.setEncoding("utf-8");
            var socketInstance = socket;
            socket.setTimeout(7000, () => {
                socketInstance.destroy();
            });
            socket.on('data', (data) => {
                data = data.replace(/\r?\n|\r/g, "").split(" ");
                if (data[0] == "authenticate") {
                    if (data[1] == "Lt$GS7wMoSPb44&TSm7efyf^Cy9SSPTm" && !(socketInstance.remoteAddress in this.connectedTallies)) { //Known string to authenticate tally
                        this.nextTallyID = this.nextTallyID + 1;
                        socketInstance.id = this.nextTallyID;
                        this.connectedTallies[socketInstance.id] = { // Add tally to object of authenticated tallies
                            tallyID: socketInstance.id,
                            cameraNumber: data[2],
                            batteryPercentage: data[3],
                            isCharging: data[4],
                            wifiStrength: data[5],
                            socket: socketInstance
                        };
                        this.emit("tallyConnected", {
                            tallyID: socketInstance.id,
                            cameraNumber: data[2],
                            batteryPercentage: data[3],
                            isCharging: data[4],
                            wifiStrength: data[5]
                        });
                    }
                } else {
                    if (socketInstance.id in this.connectedTallies) { //Check if tally is authenticated
                        if (data[0] == "telemetry") {
                            this.connectedTallies[socketInstance.id]["cameraNumber"] = data[1];
                            this.connectedTallies[socketInstance.id]["batteryPercentage"] = data[2];
                            this.connectedTallies[socketInstance.id]["isCharging"] = data[3];
                            this.connectedTallies[socketInstance.id]["wifiStrength"] = data[4];
                            console.log({
                                tallyID: socketInstance.id,
                                cameraNumber: this.connectedTallies[socketInstance.id]["cameraNumber"],
                                batteryPercentage: this.connectedTallies[socketInstance.id]["batteryPercentage"],
                                isCharging: this.connectedTallies[socketInstance.id]["isCharging"],
                                wifiStrength: this.connectedTallies[socketInstance.id]["wifiStrength"]
                            });
                            this.emit("tallyTelemetryUpdated", {
                                tallyID: socketInstance.id,
                                cameraNumber: this.connectedTallies[socketInstance.id]["cameraNumber"],
                                batteryPercentage: this.connectedTallies[socketInstance.id]["batteryPercentage"],
                                isCharging: this.connectedTallies[socketInstance.id]["isCharging"],
                                wifiStrength: this.connectedTallies[socketInstance.id]["wifiStrength"]
                            });
                        }
                    }
                }
            });
            socket.on('close', () => {
                delete this.connectedTallies[socketInstance.id];
                this.emit("tallyDisconnected", { tallyID: socketInstance.id });
            });
            socket.on('error', (error) => {
                console.log("Error: " + error);
            });
        });
        this.server.listen(4423, '0.0.0.0');
        
        const responder = ciao.getResponder();
        const service = responder.createService({
            name: "tallyServer",
            type: "tallyServer",
            port: 4423
        });
        service.advertise();
    }
    sendSwitcherUpdate(sourcesNumber, livePreviewSources) {
        this.sourcesNumber = sourcesNumber;
        var finalMessage = sourcesNumber.toString();
        for (const state in livePreviewSources) {
            finalMessage = finalMessage + " " + livePreviewSources[state].length.toString();
            for (const source of livePreviewSources[state]) {
                finalMessage = finalMessage + " " + source.toString();
            }
        }
        this.broadcast("switcherUpdate", finalMessage + " ");
    }
    broadcast(command, message) {
        for (const tally in this.connectedTallies) {
            this.connectedTallies[tally]["socket"].write(command + " " + message + "\n");
        }
    }
}

module.exports = TallyServer;