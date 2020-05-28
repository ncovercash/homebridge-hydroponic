# homebridge-hydroponic (myLumii)

A homebridge plugin to interact with a myLumii light (for hydroponics) over the local LAN.

Originally, I tried using the various existing Tuya platform plugins, however, I found them to be unresponsive with the Home app and generally incompatible with my device.  Additionally, I did not wish to use any that used Tuya's web API, as I intended to firewall this device from the internet.  Therefore, I built my own.

This does not necessarily need to be a platform, however, I engineered it with this architecture in mind for extensibility.

## Installation
Install this plugin using `npm i -g homebridge-hydroponic`.

Update the `config.json` file of your Homebridge setup, by modifying the sample configuration below. Use [TuyaAPI/cli](https://github.com/TuyaAPI/cli) to link devices and get the ID/key.

## Updating
Update to the latest release of this plugin using `npm i -g homebridge-hydroponic`.

## Configurations

Add the following to the Homebridge `config.json`:

```json5
{
    ...
    "platforms": [
        ...
        {
            "platform": "Hydroponic",
	        "name": "Hydroponic Lamp",
            "id": "your-id-here",
            "key": "your-key-here"
        }
        ...
    ]
    ...
}
```

#### Parameters
* `name` is whatever you'd like the device to show as in the Home app.
* `id` and `key` are special tokens for your device.  You can find them by linking with [TuyaAPI/cli](https://github.com/TuyaAPI/cli)

## Credit
A lot of this is dependent upon the amazing work in [TuyAPI](https://github.com/codetheweb/tuyapi).
