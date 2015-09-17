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
        'test/unit/**/*.js',
        'test/integration/**/*.js'
      ]
    },
    mochaTest: {
      unit: {
        src: ['test/unit/**/*.js']
      },
      integration: {
        options: {
          timeout: 300000
        },
        src: ['test/integration/**/*.js']
      }
    }
  });

  grunt.registerTask('tests', 'Run tests.', [
    'jshint',
    'mochaTest:unit',
    'mochaTest:integration'
  ]);

  grunt.registerTask('default', 'tests');

  grunt.registerTask('ci', 'TravisCI tests', [
    'jshint',
    'mochaTest:unit'
  ]);
};
