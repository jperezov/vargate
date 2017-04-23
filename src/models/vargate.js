define([
    './util'
], function(util) {
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
        var subKeyWaitCount = 0;
        this.module = module;
        if (window.DEBUG_MODE === 'verbose') {
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
            var namespacedModule = this.module === self.module ? self.module + '.' + module : module;
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
            } else if (vars.length && typeof vars !== 'string') {
                util.log(['Waiting in "' + this.module + '" for', vars], true);
                for (var v in vars) {
                    if (! vars.hasOwnProperty(v)) continue;
                    addCallback.call(this, namespace, vars[v], fn, context);
                    // Try to see if this should already execute
                }
                this.unlock(vars[0]);
            } else {
                util.log(['Waiting in "' + this.module + '" for', vars], true);
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
            var sourceData = arguments[2] || data;
            // Grab the namespaced key
            var sourceKey = this.module === self.module? this.module + '.' + key : arguments[3];
            var subKey = key.split('.');
            if (subKey && subKey.length > 1) {
                // Allow parent to set data for submodules
                children[this.module + '.' + subKey[0]].set(subKey.splice(1).join('.'), val, sourceData, sourceKey);
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
         * Clears all data for the current module
         */
        this.clear = function() {
            var dataArr = self.module === this.module ? data : arguments[0];
            if (parent) {
                parent.clear.call(this, dataArr);
            } else {
                var keyRegex = new RegExp('^' + this.module + '\\.[^\\.]*$');
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
                        util.log('Conditions [' + gateObj.vars.join(',') + '] met for "' + gateObj.module.module + '".', true);
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
                                if (cond.indexOf('.') !== -1) {
                                    subKeyWaitCount --;
                                }
                                if (gateMap[cond].deps === 0) {
                                    delete gateMap[cond];
                                }
                            }
                            delete gate[namespace];
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
            if (! data[this.module + '.' + key] && typeof parent.get(key) !== 'undefined' && ! util.squelch()) {
                // Not allowing sub-modules to name variables already defined in the parent (unless using override).
                // Things get weird when expecting a variable defined in two places.
                util.throw('In "' + this.module + '" variable "' + key + '" defined in module "'
                    + parent.module + '". Choose a different name.');
            }
        }
    }
    return VarGate;
});
