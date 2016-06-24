define(function() {
    var util = {
        /**
         * Conditionally logs warnings or throws errors depending on the DEBUG_MODE setting.
         * @param string
         */
        throw: function(string) {
            // Namespace the message
            var message = 'VarGate Error: ' + string;
            switch (window.DEV_MODE) {
                case 'warn':
                    try {
                        console.warn(message);
                    } catch (e) {
                        // Looks like we can't warn anyone
                    }
                    break;
                case 'strict':
                    throw message;
                default:
                    // do nothing
            }
        },
        /**
         *
         * @param {*} message
         * @param {boolean} [important]
         */
        log: function(message, important) {
            var prefix = 'VarGate SG1 Log:';
            var args = [];
            if (window.DEBUG_MODE) {
                if (typeof message !== 'string' && message.length) {
                    args = message;
                } else {
                    args.push(message);
                }
                args.unshift(prefix);
                try {
                    switch (window.DEBUG_MODE) {
                        case 'verbose':
                            console.info.apply(console, args);
                            break;
                        case 'trace':
                            console.trace.apply(console, args);
                            break;
                        case 'minimal':
                            if (important) console.info.apply(console, args);
                            break;
                        default:
                        // do nothing
                    }
                } catch (e) {
                    // Looks like we can't log anything
                    console.log(e);
                }
            }
        },
        /**
         * Generates a unique ID
         * @returns {string}
         */
        guid: (function() {
            var lut = [];
            for (var i = 0; i < 256; i ++) {
                lut[i] = (i < 16 ? '0' : '') + (i).toString(16);
            }
            var t = Math.random() + 1;
            return function() {
                var d0 = t * Math.random() * 0xffffffff | 0;
                var d1 = t * Math.random() * 0xffffffff | 0;
                var d2 = t * Math.random() * 0xffffffff | 0;
                var d3 = t * Math.random() * 0xffffffff | 0;
                return lut[d0 & 0xff] + lut[d0 >> 8 & 0xff] + lut[d0 >> 16 & 0xff] + lut[d0 >> 24 & 0xff] + '-' +
                    lut[d1 & 0xff] + lut[d1 >> 8 & 0xff] + '-' + lut[d1 >> 16 & 0x0f | 0x40] + lut[d1 >> 24 & 0xff] + '-' +
                    lut[d2 & 0x3f | 0x80] + lut[d2 >> 8 & 0xff] + '-' + lut[d2 >> 16 & 0xff] + lut[d2 >> 24 & 0xff] +
                    lut[d3 & 0xff] + lut[d3 >> 8 & 0xff] + lut[d3 >> 16 & 0xff] + lut[d3 >> 24 & 0xff];
            }
        })()
    };
    return util;
});