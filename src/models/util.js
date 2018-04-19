define([
    '../vars/global'
], function (global) {
    /** @type {boolean} */
    let squelch = false;
    //noinspection UnnecessaryLocalVariableJS
    /**
     * @type {Object<Function>}
     */
    const util = {
        /**
         * Conditionally logs warnings or throws errors depending on the DEV_MODE setting.
         * @param {string} string
         */
        throw: function (string) {
            // Namespace the message
            /** @type {string} */
            const message = 'VarGate Error: ' + string;
            switch (global['DEV_MODE']) {
                case 'warn':
                    try {
                        console['error'](message);
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
         * Conditionally logs messages to help debug based on the value of DEBUG_MODE
         * @param {Array|string} message
         * @param {boolean=} important
         */
        log: function (message, important) {
            /** @type {string} */
            const prefix = 'VarGate SG1 Log:';
            /** @type {Array} */
            let args = [];
            if (global['DEBUG_MODE']) {
                if (typeof message !== 'string' && message.length) {
                    args = message;
                } else {
                    args.push(message);
                }
                args.unshift(prefix);
                try {
                    switch (global['DEBUG_MODE']) {
                        case 'verbose':
                            console['warn'].apply(console, args);
                            break;
                        case 'static':
                            console['warn'].apply(console, JSON.parse(JSON.stringify(args)));
                            break;
                        case 'minimal':
                            if (important) console['warn'].apply(console, args);
                            break;
                        default:
                        // do nothing
                    }
                } catch (e) {
                    // Looks like we can't log anything
                }
            }
        },
        /**
         * Used to squelch the log / throw functions. This allows existing functions to be re-used
         * when creating explicit functions to override expected behaviors.
         * @param {boolean=} bool
         * @returns {boolean}
         */
        squelch: function (bool) {
            if (typeof bool === 'boolean') {
                squelch = bool;
            }
            return squelch;
        },
        /**
         * Generates a unique ID
         * @Function
         * @returns {string}
         */
        guid: (function () {
            /** @type {Array<string>} */
            const lut = [];
            for (let i = 0; i < 256; i ++) {
                /** @type {string} */
                lut[i] = (i < 16 ? '0' : '') + (i).toString(16);
            }
            return function () {
                /** @type {number} */
                const d0 = Math.random() * 0xffffffff | 0;
                /** @type {number} */
                const d1 = Math.random() * 0xffffffff | 0;
                /** @type {number} */
                const d2 = Math.random() * 0xffffffff | 0;
                /** @type {number} */
                const d3 = Math.random() * 0xffffffff | 0;
                return lut[d0 & 0xff] + lut[d0 >> 8 & 0xff] + lut[d0 >> 16 & 0xff] + lut[d0 >> 24 & 0xff] + '-' +
                    lut[d1 & 0xff] + lut[d1 >> 8 & 0xff] + '-' + lut[d1 >> 16 & 0x0f | 0x40] + lut[d1 >> 24 & 0xff] + '-' +
                    lut[d2 & 0x3f | 0x80] + lut[d2 >> 8 & 0xff] + '-' + lut[d2 >> 16 & 0xff] + lut[d2 >> 24 & 0xff] +
                    lut[d3 & 0xff] + lut[d3 >> 8 & 0xff] + lut[d3 >> 16 & 0xff] + lut[d3 >> 24 & 0xff];
            }
        })()
    };
    return util;
});
