/**
 * This file will be ran in a thread from index.js
 * It should not be ran directly.
 */

const TuyAPI = require("tuyapi");
const process = require("process");

/**
 * The schema for my light (myLumii) is as follows:
 * { "mode": "rw", "code": "bright_value", "name": "Brightness", "property": { "unit": "%", "min": 25, "max": 100, "scale": 0, "step": 25, "type": "value" }, "id": 2, "type": "obj", "desc": ""}, 
 * { "mode": "ro", "code": "temp", "name": "Temperature", "property": { "unit": "C", "min": 0, "max": 600, "scale": 1, "step": 1, "type": "value" }, "id": 103, "type": "obj", "desc": ""}, 
 * { "mode": "ro", "code": "humidity", "name": "Humidity", "property": { "unit": "RH", "min": 0, "max": 100, "scale": 0, "step": 1, "type": "value" }, "id": 106, "type": "obj", "desc": ""}, 
 * { "mode": "rw","code": "mode", "name": "Mode", "property": { "range": ["VEG", "BLOOM", "FULL", "OFF"], "type": "enum" }, "id": 107, "type": "obj", "desc": ""},
 * { "mode": "wr", "code": "child_lock", "name": "Child Lock", "property": { "type": "bool" }, "id": 108, "type": "obj", "desc": "" }, 
 * { "mode": "wr", "code": "smart_onoff", "name": "SMART_ONOFF", "property": { "type": "bool" }, "id": 109, "type": "obj", "desc": "" }
 *
 * Both the app and physical device do not have any ways to manipulate child_lock or smart_onoff.
 * Therefore, this code does not support them as they do not seem to do anything
 *
 * Additionally, identify seems to only give garbled output, and the pings it sends out do not change (despite state changes)
 * Therefore, on server restart, things may not be what they should be.
 */
const device = new TuyAPI({
    id: process.argv[2],
    key: process.argv[3]
});

const dpKeys = {
    "brightness": "2",
    "mode": "107",
    "humidity": "106",
    "temperature": "103"
};

// initial values on device power up (I think)
let currentData = {};
currentData[dpKeys.brightness] = 100; // Brightness (25,50,75,100)
currentData[dpKeys.mode] = "OFF"; // Mode ("OFF","VEG","BLOOM","FULL")
currentData[dpKeys.humidity] = 0; // Humidity (%)
currentData[dpKeys.temperature] = 0; // Temperature (ºC*10)


process.send({
    "type": "connection",
    "message": false
});

device.find().then(() => {
    process.send({
        "type": "info",
        "message": "Found device!"
    });
    device.connect();
});

device.on("connected", () => {
    process.send({
        "type": "info",
        "message": "Connected to device!"
    });
    process.send({
        "type": "connection",
        "message": true
    });
});

device.on("disconnected", () => {
    process.send({
        "type": "info",
        "message": "Disconnected from device."
    });
    process.send({
        "type": "connection",
        "message": false
    });
    process.exit();
});

device.on("error", error => {
    process.send({
        "type": "error",
        "message": "Error! " + JSON.stringify(error)
    });
    process.send({
        "type": "connection",
        "message": false
    });
});

device.on("data", data => {
    if (data == "json obj data unvalid") {
        process.send({
            "type": "warn",
            "message": "Device returned invalid data (codetheweb/tuyapi#246)"
        });
        return;
    }
    process.send({
        "type": "info",
        "message": "Data from device: " + JSON.stringify(data)
    });
    Object.keys(data.dps).forEach(dp => {
        currentData[dp] = data.dps[dp];
    });
    // parent should not have to deal with any tuya besides ID/keys
    process.send({
        "type": "newData",
        "message": {
            "brightness": getCanonicalBrightness(), // Brightness (25,50,75.1,100)
            "veg": isVegLampOn(), // If veg is on (VEG | FULL)
            "bloom": isBloomLampOn(), // If bloom is on (BLOOM | FULL)
            "humidity": getCanonicalHumidity(), // Humidity (%)
            "temperature": getCanonicalTemperature(),
            "connected": true
        }
    });
});

let heartbeatErrorTimeout = setTimeout(heartbeatError, 15000);

device.on("heartbeat", () => {
    process.send({
        "type": "info",
        "message": "Got heartbeat"
    });
    process.send({
        "type": "connection",
        "message": true
    });
    clearTimeout(heartbeatErrorTimeout);
    heartbeatErrorTimeout = setTimeout(heartbeatError, 15000);
})

function heartbeatError() {
    process.send({
        "type": "error",
        "message": "Light did not send a heartbeat within 15s of previous"
    });
    process.send({
        "type": "connection",
        "message": false
    });
}

process.on("message", (data) => {
    switch (data.type) {
        case "set":
            switch (data.key) {
                case "veg":
                    if (data.value && isVegLampOn()) { return; } // do nothing
                    else if (!data.value && !isVegLampOn()) { return; } // do nothing
                    else if (data.value && isBloomLampOn()) { setMode("FULL"); }
                    else if (data.value && !isBloomLampOn()) { setMode("VEG"); }
                    else if (!data.value && isBloomLampOn()) { setMode("BLOOM"); }
                    else if (!data.value && !isBloomLampOn()) { setMode("OFF"); }
                    break;
                case "bloom":
                    if (data.value && isBloomLampOn()) { return; } // do nothing
                    else if (!data.value && !isBloomLampOn()) { return; } // do nothing
                    else if (data.value && isVegLampOn()) { setMode("FULL"); }
                    else if (data.value && !isVegLampOn()) { setMode("BLOOM"); }
                    else if (!data.value && isVegLampOn()) { setMode("VEG"); }
                    else if (!data.value && !isVegLampOn()) { setMode("OFF"); }
                    break;
                case "brightness":
                    device.set({
                        dps: dpKeys.brightness,
                        set: data.value
                    });
                    break;
                default:
                    process.send({
                        "type": "warn",
                        "message": "Unknown value to set " + data.key + " from parent process"
                    });
                    return;
            }
            process.send({
                "type": "info",
                "message": "Set " + data.key + " to " + data.value
            });
            break;
        default:
            process.send({
                "type": "warn",
                "message": "Unknown message from parent process"
            });
    }
});

function setMode(mode) {
    device.set({
        dps: dpKeys.mode,
        set: mode
    });
    process.send({
        "type": "info",
        "message": "Set mode to " + mode
    });
}

function getCanonicalBrightness() {
    return currentData[dpKeys.brightness];
};
function isVegLampOn() {
    return currentData[dpKeys.mode] == "VEG" || currentData[dpKeys.mode] == "FULL";
};
function isBloomLampOn() {
    return currentData[dpKeys.mode] == "BLOOM" || currentData[dpKeys.mode] == "FULL";
};
function getCanonicalHumidity() {
    return currentData[dpKeys.humidity];
};
function getCanonicalTemperature() {
    return currentData[dpKeys.temperature]/10;
};
