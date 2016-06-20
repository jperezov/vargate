module.exports = function(grunt) {

    grunt.loadNpmTasks('intern');

    var pkg = grunt.file.readJSON('package.json');
    var year = (new Date).getFullYear();
    var headerComment = '/**!\n' +
                        ' * <%= pkg.name %> v<%= pkg.version %>\n' +
                        ' * Copyright (c) <%= year %> <%= pkg.author.name %>.\n' +
                        ' * Licensed under the <%= pkg.license %> License.\n' +
                        ' */\n';

    grunt.initConfig({
        pkg: pkg,
        requirejs: {
            compile: {
                options: {
                    baseUrl: "src",
                    name: "index",
                    out: "vargate.js",
                    //-----------------------------------------
                    // We have multiple minify steps
                    optimize: "none",
                    // Include dependencies loaded with require
                    findNestedDependencies: true,
                    // Avoid inserting define() placeholder
                    skipModuleInsertion: true,
                    // Avoid breaking semicolons inserted by r.js
                    skipSemiColonInsertion: true,
                    wrap: {
                        start: headerComment + "(function() {\n    \"use strict\";\n",
                        end: "}());"
                    },
                    rawText: {},
                    onBuildWrite: convert
                }
            }
        },
        uglify: {
            options: {
                banner: headerComment
            },
            dist: {
                files: {
                    'vargate.min.js': ['vargate.js']
                }
            }
        },
        jshint: {
            files: ['Gruntfile.js', 'src/**/*.js', 'test/**/*.js'],
            options: {
                // options here to override JSHint defaults
                globals: {
                    jQuery: false,
                    console: true,
                    module: true,
                    document: true
                }
            }
        }
    });


    /**
     * Strip all definitions generated by requirejs
     * Convert "var" modules to var declarations
     * "var module" means the module only contains a return
     * statement that should be converted to a var declaration
     * This is indicated by including the file in any "var" folder
     * @param {String} name
     * @param {String} path
     * @param {String} contents The contents to be written (including their AMD wrappers)
     */
    function convert(name, path, contents) {
        var rdefineEnd = /\}\s*?\);[^}\w]*$/;
        // Convert var modules
        if ( /.\/var\//.test( path ) ) {
            contents = contents
                .replace(/define\([\w\W]*?return/, "    var " + (/var\/([\w-]+)/.exec(name)[1]) + " =")
                .replace(rdefineEnd, "")
                .replace(/\/\*\*/, "    \/**")
                .replace(/\s\*\s/g, "     * ")
                .replace(/\s\*\//g, "     */");
        } else {
            contents = contents
                .replace(/\s*return\s+[^\}]+(\}\s*?\);[^\w\}]*)$/, "$1")
                // Multiple exports
                .replace(/\s*exports\.\w+\s*=\s*\w+;/g, "");

            // Remove define wrappers, closure ends, and empty declarations
            contents = contents
                .replace(/define\([^{]*?{/, "")
                .replace(rdefineEnd, "");

            // Remove anything wrapped with
            // /* ExcludeStart */ /* ExcludeEnd */
            // or a single line directly after a // BuildExclude comment
            contents = contents
                .replace(/\/\*\s*ExcludeStart\s*\*\/[\w\W]*?\/\*\s*ExcludeEnd\s*\*\//ig, "")
                .replace(/\/\/\s*BuildExclude\n\r?[\w\W]*?\n\r?/ig, "");

            // Remove empty definitions
            contents = contents
                .replace(/define\(\[[^\]]*\]\)[\W\n]+$/, "")
                .replace(/@VERSION/, pkg.version);
        }
        return contents;
    }

    grunt.loadNpmTasks('grunt-contrib-requirejs');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    //grunt.loadNpmTasks('intern');

    grunt.registerTask('test', [
        'jshint',
        'intern'
    ]);

    grunt.registerTask('default', [
        'requirejs',
        'uglify'
    ]);

};