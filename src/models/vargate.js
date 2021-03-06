define([
    './util'
], function(util) {
    /**
     * VarGate constructor
     * @param {string} moduleName
     * @param {VarGate=} parent
     * @constructor
     */
    function VarGate(moduleName, parent) {
        /** @type {VarGate} */
        const self = this;
        /** @type {Object} */
        const children = {};
        /** @type {Object} */
        const data = {};
        /** @type {Object} */
        const gate = {};
        /** @type {Object} */
        const gateMap = {};
        /** @type {number} */
        let subKeyWaitCount = 0;
        /** @type {string} */
        this.moduleName = moduleName;

        /**
         * Registers a child module, which will be able to access, but not set,
         * the data available for this module.
         * @param {string} module
         * @param {Object<VarGate>=} contextualChildren
         * @returns {VarGate}
         */
        this.register = function(module, contextualChildren) {
            /** @type {Object} */
            const sourceChildren = contextualChildren || children;
            /** @type {string} */
            const namespacedModule = this.moduleName === self.moduleName ? `${self.moduleName}.${module}` : module;
            if (parent) {
                // All modules should be registered with the top-level parent
                return parent.register.call(this, namespacedModule, sourceChildren);
            }
            util.log(`Registering "${namespacedModule}"`, true);
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
            util.log(`Creating new "${module}"`, true);
            return new VarGate(module);
        };
        /**
         * Shorthand notation for `VarGate.when(vars, [fn, true], context)`.
         * Creates a `when` listener that triggers whenever a `set` occurs
         * and the conditions for `vars` evaluate to true.
         * @param {string|Array} vars
         * @param {Function} fn
         * @param {VarGate=} context
         */
        this.on = function(vars, fn, context) {
            this.when(vars, [fn, true], context);
        };
        /**
         * Executes a given function when data is set or meets a condition.
         * Executes immediately if conditions have already been met.
         * @param {string|Array} vars
         * @param {Function|Array} fn
         * @param {VarGate=} context
         */
        this.when = function(vars, fn, context) {
            // Used to associate data with its callback
            /** @type {string} */
            const namespace = `${this.moduleName}.${util.guid()}`;
            if (parent) {
                parent.when.call(this, vars, fn, context);
            } else if (vars.length && typeof vars !== 'string') {
                util.log([`Waiting in "${this.moduleName}" for`, vars], true);
                for (let i = 0; i < vars.length; i ++) {
                    addCallback.call(this, namespace, vars[i], fn, context || this);
                    // Try to see if this should already execute
                }
                this.unlock(vars[0]);
            } else {
                util.log([`Waiting in "${this.moduleName}" for`, vars], true);
                addCallback.call(this, namespace, vars, fn, context || this);
                // Try to see if this should already execute
                this.unlock(vars + ''); // Concatenating a string so that GCC stops thinking this could be an array
            }
        };
        /**
         * Sets a value for a given key within the current module.
         * Cannot overwrite keys set for the parent module.
         * @param {string} key
         * @param {*=} val
         * @param {Object=} contextualData
         * @param {string=} contextualKey
         */
        this.set = function(key, val, contextualData, contextualKey) {
            /** @type {Object} */
            const sourceData = contextualData || data;
            // Grab the namespaced key
            /** @type {string} */
            const sourceKey = (this.moduleName === self.moduleName? `${this.moduleName}.${key}` : contextualKey) + '';
            /** @type {Array} */
            const subKey = key.split('.');
            if (subKey && subKey.length > 1) {
                // Allow parent to set data for submodules
                children[`${this.moduleName}.${subKey[0]}`].set(subKey.splice(1).join('.'), val, sourceData, sourceKey);
            } else if (parent) {
                checkDefined.call(this, key);
                parent.set.call(this, key, val, sourceData, sourceKey);
            } else {
                data[sourceKey] = sourceData[sourceKey] = val;
                checkValue.call(this, key, val);
                util.log([`${Set} "${sourceKey}" to value`, val]);
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
            const ret = this.set(key);
            util.squelch(false);
            return ret;
        };
        /**
         * Gets the data for a given key from the appropriate module
         * @param {string} key
         * @returns {*}
         */
        this.get = function(key) {
            const subModuleData = data[`${self.moduleName}.${key}`];
            if (typeof subModuleData !== 'undefined') {
                return subModuleData;
            } else if (parent) {
                return parent.get.call(this, key);
            } else {
                return data[`${this.moduleName}.${key}`];
            }
        };
        /**
         * Clears all data for the current module
         * @param {Object=} contextualData
         */
        this.clear = function(contextualData) {
            /** @type {Object} */
            const dataArr = (self.moduleName === this.moduleName ? data : contextualData) || {};
            if (parent) {
                parent.clear.call(this, dataArr);
            } else {
                const keyRegex = new RegExp(`^${this.moduleName}\.[^\.]*$`);
                for (const key in dataArr) {
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
            for (const child in children) {
                if (children.hasOwnProperty(child)) {
                    children[child].clearAll();
                }
            }
        };
        /**
         * Unlocks a given key
         * @param {string} key
         * @param {boolean=} skipSubKeyCheck
         */
        this.unlock = function(key, skipSubKeyCheck) {
            if (parent) {
                parent.unlock.call(this, key, skipSubKeyCheck);
            } else if (typeof gateMap[key] === 'object') {
                /** @type {RegExp} */
                const valRegex = /^@\w+$/;
                for (const namespace in gateMap[key].namespace) {
                    if (! gateMap[key].namespace.hasOwnProperty(namespace)) continue;
                    /** @type {Object} */
                    const gateObj = gate[namespace];
                    /** @type {Object} */
                    const conditions = gateObj.cond;
                    /** @type {number} */
                    let count = 0;
                    /** @type {string} */
                    let cond;
                    for (cond in conditions) {
                        if (! conditions.hasOwnProperty(cond)) continue;
                        /** @type {Object} */
                        const c = conditions[cond];
                        /** @type {*} */
                        const left = gateObj.module.get(cond);
                        /** @type {*} */
                        const right = (c.val && c.val.toString().match(valRegex)) ? gateObj.module.get(c.val.slice(1)) : c.val;
                        try {
                            if ((new Function('l', 'r', `return eval('l ${c.operator} r')`))(left, right)) {
                                count ++;
                            }
                        } catch (e) {
                            util.throw(e);
                        }
                    }
                    if (count === gateObj.vars.length) {
                        util.log(`Conditions [${gateObj.vars.join(',')}] met for "${gateObj.module.moduleName}".`, true);
                        /** @type {Array} */
                        const args = [];
                        for (let i = 0; i < gateObj.vars.length; i ++) {
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
                for (const gateKey in gateMap) {
                    if (! gateMap.hasOwnProperty(gateKey)) continue;
                    /** @type {Array} */
                    const split = gateKey.split('.');
                    if (split && split.length && split[split.length - 1] === key) {
                        self.unlock(gateKey, true);
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
         * @param {VarGate} context
         * @param {boolean=} stop
         */
        function addCallback(namespace, prop, fn, context, stop) {
            /** @type {string|null} */
            let key;
            /** @type {*} */
            let val;
            /** @type {string} */
            let operator;
            context = context || this;
            if (typeof gate[namespace] === 'undefined') {
                // Define the property if this is the first time--otherwise re-use the old definition
                gate[namespace] = {
                    /** @type {Array} */
                    vars: [],
                    /** @type {Object} */
                    cond: {},
                    /** @type {Function|Array} */
                    fn: fn,
                    /** @type {VarGate} */
                    module: this,
                    /** @type {VarGate|undefined} */
                    context: context
                };
            }
            if (Array.isArray(prop)) {
                if (prop.length === 2) {
                    key = `${util.guid()}:${prop[1].replace(/\./g, '-')}`;
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
                    util.throw(`Invalid number of arguments passed through: [${prop.join(',')}] (should be [key, operator, condition])`);
                }
            } else {
                key = prop;
                operator = '!==';
                val = undefined;
            }
            try {
                gate[namespace].vars.push(key);
                gate[namespace].cond[key] = {
                    /** @type {string} */
                    operator: operator,
                    /** @type {*} */
                    val: val
                };
                if (typeof gateMap[key] === 'undefined') {
                    gateMap[key] = {
                        /** @type {number} */
                        deps: 0,
                        /** @type {Object<string>} */
                        namespace: {}
                    };
                }
                gateMap[key].namespace[namespace] = true;
                gateMap[key].deps ++;
                if (key.indexOf('.') !== -1) {
                    subKeyWaitCount ++;
                }
            } catch (e) {
                util.throw(`Cannot set "${JSON.stringify(prop)}" as a property`);
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
                util.throw(`"${key}" set to 'undefined'. Was this intentional? Use 'unset("${key}")' if it was.`);
            }
        }
        /**
         * Used to prevent users from overriding a key without using a function meant to explicitly do so.
         * Only works when `window.DEV_MODE` is 'strict' or 'warn'
         * @param {string} key
         */
        function checkDefined(key) {
            //noinspection JSPotentiallyInvalidUsageOfThis
            if (! data[`${this.moduleName}.${key}`] && typeof parent.get(key) !== 'undefined' && ! util.squelch()) {
                // Not allowing sub-modules to name variables already defined in the parent (unless using override).
                // Things get weird when expecting a variable defined in two places.
                //noinspection JSPotentiallyInvalidUsageOfThis
                util.throw(`In "${this.moduleName}" variable "${key}" defined in module "${parent.moduleName}". Choose a different name.`);
            }
        }
        /**
         * Listens and marks when a property is available
         * @param {Object} object
         * @param {string} key
         * @param {string} fullKey
         * @param {VarGate} context
         */
        function assignNestedPropertyListener(object, key, fullKey, context) {
            /** @type {Array} */
            const pathArray = key.split('.');
            if (pathArray.length === 1 && typeof key === 'string') {
                // Sanitize `key`
                key = key.replace(/[^\w$]/g, '');
                if (object[key] === undefined) {
                    // Create a watch on the property, and run once it's been set
                    Object.defineProperty(object, key, {
                        /** @type {boolean} */
                        'configurable': true,
                        /** @param {*} val */
                        'set': function(val) {
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

        // Exports for Google Closure Compiler
        /** @type {VarGate|undefined} */
        this['parent'] = parent;
        /** @type {Object<VarGate>} */
        this['children'] = children;
        /** @type {Object} */
        this['data'] = data;
        /** @type {Object} */
        this['gate'] = gate;
        /** @type {Object} */
        this['gateMap'] = gateMap;
        /** @type {number} */
        this['subKeyWaitCount'] = subKeyWaitCount;
        /** @Function */
        this['register'] = this.register;
        /** @Function */
        this['new'] = this.new;
        /** @Function */
        this['on'] = this.on;
        /** @Function */
        this['when'] = this.when;
        /** @Function */
        this['set'] = this.set;
        /** @Function */
        this['override'] = this.override;
        /** @Function */
        this['unset'] = this.unset;
        /** @Function */
        this['get'] = this.get;
        /** @Function */
        this['clearAll'] = this.clearAll;
        /** @Function */
        this['unlock'] = this.unlock;
    }

    return VarGate;
});
