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
        'libs/**/*.js',
        'tests/**/*.js',
        'spec/**/*.js'
      ]
    },
    mochaTest: {
      unit: {
        src: ['tests/**/*.js']
      },
      integration: {
        options: {
          timeout: 300000
        },
        src: ['spec/**/*.js']
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
