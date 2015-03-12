var net = require('net'),
    _ = require('underscore')._,
    os = require("os");

function GraphiteClient(options) {

    var queue = {};

    var defaults = {
        host: '127.0.0.1',
        port: 2003,
        debug: false,
        interval: 60000,
        prefix: "monitoring." + os.hostname() + "."
    };

    function init() {
        options = _.defaults(options || {}, defaults);

        setInterval(send, options.interval);

        return {
            increment: increment,
            collectLastValue: collectLastValue,
            collectMaximum: collectMaximum,
            options: options,
            send: send
        }
    }

    function increment(name, value) {
        calculateValues(name, function(item) {
            if (item === undefined) {
                item = { value: value };
            } else {
                item.value += value;
            }
            return item;
        });
    }

    function collectMaximum(name, value) {
        calculateValues(name, function(item) {
            if (item === undefined) {
                item = { value: value };
            } else if (item.value < value){
                item.value = value;
            }
            return item;
        });
    }

    function collectLastValue(name, value) {
        calculateValues(name, function(item) {
            return { value: value };
        });
    }

    function calculateValues(name, f) {
        var timestamp = String(Date.now()).substr(0, 10);
        queue[name] = f(queue[name]);
        queue[name].timestamp = timestamp;
    }

    function getQueueAsPlainText() {
        var text = '';
        for(var name in queue) {
            text += options.prefix + name +' '+ queue[name].value +' '+ queue[name].timestamp +'\n'
        }
        return text
    }

    function send(done) {
        if(Object.keys(queue).length === 0) {
            return;
        }

        var queueString = getQueueAsPlainText();
        var socket = net.createConnection(options.port, options.host, function() {
            socket.write(queueString);
            socket.end();
        });
        socket.on('error', function (e) {
            console.log("Graphite connection failed: " + e.code);
        });

        queue = {};
        if (done) {
            done();
        }
    }

    return init()
}

module.exports = {
    createClient: function (options) {
        return new GraphiteClient(options)
    }
};
