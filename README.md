### VarGate

VarGate is an async library designed around data instead of files.
 
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

    VarGate.when(['someVar', 'anotherVar', 'aThirdVar'], function(someVar, anotherVar, aThirdVar) {
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

`VarGate` is compatible with AMD, ES6, and CommonJS modules. When no modules are present, it is exported to `window.VarGate`.

When waiting on multiple variables to be defined

    VarGate.when(['oneVar', 'twoVar'], func);
    
When waiting on multiple variables to meet specific conditions

    VarGate.when([['oneVar', '===',  7], ['twoVar', '>', 4]], func);

When waiting on one variable to meet a specific condition (in this case, equaling another variable)

    VarGate.when([['oneVar', '===', '%twoVar%']],  func); // Not sure if this works, so don't rely on this yet

You can namespace sub-modules to avoid name conflicts

    var subGate = VarGate.register('subgate');
    subGate.set('someVar', someValue');
    var otherGate = VarGate.register('othergate');
    otherGate.set('someVar', anotherValue);
    console.log(subGate.get('someVar') == otherGate.get('someVar')); // prints `false`
