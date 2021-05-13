var db = null;
var Promise = require("bluebird");

exports.db = function() {
    if (db === null) {
        var url = 'https://{coudant_id}@{account_name}.cloudant.com',
            Cloudant = require('cloudant'),
            cloudant = Cloudant({url: url}),
            dbname = 'mobz';
        db = cloudant.db.use(dbname);
        Promise.promisifyAll(db);
    }
    return db;
};