### VarGate
[![npm version](https://img.shields.io/npm/v/vargate.svg?style=flat-square)](https://www.npmjs.com/package/vargate) [![npm downloads](https://img.shields.io/npm/dm/vargate.svg?style=flat-square)](https://www.npmjs.com/package/vargate)

VarGate is an async library designed around data instead of files.

### Including VarGate

#### Browser

    <script src="path/to/vargate.min.js"></script>

VarGate is now available via `window.VarGate`.

#### Node

Run `npm install vargate --save-dev`.

If using ES6:

    import VarGate from "vargate";

CommonJS:

    var VarGate = require('vargate');

AMD:

    define(['vargate'], function(VarGate) {

    });

### Overview

Think of VarGate as RequireJS for variables instead of files. It turns this:

    // jQuery used for brevity. This is not a jQuery library
    var someVar, anotherVar, aThirdVar;
    $.get('/some-endpoint')
        .done(function(resp) {
            someVar = resp.data;
            return $.get('/another-endpoint');
        }).done(function(resp) {
            anotherVar = resp.data;
            return $.get('/a-third-endpoint');
        }).done(function(resp) {
            aThirdVar = resp.data;
            console.log("I have some " + someVar + ", as well as some " + anotherVar + " and " + aThirdVar + ".");
        });

into this:

    VarGate.when([
        'someVar',
        'anotherVar',
        'aThirdVar'
    ], function(someVar, anotherVar, aThirdVar) {
        console.log("I have some " + someVar + ", as well as some " + anotherVar + " and " + aThirdVar + ".");
    });
    $.get('/some-endpoint', function(resp) {
        VarGate.set('someVar', resp.data);
    });
    $.get('/another-endpoint', function(resp) {
        VarGate.set('anotherVar', resp.data);
    });
    $.get('/a-third-endpoint', function(resp) {
        VarGate.set('aThirdVar', resp.data);
    });

### Usage

When developing, it is recommended to set `window.DEBUG_MODE` and `window.DEV_MODE`.

    window.DEV_MODE = 'strict'; // Errors will stop execution. Recommended for local development.
    window.DEV_MODE = 'warn';   // Errors will log, but execution will continue. Recommended for staging environments.
    window.DEBUG_MODE = 'verbose'; // Will log the trace of every action
    window.DEBUG_MODE = 'static'; // Same as verbose, but prints a static copy of the values passed through
    window.DEBUG_MODE = 'minimal'; // Will only log `VarGate.set` actions

Without setting `window.DEV_MODE`, errors will be ignored, as it is assumed you are in a production environment.
Likewise, not setting `window.DEBUG_MODE` will silence the log statements from VarGate.

When waiting on a single variable to be defined

    VarGate.when('oneVar', func);

When waiting on multiple variables to be defined

    VarGate.when(['oneVar', 'twoVar'], func);

When waiting on multiple variables to meet specific conditions, follow the convention `[key, operator, value]`

    VarGate.when([['oneVar', '===',  7], ['twoVar', '>', 4]], func);

When waiting on one variable to meet a specific condition (in this case, equaling another variable)

    VarGate.when([['oneVar', '===', '@twoVar']],  func);

Functions will only run once. To run a function every time data is changed, use the following:

    VarGate.on('someVar', func); // Will run every time `someVar` is set
    VarGate.on([['someVar', '===', 3]], func); // Will run every time `someVar` is set to 3
    VarGate.on(['someVar', 'anotherVar'], on); // Will run every time `someVar` and `anotherVar` are set

To un-set a variable, just do `VarGate.unset('someVar')`, which will set the variable to `undefined`.

To clear all data in a given module, use `VarGate.clear()`. Note that this will not clear sub-modules.

To clear all data in a given module, _as well as all sub-modules_, use `VarGate.clearAll()`.

You can namespace sub-modules to avoid name conflicts

    var subGate = VarGate.register('subgate');
    subGate.set('someVar', someValue');
    var otherGate = VarGate.register('othergate');
    otherGate.set('someVar', anotherValue); // will error out if window.DEV_MODE == 'strict'
    console.log(subGate.get('someVar') == otherGate.get('someVar')); // prints `false`

The parent can get and set values for its children

    VarGate.set('subgate.value', anotherValue);
    VarGate.get('othergate.someVar');

Sub-modules can _only_ `get` values from the parent

    VarGate.set('value', 1);
    var subGate = VarGate.register('subgate');
    subGate.get('value'); // returns 1
    subGate.set('value', 3); // will error out if window.DEV_MODE == 'strict'
    subGate.get('value'); // returns 3
    VarGate.get('value'); // returns 1

To override a value set in a parent module, use the `override` function:

    var subGate = VarGate.register('subgate');
    VarGate.set('val', 3);
    subGate.override('val', 'ten'); // will not error out!
    subGate.get('val'); // returns 'ten'
    VarGate.get('val'); // returns 3
