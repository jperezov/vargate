define([], function() {
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
        var callback = {};
        this.module = module;
        this.data = data;
        this.children = children;
        this.parent = parent;
        /**
         * Registers a child module, which will be able to access, but not set,
         * the data available for this module.
         * @param {string} module
         * @returns {VarGate}
         */
        this.register = function(module) {
            if (parent) {
                return parent.register.call(self, self.module + '.' + module);
            }
            children[module] = this.children[module] = new VarGate(module, this);
            return children[module];
        };
        function addCallback(prop, fn) {
            if (typeof gate[prop] === 'undefined') {
                gate[prop] = [];
            }
            if (prop.length) {
                try {
                    gate[prop[0]].push({
                        cond: prop[1],
                        fn: fn
                    });
                } catch (e) {
                    throw 'Invalid number of arguments passed through: [' + prop.join(',') + '] (should be two)';
                }
            } else {
                gate[prop].push(fn);
            }
        }
        this.when = function(vars, fn) {
            if (vars.length) {
                for (var v in vars) {
                    if (! vars.hasOwnProperty(v)) continue;
                    addCallback(v, fn);
                }
            } else {
                addCallback(vars, fn);
            }
        };
        /**
         * Sets a value for a given key within the current module.
         * Cannot overwrite keys set for the parent module.
         * @param key
         * @param val
         */
        this.set = function(key, val) {
            if (parent) {
                if (typeof this.get(key) !== 'undefined' && this.module !== self.module) {
                    throw 'Variable ' + key + ' defined in module ' + self.module + '. Choose a different name.';
                }
                parent.set.call(self, key, val);
            } else {
                if (this.module === self.module) {
                    data[key] = val;
                } else {
                    data[this.module + '.' + key] = val;
                }
                self.unlock(key);
            }
        };
        /**
         * Gets the data for a given key from the appropriate module
         * @param key
         * @returns {*}
         */
        this.get = function(key) {
            if (parent) {
                return parent.get.call(self, key);
            } else {
                if (this.module === self.module) {
                    return data[key];
                }
                return data[this.module + '.' + key];
            }
        };
        this.unlock = function(key) {
            //
        };
    }
    return VarGate;
});