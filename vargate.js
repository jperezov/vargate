/**!
 * vargate v0.4.0
 * Copyright (c) 2016 Jonathan Perez.
 * Licensed under the MIT License.
 */
(function() {
    "use strict";

    var util = {
        /**
         * Conditionally logs warnings or throws errors depending on the DEBUG_MODE setting.
         * @param string
         */
        throw: function(string) {
            // Namespace the message
            var message = 'VarGate Error: ' + string;
            switch (window.DEBUG_MODE) {
                case 'warn':
                    console.warn(message);
                    break;
                case 'strict':
                    throw message;
                default:
                    // do nothing
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

    /**
     * VarGate constructor
     * @param {string} module
     * @param {VarGate} [parent]
     * @constructor
     */
    function VarGate(module, parent) {
        var self = this;
        var children = {};
        var data = {};
        var gate = {};
        var gateMap = {};
        this.module = module;
        this.data = data;
        this.children = children;
        /**
         * Registers a child module, which will be able to access, but not set,
         * the data available for this module.
         * @param {string} module
         * @returns {VarGate}
         */
        this.register = function(module) {
            var namespacedModule = this.module === self.module ? self.module + '.' + module : module;
            if (parent) {
                // All modules should be registered with the top-level parent
                return parent.register.call(this, namespacedModule);
            }
            // This ensures parents are properly associated with nested modules *and* the top-level parent
            children[namespacedModule] = this.children[namespacedModule] = new VarGate(namespacedModule, this);
            return children[namespacedModule];
        };
        /**
         * Returns a new top-level VarGate instance with a separate namespace.
         * @param {string} module
         * @returns {VarGate}
         */
        this.new = function(module) {
            return new VarGate(module);
        };
        /**
         * Shorthand notation for `VarGate.when(vars, [fn, true], context)`.
         * Creates a `when` listener that triggers whenever a `set` occurs
         * and the conditions for `vars` evaluate to true.
         * @param {string|Array} vars
         * @param {function} fn
         * @param {object} context
         */
        this.on = function(vars, fn, context) {
            this.when(vars, [fn, true], context);
        };
        /**
         * Executes a given function when data is set or meets a condition.
         * Executes immediately if conditions have already been met.
         * @param {string|Array} vars
         * @param {function} fn
         * @param {object} context
         */
        this.when = function(vars, fn, context) {
            // Used to associate data with its callback
            var namespace = this.module + '.' + util.guid();
            if (parent) {
                parent.when.call(this, vars, fn, context);
            } else  if (vars.length && typeof vars !== 'string') {
                for (var v in vars) {
                    if (! vars.hasOwnProperty(v)) continue;
                    addCallback.call(this, namespace, vars[v], fn, context);
                    // Try to see if this should already execute
                }
                this.unlock(vars[0]);
            } else {
                addCallback.call(this, namespace, vars, fn, context);
                // Try to see if this should already execute
                this.unlock(vars);
            }
        };
        /**
         * Sets a value for a given key within the current module.
         * Cannot overwrite keys set for the parent module.
         * todo: Fix an issue that will arise when the parent sets a key *after* the child does.
         * @param {string} key
         * @param {*} val
         */
        this.set = function(key, val) {
            // Grab the namespaced key
            var realKey = this.module === self.module? this.module + '.' + key : arguments[2];
            var subKey = key.split('.');
            if (subKey && subKey.length > 1) {
                // Allow parent to set data for submodules
                children[this.module + '.' + subKey[0]].set(subKey.splice(1).join('.'));
            } if (parent) {
                if (typeof parent.get(key) !== 'undefined') {
                    // Not allowing sub-modules to name variables already defined in the parent.
                    // Things get weird when expecting a variable defined in two places.
                    util.throw('In "' + this.module + '" variable "' + key + '" defined in module "'
                        + parent.module + '". Choose a different name.');
                }
                parent.set.call(this, key, val, realKey);
            } else {
                data[realKey] = this.data[realKey] = val;
                this.unlock(key);
            }
        };
        /**
         * Gets the data for a given key from the appropriate module
         * @param {string} key
         * @returns {*}
         */
        this.get = function(key) {
            var subModuleData = data[self.module + '.' + key];
            if (typeof subModuleData !== 'undefined') {
                return subModuleData;
            } else if (parent) {
                return parent.get.call(this, key);
            } else {
                return data[this.module + '.' + key];
            }
        };
        /**
         * Unlocks a given key
         * @param {string} key
         */
        this.unlock = function(key) {
            if (parent) {
                parent.unlock.call(this, key);
            } else if (typeof gateMap[key] === 'object') {
                for (var namespace in gateMap[key].namespace) {
                    if (! gateMap[key].namespace.hasOwnProperty(namespace)) continue;
                    var gateObj = gate[namespace];
                    var conditions = gateObj.cond;
                    var count = 0;
                    var cond, c, left, right;
                    for (cond in conditions) {
                        if (! conditions.hasOwnProperty(cond)) continue;
                        c = conditions[cond];
                        left = gateObj.module.get(cond);
                        right = (c.val && c.val.toString().match(/^@\w+$/)) ? gateObj.module.get(c.val.slice(1)) : c.val;
                        try {
                            if (eval('left ' + c.operator  + ' right')) {
                                count ++;
                            }
                        } catch (e) {
                            util.throw(e);
                        }
                    }
                    if (count === gateObj.vars.length) {
                        var args = [];
                        for (var i = 0; i < gateObj.vars.length; i ++) {
                            args.push(gateObj.module.get(gateObj.vars[i]));
                        }
                        if (gateObj.fn.length && gateObj.fn[1]) {
                            // do something when persisting
                            gateObj.fn[0].apply(gateObj.context, args);
                        } else {
                            gateObj.fn.apply(gateObj.context, args);
                            // Remove future callbacks of this function if not persistent
                            for (cond in conditions) {
                                if (! conditions.hasOwnProperty(cond)) continue;
                                delete gateMap[cond].namespace[namespace];
                                gateMap[cond].deps --;
                                if (gateMap[cond].deps === 0) {
                                    delete gateMap[cond];
                                }
                            }
                            delete gate[namespace];
                        }
                    }
                }
            }
        };
        //================+
        // Helper Functions
        //================+
        /**
         * Sets up the gate and gateMap to fire the provided callback when the conditions are met.
         * @param {string} namespace
         * @param {string|Array} prop
         * @param {function|Array} fn
         * @param {*} context
         * @param {boolean} [stop]
         */
        function addCallback(namespace, prop, fn, context, stop) {
            var key, val, operator;
            if (typeof gate[namespace] === 'undefined') {
                // Define the property if this is the first time--otherwise re-use the old definition
                gate[namespace] = {
                    vars: [],
                    cond: {},
                    fn: fn,
                    module: this,
                    context: context || this
                };
            }
            if (prop.length && typeof prop !== 'string') {
                if (prop.length !== 3) {
                    util.throw('Invalid number of arguments passed through: ['
                        + prop.join(',') + '] (should be [key, operator, condition])');
                }
                key = prop[0];
                operator = prop[1];
                val = prop[2];
                if ((val && val.toString().match(/^@\w+$/)) && stop !== true) {
                    // We're comparing two values--reverse and re-add to watch for both values
                    addCallback(namespace, [val.slice(1), operator, '@' + key], fn, context, true);
                }
            } else {
                key = prop;
                operator = '!==';
                val = undefined;
            }
            try {
                gate[namespace].vars.push(key);
                gate[namespace].cond[key] = {
                    operator: operator,
                    val: val
                };
                if (typeof gateMap[key] === 'undefined') {
                    gateMap[key] = {
                        deps: 0,
                        namespace: {}
                    };
                }
                gateMap[key].namespace[namespace] = false;
                gateMap[key].deps ++;
            } catch (e) {
                util.throw('Cannot set "' + JSON.stringify(prop) + '" as a property');
            }
        }
    }

    var Gate = new VarGate('vargate');
    if (typeof define === 'function' && define.amd) {
        // Remain anonymous if AMD library is available
        define(function() {
            return Gate;
        });
    } else if (typeof module === 'object' && module.exports) {
        // Use CommonJS / ES6 if available
        module.exports = Gate;
    } else {
        window.VarGate = Gate;
    }

}());