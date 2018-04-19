define([
    './vars/window',
    './models/vargate'
], function(window, VarGate) {
    const Gate = new VarGate('vargate');
    if (typeof window['define'] === 'function' && window['define']['amd']) {
        // Remain anonymous if AMD library is available
        window['define'](function() {
            return Gate;
        });
    } else if (typeof window['module'] === 'object' && window['module']['exports']) {
        // Use CommonJS / ES6 if available
        window['module']['exports'] = Gate;
    } else {
        window['VarGate'] = Gate;
    }
});
