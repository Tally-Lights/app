const { Atem } = require('atem-connection');
var EventEmitter = require('eventemitter3');

class AtemConnection extends EventEmitter.EventEmitter {
    atem = undefined;
    sources = undefined;
    disconnectCause = "user";
    reconnectRetries = 0;

    constructor() {
        super();
        this.atem = new Atem();
        this.atem.once('connected', () => {
            console.log("Atem connected");
            this.emit("switcherConnected");
        });
        this.atem.once('disconnected', () => {
            console.log("Atem disconnected");
            this.atem.removeAllListeners();
            this.atem.destroy();
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
                trackedChanges.add("inputs."+source[0]);
            }
            var foundChanges = pathToChange.filter(e => trackedChanges.has(e));
            if (foundChanges.length > 0) {
                this.emit("switcherStateChanged", {allSources: this.getAllSources(), livePreviewSources: this.getLivePreviewSources()});
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
}
module.exports = AtemConnection;