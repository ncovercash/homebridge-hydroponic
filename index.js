const GrowLightAccessory = require("./lib/GrowLightAccessory");

const PLATFORM_NAME = "Hydroponic";

let hap, Accessory; // needed later

module.exports = (homebridge) => {
    hap = homebridge.hap;
    Accessory = homebridge.platformAccessory;

    homebridge.registerPlatform("Hydroponic", HomebridgeHyrdoponic);
};

class HomebridgeHyrdoponic {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;

        this.growLightId = this.config.id;
        this.growLightKey = this.config.key;
        this.name = this.config.name;

        this.log.info("Finished setting up Hydroponic platform ("+this.name+")");
    }

    accessories(callback) {
        callback([
            new GrowLightAccessory(hap, this.log, this, this.growLightId, this.growLightKey, this.name)
        ]);
    }
}
