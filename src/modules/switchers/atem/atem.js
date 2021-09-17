const { Atem } = require('atem-connection');
var EventEmitter = require('eventemitter3');
const {networkInterfaces} = require('os');
const multicastDns = require('multicast-dns');
const dnsPacket = require('dns-packet')
const dgram = require('dgram');
const { clearInterval } = require('timers');

class AtemConnection extends EventEmitter.EventEmitter {
    atem = undefined;
    sources = undefined;
    disconnectCause = "user";
    reconnectRetries = 0;
    mdnsSearchTimer;
    switchersOnNetwork = [];
    mdns;
    
    constructor() {
        super();
        this.atem = new Atem();
        this.mdns = multicastDns();
        this.mdns.on('response', (pkt) => {
			const allRecords = [...pkt.answers, ...pkt.additionals]
			const answer = allRecords.find((p) => p.type === 'PTR' && p.name === "_blackmagic._tcp.local")
			if (answer) {
                const aRec = allRecords.find((p) => p.type === 'A')
				const txtRec = allRecords.find((p) => p.type === 'TXT')
				if (aRec && txtRec && typeof aRec.data === 'string' && Array.isArray(txtRec.data)) {
                    const lines = txtRec.data.map((r) => r.toString())
					if (lines.find((l) => l === 'class=AtemSwitcher')) {
                        const nameLine = lines.find((l) => l.startsWith('name='))
						var name;
						if (nameLine) {
                            name = nameLine.substr(5)
						} else {
                            name = answer.data.toString()
							if (name.endsWith("_blackmagic._tcp.local")) {
                                name = name.substr(0, name.length - 1 - "_blackmagic._tcp.local".length)
							}
						}
                        if (!this.switchersOnNetwork.some(switcher => switcher.ip == aRec.data)) {
                            name = name.replace("Blackmagic ", "");
                            this.switchersOnNetwork.push({"ip": aRec.data, "name": name});
                            this.emit("updateNetworkSwitchers", this.switchersOnNetwork);
                        }
					}
				}
			}
        });
        
        this.atem.on('connected', () => {
            console.log("Atem connected");
            this.emit("switcherConnected");
        });
        this.atem.on('disconnected', () => {
            console.log("Atem disconnected");
            this.reconnectRetries = 0;
            this.disconnectCause = "user";
            this.emit("switcherDisconnected", this.disconnectCause);
        });
        this.atem.on('info', (event) => {
            console.log(event);
            if (event == "reconnect") { // Connection dropped, so disconnect
                if (this.reconnectRetries > 0) {
                    console.log("Atem timeout");
                    this.disconnectCause = "timeout";
                    this.atem.disconnect();
                } else this.reconnectRetries += 1;
            }
        });
        this.atem.on('error', (error) => {
            console.log(error);
        });
        this.atem.on('stateChanged', (state, pathToChange) => {
            var trackedChanges = new Set([
                'video.mixEffects.0.upstreamKeyers.0.onAir', //Picture-in-picture on/off
                'video.mixEffects.0.upstreamKeyers.0', //Change in picture-in-picture scene
                'video.mixEffects.0.previewInput', // Preview change
                'video.mixEffects.0.programInput', // Program change
            ]);
            for (const source of this.sources) { // Add inputs to tracked changes so we can detect switcher name changes
                trackedChanges.add("inputs." + source[0]);
            }
            var foundChanges = pathToChange.filter(e => trackedChanges.has(e));
            if (foundChanges.length > 0) {
                this.emit("switcherStateChanged", { allSources: this.getAllSources(), livePreviewSources: this.getLivePreviewSources() });
            }
        });
    }

    /** Tries to connect to the switcher */
    connect(ipAddress) {
        this.atem.connect(ipAddress);
    }
    disconnect() {
        this.atem.disconnect();
    }
    destroy() {
        this.mdns.removeAllListeners();
        this.atem.removeAllListeners();
        this.atem.destroy();
        clearInterval(this.mdnsSearchTimer);
    }

    /** Get available sources from the Atem
     * @returns [[1, 'Miha'], [2, 'Pinko']... [ID, FullName]]
     */
    getAllSources() {
        this.sources = Object.entries(this.atem.state.inputs) // Gets all Atem inputs
            .filter((e) => [1, 2, 4, 8, 16].includes(e[1].externalPortType) && e[1].internalPortType == 0) // Filters only the ones which are external (like HDMI) and are actually video inputs (identified by the numbers 1, 2, 4, 8, 16)
            .map((e) => [e[1].inputId, e[1].longName]); // Formats the result in a tidy array
        return this.sources;
    }

    /** Get list of live and preview cameras
     * @returns {live: [1, 3], preview: [2]}
     */
    getLivePreviewSources() {
        return {
            live: Array.from(new Set([
                this.atem.state.video.mixEffects[0].programInput,
                this.atem.state.video.mixEffects[0].transitionPosition.inTransition // Check if we are transitioning between two scenes
                    ? this.atem.state.video.mixEffects[0].previewInput
                    : undefined,
                this.atem.state.video.mixEffects[0].upstreamKeyers[0].onAir // Check if picture-in-picture is activated
                    ? this.atem.state.video.mixEffects[0].upstreamKeyers[0].fillSource
                    : undefined
            ].filter((e) => e != undefined))),
            preview: [this.atem.state.video.mixEffects[0].previewInput]
        }
    }

    searchNetworkSwitchers() {
        this.mdnsSearch();
        this.mdnsSearchTimer = setInterval(this.mdnsSearch, 5000);
    }
    stopSearchNetworkSwitchers() {
        this.mdnsSearchTimer = undefined;
        clearInterval(this.mdnsSearchTimer);
    }
    
    mdnsSearch() {
        var queries = [
            {
                questions: [{
                    name:"_sleep-proxy._udp.local",
                    type:"PTR" },
                    {name:"_bmd_streaming._tcp.local",
                    type:"PTR"}
                ],
                additionals: [{name:".",type:"OPT",udpPayloadSize:1440,flags:4500,options:[{code:4,data: Buffer.from([0,0,48,156,35,71,255,16])}]}]
            },
            {
                questions: [{
                type: "PTR",
                name: "_blackmagic._tcp.local",
                }],
                additionals: [{name:".",type:"OPT",udpPayloadSize:1440,flags:4500,options:[{code:4,data: Buffer.from([0,0,48,156,35,71,255,16])}]}]
            }
        ];
        for (const query in queries) {
            queries[query] = dnsPacket.encode(queries[query]);
        }
        var ipAddresses = Object.values(networkInterfaces()).flat().filter(i => i.family == 'IPv4' && !i.internal).map(j => j.address);
        ipAddresses.forEach((ipAddress) => {
            const socket = dgram.createSocket({
                type: 'udp4',
                reuseAddr: true
            });
            socket.bind(5353, () => {
                socket.setBroadcast(true);
                socket.setMulticastTTL(255);
                socket.setMulticastInterface(ipAddress);
                socket.send(queries[0], 5353, "224.0.0.251", () => {
                    setTimeout(function(){
                        socket.send(queries[1], 5353, "224.0.0.251", () => {
                            socket.close();
                        });
                    }, 500);
                });
            });
        });
    }
}
module.exports = AtemConnection;