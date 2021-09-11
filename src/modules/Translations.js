const path = require('path');
const I18n = require('op-i18n');
const { ipcMain } = require('electron');

class Translations {
    i18n;
    constructor(options) {
        this.i18n = new I18n(options);
        ipcMain.handle('getTranslation', async (event, translation) => {
            return this.i18n.$t(translation);
        });
    }
}

module.exports = Translations;