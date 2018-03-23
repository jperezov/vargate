/**!
 * vargate v0.8.3
 * Copyright (c) 2018 Jonathan Perez.
 * Licensed under the MIT License.
 */
(function(window) {
    "use strict";

    var squelch = false;
    //noinspection UnnecessaryLocalVariableJS
    var util = {
        /**
         * Conditionally logs warnings or throws errors depending on the DEV_MODE setting.
         * @param string
         */
        throw: function(string) {
            // Namespace the message
            var message = 'VarGate Error: ' + string;
            switch (window['DEV_MODE']) {
                case 'warn':
                    try {
                        console.error(message);
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
         * @param {*} message
         * @param {boolean=} important
         */
        log: function(message, important) {
            var prefix = 'VarGate SG1 Log:';
            var args = [];
            if (window['DEBUG_MODE']) {
                if (typeof message !== 'string' && message.length) {
                    args = message;
                } else {
                    args.push(message);
                }
                args.unshift(prefix);
                try {
                    switch (window['DEBUG_MODE']) {
                        case 'verbose':
                            console.warn.apply(console, args);
                            break;
                        case 'static':
                            console.warn.apply(console, JSON.parse(JSON.stringify(args)));
                            break;
                        case 'minimal':
                            if (important) console.warn.apply(console, args);
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
        squelch: function(bool) {
            if (typeof bool === 'boolean') {
                squelch = bool;
            }
            return squelch;
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
            return function() {
                var d0 = Math.random() * 0xffffffff | 0;
                var d1 = Math.random() * 0xffffffff | 0;
                var d2 = Math.random() * 0xffffffff | 0;
                var d3 = Math.random() * 0xffffffff | 0;
                return lut[d0 & 0xff] + lut[d0 >> 8 & 0xff] + lut[d0 >> 16 & 0xff] + lut[d0 >> 24 & 0xff] + '-' +
                    lut[d1 & 0xff] + lut[d1 >> 8 & 0xff] + '-' + lut[d1 >> 16 & 0x0f | 0x40] + lut[d1 >> 24 & 0xff] + '-' +
                    lut[d2 & 0x3f | 0x80] + lut[d2 >> 8 & 0xff] + '-' + lut[d2 >> 16 & 0xff] + lut[d2 >> 24 & 0xff] +
                    lut[d3 & 0xff] + lut[d3 >> 8 & 0xff] + lut[d3 >> 16 & 0xff] + lut[d3 >> 24 & 0xff];
            }
        })()
    };

    /**
     * VarGate constructor
     * @param {string} moduleName
     * @param {VarGate} [parent]
     * @constructor
     */
    function VarGate(moduleName, parent) {
        var self = this;
        var children = {};
        var data = {};
        var gate = {};
        var gateMap = {};
        var subKeyWaitCount = 0;
        this.moduleName = moduleName;
        if (window['DEBUG_MODE'] === 'verbose') {
            (function(self) {
                self.parent = parent;
                self.children = children;
                self.data = data;
                self.gate = gate;
                self.gateMap = gateMap;
                self.subKeyWaitCount = subKeyWaitCount;
            })(this);
        }
        /**
         * Registers a child module, which will be able to access, but not set,
         * the data available for this module.
         * @param {string} module
         * @returns {VarGate}
         */
        this.register = function(module) {
            var sourceChildren = arguments[1] || children;
            var namespacedModule = this.moduleName === self.moduleName ? self.moduleName + '.' + module : module;
            if (parent) {
                // All modules should be registered with the top-level parent
                return parent.register.call(this, namespacedModule, sourceChildren);
            }
            util.log('Registering "' + namespacedModule + '"', true);
            // This ensures parents are properly associated with nested modules *and* the top-level parent
            children[namespacedModule] = sourceChildren[namespacedModule] = new VarGate(namespacedModule, this);
            return children[namespacedModule];
        };
        /**
         * Returns a new top-level VarGate instance with a separate namespace.
         * @param {string} module
         * @returns {VarGate}
         */
        this.new = function(module) {
            util.log('Creating new "' + module + '"', true);
            return new VarGate(module);
        };
        /**
         * Shorthand notation for `VarGate.when(vars, [fn, true], context)`.
         * Creates a `when` listener that triggers whenever a `set` occurs
         * and the conditions for `vars` evaluate to true.
         * @param {string|Array} vars
         * @param {function} fn
         * @param {Object} context
         */
        this.on = function(vars, fn, context) {
            this.when(vars, [fn, true], context);
        };
        /**
         * Executes a given function when data is set or meets a condition.
         * Executes immediately if conditions have already been met.
         * @param {string|Array} vars
         * @param {function} fn
         * @param {Object} context
         */
        this.when = function(vars, fn, context) {
            // Used to associate data with its callback
            var namespace = this.moduleName + '.' + util.guid();
            if (parent) {
                parent.when.call(this, vars, fn, context);
            } else if (vars.length && typeof vars !== 'string') {
                util.log(['Waiting in "' + this.moduleName + '" for', vars], true);
                for (var v in vars) {
                    if (! vars.hasOwnProperty(v)) continue;
                    addCallback.call(this, namespace, vars[v], fn, context || this);
                    // Try to see if this should already execute
                }
                this.unlock(vars[0]);
            } else {
                util.log(['Waiting in "' + this.moduleName + '" for', vars], true);
                addCallback.call(this, namespace, vars, fn, context || this);
                // Try to see if this should already execute
                this.unlock(vars);
            }
        };
        /**
         * Sets a value for a given key within the current module.
         * Cannot overwrite keys set for the parent module.
         * @param {string} key
         * @param {*} val
         * @param {Object=} contextualData
         * @param {string=} contextualKey
         */
        this.set = function(key, val, contextualData, contextualKey) {
            var sourceData = contextualData || data;
            // Grab the namespaced key
            var sourceKey = this.moduleName === self.moduleName? this.moduleName + '.' + key : contextualKey;
            var subKey = key.split('.');
            if (subKey && subKey.length > 1) {
                // Allow parent to set data for submodules
                children[this.moduleName + '.' + subKey[0]].set(subKey.splice(1).join('.'), val, sourceData, sourceKey);
            } else if (parent) {
                checkDefined.call(this, key);
                parent.set.call(this, key, val, sourceData, sourceKey);
            } else {
                data[sourceKey] = sourceData[sourceKey] = val;
                checkValue.call(this, key, val);
                util.log(['Set "' + sourceKey + '" to value', val]);
                this.unlock(key);
            }
        };
        /**
         * Used to override a key set by the parent within a given module.
         * Will not throw a warning or error, as this is explicitly meant to be an override.
         * @param {string} key
         * @param {*} val
         */
        this.override = function(key, val) {
            checkValue.call(this, key, val);
            util.squelch(true);
            this.set(key, val);
            util.squelch(false);
        };
        /**
         * Shorthand to explicitly set a value to undefined.
         * @param {string} key
         */
        this.unset = function(key) {
            checkDefined.call(this, key);
            util.squelch(true);
            var ret = this.set(key);
            util.squelch(false);
            return ret;
        };
        /**
         * Gets the data for a given key from the appropriate module
         * @param {string} key
         * @returns {*}
         */
        this.get = function(key) {
            var subModuleData = data[self.moduleName + '.' + key];
            if (typeof subModuleData !== 'undefined') {
                return subModuleData;
            } else if (parent) {
                return parent.get.call(this, key);
            } else {
                return data[this.moduleName + '.' + key];
            }
        };
        /**
         * Clears all data for the current module
         * @param {Object=} [contextualData]
         */
        this.clear = function(contextualData) {
            var dataArr = self.moduleName === this.moduleName ? data : contextualData;
            if (parent) {
                parent.clear.call(this, dataArr);
            } else {
                var keyRegex = new RegExp('^' + this.moduleName + '\\.[^\\.]*$');
                for (var key in dataArr) {
                    // Clear data for the module
                    if (dataArr.hasOwnProperty(key) && key.match(keyRegex)) {
                        delete dataArr[key];
                        // Clear data for the top-level parent
                        if (data.hasOwnProperty(key)) {
                            delete data[key];
                        }
                    }
                }
            }
        };
        /**
         * Clears all data for the current module and all sub-modules
         */
        this.clearAll = function() {
            this.clear();
            for (var child in children) {
                if (children.hasOwnProperty(child)) {
                    children[child].clearAll();
                }
            }
        };
        /**
         * Unlocks a given key
         * @param {string} key
         */
        this.unlock = function(key) {
            var unlockingSubmodule = arguments[1];
            var skipSubKeyCheck = arguments[2];
            if (parent) {
                parent.unlock.call(this, key, unlockingSubmodule, skipSubKeyCheck);
            } else if (typeof gateMap[key] === 'object') {
                var valRegex = /^@\w+$/;
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
                        right = (c.val && c.val.toString().match(valRegex)) ? gateObj.module.get(c.val.slice(1)) : c.val;
                        try {
                            if (eval('left ' + c.operator  + ' right')) {
                                count ++;
                            }
                        } catch (e) {
                            util.throw(e);
                        }
                    }
                    if (count === gateObj.vars.length) {
                        util.log('Conditions [' + gateObj.vars.join(',') + '] met for "' + gateObj.module.moduleName + '".', true);
                        var args = [];
                        for (var i = 0; i < gateObj.vars.length; i ++) {
                            args.push(gateObj.module.get(gateObj.vars[i]));
                        }
                        if (gateObj.fn.length && gateObj.fn[1]) {
                            // do something when persisting
                            gateObj.fn[0].apply(gateObj.context, args);
                        } else {
                            // Remove future callbacks of this function if not persistent
                            for (cond in conditions) {
                                if (! conditions.hasOwnProperty(cond)) continue;
                                delete gateMap[cond].namespace[namespace];
                                gateMap[cond].deps --;
                                if (cond.indexOf('.') !== -1) {
                                    subKeyWaitCount --;
                                }
                                if (gateMap[cond].deps === 0) {
                                    delete gateMap[cond];
                                }
                            }
                            delete gate[namespace];
                            gateObj.fn.apply(gateObj.context, args);
                        }
                    }
                }
            } else if (subKeyWaitCount && ! skipSubKeyCheck) {
                for (var gateKey in gateMap) {
                    if (! gateMap.hasOwnProperty(gateKey)) continue;
                    var split = gateKey.split('.');
                    if (split && split.length && split[split.length - 1] === key) {
                        self.unlock(gateKey, true, true);
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
         * @param {Function|Array} fn
         * @param {Object} context
         * @param {boolean} [stop]
         */
        function addCallback(namespace, prop, fn, context, stop) {
            var key, val, operator;
            context = context || this;
            if (typeof gate[namespace] === 'undefined') {
                // Define the property if this is the first time--otherwise re-use the old definition
                gate[namespace] = {
                    vars: [],
                    cond: {},
                    fn: fn,
                    module: this,
                    context: context
                };
            }
            if (Array.isArray(prop)) {
                if (prop.length === 2) {
                    key = util.guid() + ':' + prop[1].replace(/\./g, '-');
                    operator = '!==';
                    val = undefined;
                    assignNestedPropertyListener(prop[0], prop[1], key, context);
                } else if (prop.length === 3) {
                    key = prop[0];
                    operator = prop[1];
                    val = prop[2];
                    if ((val && val.toString().match(/^@\w+$/)) && stop !== true) {
                        // We're comparing two values--reverse and re-add to watch for both values
                        addCallback(namespace, [val.slice(1), operator, '@' + key], fn, context, true);
                    }
                } else {
                    util.throw('Invalid number of arguments passed through: ['
                        + prop.join(',') + '] (should be [key, operator, condition])');
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
                gateMap[key].namespace[namespace] = true;
                gateMap[key].deps ++;
                if (key.indexOf('.') !== -1) {
                    subKeyWaitCount ++;
                }
            } catch (e) {
                util.throw('Cannot set "' + JSON.stringify(prop) + '" as a property');
            }
        }
        /**
         * Used to prevent the user from setting a value to `undefined` without explicitly calling `unset`.
         * Only works when `window.DEV_MODE` is 'strict' or 'warn'
         * @param {string} key
         * @param {*} val
         */
        function checkValue(key, val) {
            if (typeof val === 'undefined' && ! util.squelch()) {
                util.throw('"' + key + '" set to `undefined`. Was this intentional?' +
                    ' Use `unset("' + key + '")` if it was.');
            }
        }
        /**
         * Used to prevent users from overriding a key without using a function meant to explicitly do so.
         * Only works when `window.DEV_MODE` is 'strict' or 'warn'
         * @param {string} key
         */
        function checkDefined(key) {
            //noinspection JSPotentiallyInvalidUsageOfThis
            if (! data[this.moduleName + '.' + key] && typeof parent.get(key) !== 'undefined' && ! util.squelch()) {
                // Not allowing sub-modules to name variables already defined in the parent (unless using override).
                // Things get weird when expecting a variable defined in two places.
                //noinspection JSPotentiallyInvalidUsageOfThis
                util.throw('In "' + this.moduleName + '" variable "' + key + '" defined in module "'
                    + parent.moduleName + '". Choose a different name.');
            }
        }
        /**
         * Listens and marks when a property is available
         * @param {Object} object
         * @param {string} key
         * @param {string} fullKey
         * @param {Object} context
         */
        function assignNestedPropertyListener(object, key, fullKey, context) {
            var pathArray = key.split('.');
            if (pathArray.length === 1 && typeof key === 'string') {
                // Sanitize `key`
                key = key.replace(/[^\w$]/g, '');
                if (object[key] === undefined) {
                    // Create a watch on the property, and run once it's been set
                    Object.defineProperty(object, key, {
                        configurable: true,
                        set: function(val) {
                            delete object[key];
                            object[key] = val;
                            context.set(fullKey, object);
                        }
                    });
                } else {
                    // The property's already been defined. Trigger it.
                    context.set(fullKey, object);
                }
            } else {
                assignNestedPropertyListener(object[pathArray[0]], pathArray.splice(1).join('.'), fullKey, context);
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

}(typeof window !== 'undefined' ? window : this));