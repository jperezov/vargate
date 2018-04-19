define([
    './vars/global',
    './models/vargate'
], function(global, VarGate) {
    const Gate = new VarGate('vargate');
    if (typeof global['define'] === 'function' && global['define']['amd']) {
        // Remain anonymous if AMD library is available
        global['define'](function() {
            return Gate;
        });
    } else if (typeof global['module'] === 'object' && global['module']['exports']) {
        // Use CommonJS / ES6 if available
        global['module']['exports'] = Gate;
    } else {
        global['VarGate'] = Gate;
    }
});
