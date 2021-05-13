// load the Cloudant library
var async = require('async'),
    url = 'https://{coudant_id}@{account_name}.cloudant.com',
    Cloudant = require('cloudant'),
    cloudant = Cloudant({url: url}),
    dbname = 'mobz',
    db = null,
    doc = null;

db = cloudant.db.use(dbname);

// create a database
var createDatabase = function(callback) {
    console.log("Creating database '" + dbname  + "'");
    cloudant.db.create(dbname, function(err, data) {
        console.log("Error:", err);
        console.log("Data:", data);
        db = cloudant.db.use(dbname);
        callback(err, data);
    });
};

// create a document
var createDocument = function(callback) {
    // console.log("Creating document 'mydoc'");
    // // we are specifying the id of the document so we can update and delete it later
    // db.insert({ _id: "mydoc", a:1, b: "two"}, function(err, data) {
    //     console.log("Error:", err);
    //     console.log("Data:", data);
    //     callback(err, data);
    // });
};

// read a document
var readDocument = function(callback) {
    console.log("Reading document");
    db.find({selector:{"type": "mob"}}, function(err, data) {
        console.log("Error:", err);
        console.log("Data:", data);

        console.log('Found %d mobz', data.docs.length);
        for (var i = 0; i < data.docs.length; i++) {
            console.log('  Name: %s', data.docs[i].name);
        }
        callback(err, data);
    });

    // console.log("Reading document 'mydoc'");
    // db.get("mydoc", function(err, data) {
    //     console.log("Error:", err);
    //     console.log("Data:", data);
    //     // keep a copy of the doc so we know its revision token
    //     doc = data;
    //     callback(err, data);
    // });
};

// update a document
var updateDocument = function(callback) {
    console.log("Updating document 'mydoc'");
    // make a change to the document, using the copy we kept from reading it back
    doc.c = true;
    db.insert(doc, function(err, data) {
        console.log("Error:", err);
        console.log("Data:", data);
        // keep the revision of the update so we can delete it
        doc._rev = data.rev;
        callback(err, data);
    });
};

// deleting a document
var deleteDocument = function(callback) {
    console.log("Deleting document 'mydoc'");
    // supply the id and revision to be deleted
    db.destroy(doc._id, doc._rev, function(err, data) {
        console.log("Error:", err);
        console.log("Data:", data);
        callback(err, data);
    });
};

// deleting the database document
var deleteDatabase = function(callback) {
    console.log("Deleting database '" + dbname  + "'");
    cloudant.db.destroy(dbname, function(err, data) {
        console.log("Error:", err);
        console.log("Data:", data);
        callback(err, data);
    });
};

async.series([readDocument]); //, updateDocument, deleteDocument, deleteDatabase]);