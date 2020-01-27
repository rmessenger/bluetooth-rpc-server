# Bluetooth RPC Server
The server side of a library allowing Remove Procedure Call (RPC) from a web application to a Node.js server on a Bluetooth-enabled device.

## Installation

This library uses [bleno](https://www.npmjs.com/package/bleno), and needs to be
run on a device that supports Bluetooth. Any issues related to installation
will be due to missing requirements for **bleno**. To install, simply run:

    npm install bluetooth-rpc-server

## Usage

**This library is designed to be used with [bluetooth-rpc-client](https://www.npmjs.com/package/bluetooth-rpc-client)**

    const BluetoothRPCServer = require('bluetooth-rpc-server');
    
    BluetoothRPCServer.startServer({
        name: 'My Device', // this name will be broadcast, and visible to the user on pairing
        serviceUuid: '', // choose a UUID. Client must know this value.
        characteristicUuid: '', // choose a UUID. Client must know this value.
        handlers: { // client will be able to call these remotely!
            async doSomething(x, y, z) {
                // ...do some async computations here...
                return 'something';
            }
        }
    );

After starting the server, the device should broadcast a bluetooth device
called 'My Device'. The client should now be able to connect to this device,
and call the async functions defined within `handlers` as if they were local
functions.
