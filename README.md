A simple homebridge plugin to connect ncovercash/mylumii-listener to homebridge itself.

Originally, I tried using the various existing Tuya platform plugins, however, I found them to be unresponsive with the Home app and generally incompatible with my device.  Additionally, I did not wish to use any that used Tuya's web API, as I intended to firewall this device from the internet.  Therefore, I built my own.

Use TuyaAPI/cli to link devices and get the ID/key.

This does not need to be a platform, however, I may wish to add extra accessories later, therefore, I engineered it with this architecture in mind.
