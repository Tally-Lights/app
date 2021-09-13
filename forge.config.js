const token = process.env.SECRET_DEPLOY_TOKEN !== undefined ? process.env.SECRET_DEPLOY_TOKEN : "";

module.exports = {
  publishers: [
    {
      "name": "@electron-forge/publisher-github",
      "config": {
        "repository": {
          "owner": "Tally-lights",
          "name": "app"
        },
        "prerelease": true,
        "authToken": token
      }
    }
  ],
  "makers": [
    {
      "name": "@electron-forge/maker-squirrel",
      "config": {
        "name": "tally-lights",
        "setupIcon": "./src/static/icons/512x512.png",
        "title": "Tally lights"
      }
    },
    {
      "name": "@electron-forge/maker-dmg",
      "config": {
        "icon": "./src/static/icons/512x512.png",
        "name": "Tally lights"
      }
    },
    {
      "name": "@electron-forge/maker-deb",
      "config": {}
    }
  ],
  "packagerConfig": {}
}
