const path = require('path');
const I18n = require('op-i18n');
const { ipcMain } = require('electron');

class Translations {
    i18n;
    constructor(options) {
        this.i18n = new I18n(options);
        ipcMain.handle('getTranslation', async (event, text) => {
            return this.translate(text);
        });
        ipcMain.handle('getLanguages', async (event) => {
            return [this.i18n.getNames(), this.i18n.getDefaultName()];
        });
        ipcMain.handle('setDefaultLanguage', async (event, language) => {
            this.i18n.updateDefaultLocaleByName(language);
        });
    }
    translate(text) {
        return this.i18n.$t(text);
    }
}

module.exports = Translations;