const { app, BrowserWindow, ipcMain, dialog } = require('electron');
require('hazardous');
const path = require('path');
const TallyConfiguration = require('./modules/TallyConfiguration.js');
const TallyServer = require('./modules/TallyServer.js');
const Translations = require('./modules/Translations.js');
const { autoUpdater } = require("electron-updater");

var Switcher = undefined; // Switcher require
var switcher = undefined; // Switcher object
var switcherConnected = false;
var tallyConfiguration;
var translation;
var tallyServer;

process.traceProcessWarnings = true;

const gotTheLock = app.requestSingleInstanceLock();

translation = new Translations({
  locales: {
    it_IT: {
      name: 'Italiano',
      iso: 'it-IT',
      file: 'it_IT.json'
    },
    en_US: {
      name: 'English',
      iso: 'en-US',
      file: 'en_US.json'
    }
  },
  directory: path.resolve(__dirname, 'static/locales/'),
  defaultLocale: 'it_IT'
});

if (!gotTheLock) {
  dialog.showErrorBox(translation.translate("Error"), translation.translate("MultipleInstancesError"));
  app.quit();
}
else {
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

    mainWindow.on('close', (e) => {
      if (switcherConnected) {
        e.preventDefault();
        dialog.showMessageBox(
          mainWindow,
          {
            type: 'question',
            buttons: [translation.translate("Close"), translation.translate("KeepOpen")],
            title: translation.translate("ConfirmCloseTitle"),
            message: translation.translate("ConfirmClose")
          }
        ).then((choice) => {
          if (choice.response == 0) {
            app.quit();
          }
        });
      }
    });

    if (app.isPackaged) {
      mainWindow.removeMenu();
    }

    // and load the index.html of the app.
    mainWindow.loadFile(path.join(__dirname, 'index.html')).then(() => {
      mainWindow.webContents.send("version", app.getVersion());

      tallyConfiguration = new TallyConfiguration();
      tallyConfiguration.on("tallyConfigurationCounterUpdate", (connectedTallyCounter) => {
        mainWindow.webContents.send("tallyConfigurationCounterUpdate", connectedTallyCounter);
      });
      tallyConfiguration.on("tallyConfigurationWriteSuccessful", () => {
        mainWindow.webContents.send("tallyConfigurationWriteSuccessful");
      });
      tallyConfiguration.updateTallyCounter();

      tallyServer = new TallyServer();
      tallyServer.on("tallyConnected", (tallyDetails) => {
        var livePreviewSources = { "live": [], "preview": [] };
        if (switcherConnected) {
          livePreviewSources = switcher.getLivePreviewSources();
          tallyServer.sendSwitcherUpdate(switcher.getAllSources().length, livePreviewSources);
        }
        else tallyServer.sendSwitcherUpdate(0, livePreviewSources);
        mainWindow.webContents.send("tallyConnected", tallyDetails, livePreviewSources);
      });
      tallyServer.on("tallyTelemetryUpdated", (tallyDetails) => {
        var livePreviewSources = { "live": [], "preview": [] };
        if (switcherConnected) livePreviewSources = switcher.getLivePreviewSources();
        mainWindow.webContents.send("tallyTelemetryUpdated", tallyDetails, livePreviewSources);
      });
      tallyServer.on("tallyDisconnected", (tallyDetails) => {
        mainWindow.webContents.send("tallyDisconnected", tallyDetails);
      });
      tallyServer.open();

      if (app.isPackaged) {
        autoUpdater.on('update-downloaded', () => {
          mainWindow.webContents.send("updateReady");
        });
        autoUpdater.checkForUpdates();
      }
    });

    if (!app.isPackaged) {
      // Open the DevTools
      mainWindow.webContents.openDevTools();
    }
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
  ipcMain.on('switcherChosen', async (event, switcherJS) => {
    Switcher = require(switcherJS);
    switcher = new Switcher();
    switcher.on("updateNetworkSwitchers", (switcherList) => {
      event.sender.send("updateNetworkSwitchers", switcherList);
    });
  });
  ipcMain.on("searchNetworkSwitchers", async () => {
    switcher.searchNetworkSwitchers();
  });
  ipcMain.on("stopSearchNetworkSwitchers", async () => {
    switcher.stopSearchNetworkSwitchers();
  });
  /** Gets called when the renderer wants to connect to the switcher
   * @param switcherJS Path to node module for that switcher
   * @param ipAddress IP address of the switcher
   */
  ipcMain.on('switcherConnect', async (event, ipAddress) => {
    // Handle possible switcher states
    switcher.on('switcherConnected', () => {
      switcherConnected = true;
      var switcherAllSources = switcher.getAllSources();
      var switcherLivePreviewSources = switcher.getLivePreviewSources();

      // Make tallies know about the current switcher state
      tallyServer.sendSwitcherUpdate(switcherAllSources.length, switcherLivePreviewSources);

      // Inform the renderer process that we have connected successfully
      event.sender.send("switcherConnected");
      event.sender.send("switcherSourcesUpdated", switcherAllSources, switcherLivePreviewSources);
    });
    switcher.on('switcherDisconnected', (disconnectCause) => {
      switcherConnected = false;
      // Make tallies know about the current switcher state
      tallyServer.sendSwitcherUpdate(0, { live: [], preview: [] });
      event.sender.send("switcherSourcesUpdated", [], { live: [], preview: [] });
      event.sender.send("switcherDisconnected");
      if (disconnectCause == "timeout") event.sender.send("switcherTimeout");
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
  ipcMain.on('deleteSwitcher', async (event) => {
    if (switcher != undefined) {
      switcher.destroy();
      switcher.removeAllListeners();
      Switcher = undefined;
      switcher = undefined;
    }
  });

  /** TALLY CONFIGURATION **/
  /** Gets called by the renderer once the user wants to update the WiFi configuration on the tally */
  ipcMain.on('sendWifiInformation', async (event, ssid, password) => {
    tallyConfiguration.sendWifiInformation(ssid, password);
  });
}
