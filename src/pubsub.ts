import EventEmitter from 'events';
import nconf from 'nconf';

let real;
let noCluster;
let singleHost;

interface Message {
    action: string,
    event : string | symbol,
    data: unknown
}

function get() {
    if (real) {
        return real;
    }

    let pubsub : EventEmitter;

    if (!nconf.get('isCluster')) {
        if (noCluster) {
            real = noCluster;
            return real;
        }
        noCluster = new EventEmitter();
        noCluster.publish = noCluster.emit.bind(noCluster);
        pubsub = noCluster;
    } else if (nconf.get('singleHostCluster')) {
        if (singleHost) {
            real = singleHost;
            return real;
        }
        singleHost = new EventEmitter();
        if (!process.send) {
            singleHost.publish = singleHost.emit.bind(singleHost);
        } else {
            singleHost.publish = function (event : string | symbol, data : unknown) {
                process.send({
                    action: 'pubsub',
                    event: event,
                    data: data,
                });
            };
            process.on('message', (message : Message) => {
                if (message && typeof message === 'object' && message.action === 'pubsub') {
                    singleHost.emit(message.event, message.data);
                }
            });
        }
        pubsub = singleHost;
    } else if (nconf.get('redis')) {
        pubsub = require('./database/redis/pubsub');
    } else {
        throw new Error('[[error:redis-required-for-pubsub]]');
    }

    real = pubsub;
    return pubsub;
}

export function publish(event : string | symbol, data: unknown) {
    get().publish(event, data);
}

export function on(event, callback) {
    get().on(event, callback);
}

export function removeAllListeners(event) {
    get().removeAllListeners(event);
}

export function reset() {
    real = null;
}
