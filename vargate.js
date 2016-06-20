/**!
 * VarGate v0.1.0
 * Copyright (c)  Jonathan Perez.
 * Licensed under the MIT License.
 */
(function() {
    "use strict";

    var util = {
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
        var callback = {};
        this.module = module;
        this.data = data; // todo: remove
        this.gate = gate; // todo: remove
        this.gateMap = gateMap; // todo: remove
        this.children = children;
        this.parent = parent; // todo: remove
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
         * Executes a given function when data is set or meets a condition.
         * Executes immediately if conditions have already been met.
         * @param {string|Array} vars
         * @param {function} fn
         * @param {object} context
         */
        this.when = function(vars, fn, context) {
            // Used to associate data with its callback
            var namespace = this.module + '.' + util.guid();
            if (vars.length && typeof vars !== 'string') {
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
            var realKey = this.module === self.module? this.module + '.' + key : key;
            if (parent) {
                if (typeof parent.get(key) !== 'undefined') {
                    // Not allowing sub-modules to name variables already defined in the parent.
                    // Things get weird when expecting a variable defined in two places.
                    util.throw('In "' + this.module + '" variable "' + key + '" defined in module "'
                        + parent.module + '". Choose a different name.');
                }
                parent.set.call(this, realKey, val, key);
            } else {
                data[realKey] = this.data[key] = val;
                // arguments[2] contains the original key if this came from a child module
                this.unlock(arguments[2] || key);
            }
        };
        /**
         * Gets the data for a given key from the appropriate module
         * @param {string} key
         * @returns {*}
         */
        this.get = function(key) {
            var subModuleData = data[self.module + '.' + key];
            if (parent) {
                if (typeof subModuleData !== 'undefined') {
                    return subModuleData;
                } else {
                    return parent.get.call(this, key);
                }
            } else {
                return data[this.module + '.' + key];
            }
        };
        this.unlock = function(key) {
            if (typeof gateMap[key] === 'object') {
                for (var namespace in gateMap[key].namespace) {
                    if (! gateMap[key].namespace.hasOwnProperty(namespace)) continue;
                    var gateObj = gate[namespace];
                    var conditions = gateObj.cond;
                    var count = 0;
                    var cond, c;
                    for (cond in conditions) {
                        if (! conditions.hasOwnProperty(cond)) continue;
                        c = conditions[cond];
                        try {
                            if (eval(this.get(cond) + ' ' + c.operator  + ' ' + c.val)) {
                                count ++;
                            }
                        } catch (e) {
                            try {
                                if(eval(JSON.stringify(this.get(cond)) + ' ' + c.operator + ' ' + JSON.stringify(c.val))) {
                                    console.log('stringified');
                                    console.log(JSON.stringify(this.get(cond)) + conditions[cond]);
                                    count ++;
                                }
                            } catch (e) {
                                util.throw(e);
                            }
                        }
                    }
                    if (count === gateObj.vars.length) {
                        console.log('should run the function ', gateObj.fn);
                        if (gateObj.fn.length && gateObj.fn[0]) {
                            // do something when persisting
                            gateObj.fn[1].apply(gateObj.context, getArguments(gateObj.vars));
                        } else {
                            gateObj.fn.apply(gateObj.context, getArguments(gateObj.vars));
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
        function getArguments(arr) {
            var retArr = [];
            for (var i = 0; i < arr.length; i ++) {
                console.log('getting ->',self.get(arr[i]));
                retArr.push(self.get(arr[i]));
            }
            return retArr;
        }
        /**
         *
         * @param namespace
         * @param prop
         * @param fn
         * @param context
         */
        function addCallback(namespace, prop, fn, context) {
            var key, val, operator, errorMessage;
            if (typeof gate[namespace] === 'undefined') {
                // Define the property if this is the first time--otherwise re-use the old definition
                gate[namespace] = {
                    vars: [],
                    cond: {},
                    fn: fn,
                    context: context
                };
            }
            if (prop.length && typeof prop !== 'string') {
                key = prop[0];
                operator = prop[1];
                val = prop[2];
                errorMessage = 'Invalid number of arguments passed through: ['
                    + prop.join(',') + '] (should be [key, operator, condition])';
            } else {
                key = prop;
                operator = '!==';
                val = 'undefined';
                errorMessage = 'Cannot set "' + JSON.stringify(prop) + '" as a property';
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
                util.throw(errorMessage);
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