const bleno = require('bleno');
const msgpack = require('msgpack-lite');
const murmurhash = require('murmurhash');

const { PrimaryService, Characteristic } = bleno;

const emptyReadResponse = msgpack.encode({});
const packetSize = 21;
const emptyPacket = new Uint8Array(0);

let receivedPackets = [];
let responseQueue = [];

let firstRun = true;

exports.startServer = function ({ name, serviceUuid, characteristicUuid, handlers }) {
    if (!firstRun) { return; }
    firstRun = false;
    let hashedHandlers = [];
    Object.keys(handlers).forEach(handlerName => {
        hashedHandlers[murmurhash.v3(handlerName)] = handlers[handlerName];
    });
    const commService = new PrimaryService({
        uuid: serviceUuid,
        characteristics: [
            new Characteristic({
                uuid: characteristicUuid,
                properties: ['read', 'write'],
                onReadRequest(offset, callback) {
                    if (responseQueue.length > 0) {
                        const packet = responseQueue.pop();
                        callback(Characteristic.RESULT_SUCCESS, packet);
                        if (responseQueue.length === 0) {
                            console.log('Responses sent.');
                        }
                    } else {
                        callback(Characteristic.RESULT_SUCCESS, emptyReadResponse);
                    }
                },
                async onWriteRequest(packet, offset, withoutResponse, callback) {
                    receivedPackets.push(packet);
                    if (packet.byteLength !== packetSize) {
                        const packets = receivedPackets;
                        receivedPackets = [];
                        const totalSize = packets
                            .reduce((total, p) => total + p.byteLength, 0);
                        let msg = new Uint8Array(totalSize);
                        for (let i = 0; i < packets.length; i++) {
                            msg.set(packets[i], i * packetSize);
                        }
                        let obj = msgpack.decode(msg);
                        console.log('Received request: ', obj);
                        callback(Characteristic.RESULT_SUCCESS);

                        (hashedHandlers[obj.h]
                            ? hashedHandlers[obj.h](...(obj.a || []))
                            : Promise.reject(new Error('No such request type!')))
                                .then(response => {
                                    let ro = { i: obj.i };
                                    if (typeof response !== "undefined") {
                                        ro.r = response;
                                    }
                                    return ro;
                                })
                                .catch(error => {
                                    let ro = { i: obj.i };
                                    if (typeof error !== "undefined") {
                                        ro.e = error.toString();
                                    }
                                    return ro;
                                })
                                .then(responseObj => {
                                    console.log('Response in queue', responseObj);
                                    const responseMsg = msgpack.encode(responseObj);
                                    for (let i = 0; i < responseMsg.byteLength; i += packetSize) {
                                        let thisPacketSize = Math.min(responseMsg.byteLength - i, packetSize);
                                        let packet = new Uint8Array(thisPacketSize);
                                        for (let j = 0; j < thisPacketSize; j ++) {
                                            packet[j] = responseMsg[i + j];
                                        }
                                        responseQueue.unshift(packet);
                                    }
                                    if (responseMsg.byteLength % packetSize === 0) {
                                        responseQueue.unshift(emptyPacket);
                                    }
                                });
                    } else {
                        callback(Characteristic.RESULT_SUCCESS);
                    }
                },
            }),
        ],
    });
    bleno.on('stateChange', state => {
        if (state === 'poweredOn') {
            bleno.startAdvertising(name, [commService.uuid]);
        } else {
            bleno.stopAdvertising();
        }
    });
    bleno.on('advertisingStart', error => {
        if (error) {
            console.error(error);
        } else {
            console.log('Started advertising on Bluetooth!');
            bleno.setServices([commService]);
        }
    });
};

