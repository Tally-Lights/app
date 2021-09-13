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
        "name": "Tally lights"
      }
    },
    {
      "name": "@electron-forge/maker-zip",
      "platforms": [
        "darwin"
      ]
    },
    {
      "name": "@electron-forge/maker-deb",
      "config": {}
    },
    {
      "name": "@electron-forge/maker-rpm",
      "config": {}
    }
  ],
  "packagerConfig": {}
}
