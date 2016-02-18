var scrub = require('pg-format');

function getFromEnv() {
  var config = {};
  config.jsonTable = process.env.POSTGRESQL_TABLE;
  config.jsonCol = process.env.POSTGRESQL_COLUMN;
  return config;
}

exports.getFormDefinitionsXML = function() {
  var c = getFromEnv();
  // it is important (yet arbitrary) to name the field "form"
  return scrub('SELECT data->>\'_rev\' AS version, (%I #> \'{_attachments,xml,data}\') AS form FROM %I WHERE %I->>\'type\' = \'form\' AND %I->\'_attachments\' ? \'xml\';', c.jsonCol, c.jsonTable, c.jsonCol, c.jsonCol);
};

exports.putFormList = function(formlist) {
  // expect formlist to be of the format ['form1', 'form2', ...]
  formlist = formlist.map(function (formname) {
    return scrub('(%L)', formname);
  }).join(',');
  return 'DROP TABLE IF EXISTS form_list; CREATE TABLE form_list (name TEXT); INSERT INTO form_list VALUES ' + formlist;
};

exports.putFormViews = function(formdef) {
  // expects an obj of {
  //   'form1': {
  //     'fields': ['field1','field2',...],
  //     'version': 'x'
  //  },
  //  'form2':
  //    ...
  var manyQueries = '';
  Object.keys(formdef).forEach(function (formName) {
    var thisForm = formdef[formName];
    manyQueries += scrub('CREATE TABLE IF NOT EXISTS %I (',
                         'formview_' + formName + '_' + formdef[formName].version);
    var fields = thisForm.fields.map(function (attr) {
      return scrub('%I', attr) + ' TEXT';
    }).join(',');
    manyQueries += fields + ');';
  });
  return manyQueries;
};
