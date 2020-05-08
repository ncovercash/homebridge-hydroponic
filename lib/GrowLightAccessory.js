const fork = require("child_process").fork;

class GrowLightAccessory {
    constructor(hap, log, parent, id, key, name) {
        this.hap = hap;
        this.log = log;
        this.parent = parent;
        this.id = id;
        this.key = key;
        this.name = name;

        this.currentData = {
            "brightness": 100, // Brightness (25,50,75.1,100)
            "veg": false, // If veg is on (VEG | FULL)
            "bloom": false, // If bloom is on (BLOOM | FULL)
            "humidity": 0, // Humidity (%)
            "temperature": 0, // Temperature (ºC)
            "connected": false
        };

        this.setupListener();

        this.services = {};

        this.services._metadata = new this.hap.Service.AccessoryInformation()
            .setCharacteristic(this.hap.Characteristic.Manufacturer, "myLumii")
            .setCharacteristic(this.hap.Characteristic.Model, "A1909"); // only one they sell?

        this.services.vegLight = new this.hap.Service.Lightbulb(this.name + " Veg", "veg");
        this.services.bloomLight = new this.hap.Service.Lightbulb(this.name + " Bloom", "bloom");
        this.services.humiditySensor = new this.hap.Service.HumiditySensor(this.name + " Humidity");
        this.services.temperatureSensor = new this.hap.Service.TemperatureSensor(this.name + " Temperature");

        this.log.info("Created services for " + this.name);

        this.initializeCharacteristics();
    }

    setupListener() {
        this.log.info("Setting up listener thread for grow light");

        if (!this.lastListenerFail) {
            this.lastListenerFail = 0;
        }
        this.listener = fork(__dirname+"/GrowLightListener.js", [this.id, this.key, "--unhandled-rejections=strict"]);
        this.listener.on("message", (data) => {
            this.log.info("Got info from child: " + JSON.stringify(data));
            switch (data.type) {
                case "info":
                case "warn":
                case "error":
                    this.log[data.type](data.message);
                    break;
                case "newData":
                    this.currentData = data.message;
                    this.syncDataAndCharacteristics();
                    break;
                case "connection":
                    this.currentData.connected = data.message;
                    break;
                default:
                    this.log.warn("Unknown message from listener process");
            }
        });

        this.listener.on("exit", (code) => {
            this.log.error("Listener exited with code "+code);
            this.currentData.connected = false;
            if (new Date().getTime() < this.lastListenerFail + 10000) {
                this.log.error("Listener exited twice within 10 seconds.  Waiting 10 more to restart");
                setTimeout(() => {
                    this.log.info("Restarting listener...");
                    this.lastListenerFail = new Date().getTime();
                    this.setupListener();
                }, 10000);
                return;
            }
            if (code == null) {
                this.log.error("Seems homebridge as a whole is shutting down...");
                return;
            }
            this.log.info("Restarting listener...");
            this.lastListenerFail = new Date().getTime();
            this.setupListener();
        })
    }

    initializeCharacteristics() {
        this.characteristics = {};

        this.characteristics.vegOn = this.services.vegLight.getCharacteristic(this.hap.Characteristic.On);
        this.characteristics.vegOn.on("get", callback => callback(this.shouldConnectionError(), this.currentData.veg));
        this.characteristics.vegOn.on("set", (value, callback) => {
            this.setVeg(value);
            callback(this.shouldConnectionError());
        });

        this.characteristics.vegBrightness = this.services.vegLight.getCharacteristic(this.hap.Characteristic.Brightness);
        this.characteristics.vegBrightness.on("get", callback => callback(this.shouldConnectionError(), this.currentData.brightness));
        this.characteristics.vegBrightness.on("set", (value, callback) => {
            if (this._roundBrightness(value) == 0) {
                this.setVeg(false);
            } else {
                this.setBrightness(this._roundBrightness(value));
            }
            callback(this.shouldConnectionError());
        });
        this.characteristics.vegBrightness.setProps({minStep: 25});

        this.characteristics.bloomOn = this.services.bloomLight.getCharacteristic(this.hap.Characteristic.On);
        this.characteristics.bloomOn.on("get", callback => callback(this.shouldConnectionError(), this.currentData.bloom));
        this.characteristics.bloomOn.on("set", (value, callback) => {
            this.setBloom(value);
            callback(this.shouldConnectionError());
        });

        this.characteristics.bloomBrightness = this.services.bloomLight.getCharacteristic(this.hap.Characteristic.Brightness);
        this.characteristics.bloomBrightness.on("get", callback => callback(this.shouldConnectionError(), this.currentData.brightness));
        this.characteristics.bloomBrightness.on("set", (value, callback) => {
            if (this._roundBrightness(value) == 0) {
                this.setBloom(false);
            } else {
                this.setBrightness(this._roundBrightness(value));
            }
            callback(this.shouldConnectionError());
        });
        this.characteristics.bloomBrightness.setProps({minStep: 25});

        this.characteristics.humidity = this.services.humiditySensor.getCharacteristic(this.hap.Characteristic.CurrentRelativeHumidity);
        this.characteristics.humidity.on("get", callback => callback(this.shouldConnectionError(), this.currentData.humidity));

        this.characteristics.temperature = this.services.temperatureSensor.getCharacteristic(this.hap.Characteristic.CurrentTemperature);
        this.characteristics.temperature.on("get", callback => callback(this.shouldConnectionError(), this.currentData.temperature));

        this.syncDataAndCharacteristics();

        this.log.info("Initialized characteristics for " + this.name);
    }

    shouldConnectionError() {
        if (!this.currentData.connected) {
            this.log.warn("Returning no response");
            return new Error("Device not connected");
        }
        return null;
    }

    syncDataAndCharacteristics() {
        this.characteristics.vegOn.updateValue(this.currentData.veg);
        this.characteristics.bloomOn.updateValue(this.currentData.bloom);

        this.characteristics.vegBrightness.updateValue(this.currentData.brightness);
        this.characteristics.bloomBrightness.updateValue(this.currentData.brightness);

        this.characteristics.humidity.updateValue(this.currentData.humidity);
        this.characteristics.temperature.updateValue(this.currentData.temperature);
    }

    identify() {
        this.setVeg(true);
        this.setBloom(true);
    }

    setVeg(value) {
        this.listener.send({
            "type": "set",
            "key": "veg",
            "value": value
        });
    }
    setBloom(value) {
        this.listener.send({
            "type": "set",
            "key": "bloom",
            "value": value
        });
    }
    setBrightness(value) {
        this.listener.send({
            "type": "set",
            "key": "brightness",
            "value": value
        });
    }

    getServices() {
        return [
            this.services._metadata,
            this.services.vegLight,
            this.services.bloomLight,
            this.services.humiditySensor,
            this.services.temperatureSensor
        ];
    }

    _roundBrightness(value) {
        let step = Math.round(value/25);
        let result = step * 25;
        return result;
    }

    destroy() {
        super.destroy();
    }
}

module.exports = GrowLightAccessory;
