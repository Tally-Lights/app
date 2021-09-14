const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { disconnect } = require('process');
const TallyConfiguration = require('./modules/tallyConfiguration.js');
const TallyServer = require('./modules/TallyServer.js');
const Translations = require('./modules/Translations.js');

var Switcher = undefined; // Switcher require
var switcher = undefined; // Switcher object
var switcherConnected = false;
var tallyConfiguration;
var translation;
var tallyServer;

process.traceProcessWarnings = true;

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    resizable: false,
    webPreferences: {
      nodeIntegrationInWorker: true,
      contextIsolation: false,
      nodeIntegration: true,
      nativeWindowOpen: true
    },
    icon: path.resolve(__dirname, 'static/icons/512x512.png')
  });

  translation = new Translations({
    locales:
    {
        it_IT:
        {
            name: 'Italiano',
            iso: 'it-IT',
            file: 'it_IT.json'
        },
        en_US:
        {
            name: 'English',
            iso: 'en-US',
            file: 'en_US.json'
        }
    },
    directory: path.resolve(__dirname, 'static/locales/'),
    defaultLocale: 'it_IT'
  });
  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html')).then(() => {
    tallyConfiguration = new TallyConfiguration();
    tallyConfiguration.on("tallyConfigurationCounterUpdate", (connectedTallyCounter) => {
      mainWindow.webContents.send("tallyConfigurationCounterUpdate", connectedTallyCounter);
    });
    tallyConfiguration.on("tallyConfigurationWriteSuccessfull", () => {
      mainWindow.webContents.send("tallyConfigurationWriteSuccessfull");
    });
    tallyConfiguration.updateTallyCounter();

    tallyServer = new TallyServer();
    tallyServer.on("tallyConnected", (tallyDetails) => {
      var livePreviewSources = {"live":[], "preview":[]};
      if (switcherConnected) {
        livePreviewSources = switcher.getLivePreviewSources();
        tallyServer.sendSwitcherUpdate(switcher.getAllSources().length, livePreviewSources);
      }
      else tallyServer.sendSwitcherUpdate(0, livePreviewSources);
      mainWindow.webContents.send("tallyConnected", tallyDetails, livePreviewSources);
    });
    tallyServer.on("tallyTelemetryUpdated", (tallyDetails) => {
      var livePreviewSources = {"live":[], "preview":[]};
      if (switcherConnected) livePreviewSources = switcher.getLivePreviewSources();
      mainWindow.webContents.send("tallyTelemetryUpdated", tallyDetails, livePreviewSources);
    });
    tallyServer.on("tallyDisconnected", (tallyDetails) => {
      mainWindow.webContents.send("tallyDisconnected", tallyDetails);
    });
    tallyServer.open();
  });

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

/** SWITCHER **/
/** Gets called when the renderer wants to connect to the switcher
 * @param switcherJS Path to node module for that switcher
 * @param ipAddress IP address of the switcher
 */
ipcMain.on('switcherConnect', async (event, switcherJS, ipAddress) => {
  Switcher = require(switcherJS);
  switcher = new Switcher();

  // Handle possible switcher states
  switcher.once('switcherConnected', () => {
    switcherConnected = true;
    var switcherAllSources = switcher.getAllSources();
    var switcherLivePreviewSources = switcher.getLivePreviewSources();

    // Make tallies know about the current switcher state
    tallyServer.sendSwitcherUpdate(switcherAllSources.length, switcherLivePreviewSources);
    
    // Inform the renderer process that we have connected successfully
    event.sender.send("switcherConnected");
    event.sender.send("switcherSourcesUpdated", switcherAllSources, switcherLivePreviewSources);
  });
  switcher.once('switcherDisconnected', (disconnectCause) => {
    switcherConnected = false;
    // Make tallies know about the current switcher state
    tallyServer.sendSwitcherUpdate(0, {live:[], preview:[]});
    event.sender.send("switcherSourcesUpdated", [], {live:[], preview:[]});
    event.sender.send("switcherDisconnected");
    if (disconnectCause == "timeout") event.sender.send("switcherTimeout");
    switcher.removeAllListeners();
    Switcher = undefined;
    switcher = undefined;
  });
  switcher.on('switcherStateChanged', (switcherData) => {
    console.log(switcherData);
    tallyServer.sendSwitcherUpdate(switcherData["allSources"].length, switcherData["livePreviewSources"]); // Make tallies know about the update
    event.sender.send("switcherSourcesUpdated", switcherData["allSources"], switcherData["livePreviewSources"]);
  });

  // Calls the connect method of the switcher and wait for the promise to finish
  switcher.connect(ipAddress);
});

/** Gets called by the renderer once the user wants to disconnect from the switcher */
ipcMain.on('switcherDisconnect', async (event) => {
  // Check if we are actually connected to the switcher before disconnecting
  if (switcher != undefined) {
    switcher.disconnect();
  }
});

/** TALLY CONFIGURATION **/
/** Gets called by the renderer once the user wants to update the WiFi configuration on the tally */
ipcMain.on('sendWifiInformation', async (event, ssid, password) => {
  tallyConfiguration.sendWifiInformation(ssid, password);
});