module.exports = function(grunt) {
  //'use strict';
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-mocha-test');

  grunt.initConfig({
    jshint: {
      options: {
        jshintrc: true
      },
      all: [
        '*.js',
        'lib/**/*.js',
        'tests/**/*.js''
      ]
    },
    mochaTest: {
      unit: {
        src: ['tests/unit/*.js']
      },
      integration: {
        options: {
          timeout: 300000
        },
        src: ['tests/int/*.js']
      }
    }
  });

  grunt.registerTask('test', 'Run tests.', [
    'jshint',
    'mochaTest:unit',
    'mochaTest:integration'
  ]);

  grunt.registerTask('default', 'test');

  grunt.registerTask('noint', 'skip integration tests', [
    'jshint',
    'mochaTest:unit'
  ]);

  grunt.registerTask('ci', 'default');
};
