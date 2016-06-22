### VarGate

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

When developing, it is recommended to set `window.DEBUG_MODE` to log errors into the console.

    window.DEBUG_MODE = 'strict'; // Errors will stop execution. Recommended for local development.
    window.DEBUG_MODE = 'warn';   // Errors will log, but execution will continue. Recommended for staging environments.

Without setting `window.DEBUG_MODE`, errors will be ignored, as it is assumed you are in a production environment.

When waiting on multiple variables to be defined

    VarGate.when(['oneVar', 'twoVar'], func);
    
When waiting on multiple variables to meet specific conditions

    VarGate.when([['oneVar', '===',  7], ['twoVar', '>', 4]], func);

When waiting on one variable to meet a specific condition (in this case, equaling another variable)

    VarGate.when([['oneVar', '===', '@twoVar']],  func);
    
Functions will only run once. To run a function every time data is changed, use the following:

    VarGate.on('someVar', func); // Will run every time `someVar` is set
    
This is just short-hand for the following:

    VarGate.when('someVar', [func, true]); // Will run every time `someVar` is set
    VarGate.when([['someVar', '===', 3]], [func, true]); // Will run every time `someVar` is set to 3
    VarGate.when(['someVar', 'anotherVar'], [func, true]); // Will run every time `someVar` and `anotherVar` are set

You can namespace sub-modules to avoid name conflicts

    var subGate = VarGate.register('subgate');
    subGate.set('someVar', someValue');
    var otherGate = VarGate.register('othergate');
    otherGate.set('someVar', anotherValue);
    console.log(subGate.get('someVar') == otherGate.get('someVar')); // prints `false`
    
The parent can get and set values for its children

    VarGate.set('subgate.value', anotherValue);
    VarGate.get('othergate.someVar');

Sub-modules can _only_ `get` values from the parent

    VarGate.set('value', 1);
    var subGate = VarGate.register('subgate');
    subGate.get('value'); // returns 1
    subGate.set('value', 3); // will error out if window.DEBUG_MODE = 'strict'
    subGate.get('value'); // returns 3
    VarGate.get('value'); // returns 1
