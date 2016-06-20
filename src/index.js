define([
    './models/vargate'
], function(VarGate) {
    var Gate = new VarGate('main');
    if (typeof define === 'function' && define.amd) {
        // Remain anonymous if AMD library is available
        define(function() {
            return Gate;
        });
    } else if (typeof module === 'object' && module.exports) {
        module.exports = Gate;
    } else {
        window.VarGate = Gate;
    }
});