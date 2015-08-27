// initialize_database relies on sequential failures to determine what step
// to take next, so it would not make sense in a transaction.
exports.initializeDatabase = function(pgsql, db) {
  var errs = ['Errors:'];
  var errToStr = function(error) {
    // push the error (or its string conversion if available)
    errs.push(error && error.toString && error.toString());
  };
  var clearTable = function() {
    return db.query(pgsql.clearTableContents());
  };
  var cannotCheckSyntax = function(s_err) {
    // assume the table is missing and try to create it.
    errToStr(s_err);
    return db.query(pgsql.createTable()).catch(cannotCreateTable);
  };
  var cannotCreateTable = function(c_err) {
    // assume the table is present, but the column is missing.
    errToStr(c_err);
    return db.query(pgsql.addColumnToTable()).catch(cannotAddColumn);
  };
  var cannotAddColumn = function(a_err) {
    // user intervention is required.
    errToStr(a_err);
    var msg = 'Could not initialize database.';
    var queries = ['Queries:', pgsql.checkTableSyntax(), pgsql.createTable(), pgsql.addColumnToTable()].join('\n');
    var errors = errs.join('\n');
    throw Error([msg, queries, errors].join('\n'));
  };

  return db.query(pgsql.checkTableSyntax())
           .then(clearTable, cannotCheckSyntax);
};
