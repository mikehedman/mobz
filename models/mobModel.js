var db = require('../dbConnection').db();
var constants = require('../constants');

var MobModel = function(doc) {
    
    this.document = doc;
    this._members = {};

    Object.defineProperty(this, 'id', {
        get: function() { return this.document._id; },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'phone', {
        get: function() { return this.document.phone; },
        set: function(newValue) { this.document.phone = newValue; },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'code', {
        get: function() { return this.document.code; },
        set: function(newValue) { this.document.code = newValue; },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'name', {
        get: function() { return this.document.name; },
        set: function(newValue) { this.document.name = newValue; },
        enumerable: true,
        configurable: true
    });

    Object.defineProperty(this, 'members', {
        get: function() { return this._members; },
        set: function(newValue) { this._members = newValue; },
        enumerable: true,
        configurable: true
    });
};

MobModel.prototype.isMember = function(userPhone) {
    return this._members[userPhone] ? true : false;
};

MobModel.prototype.isBoss = function(userPhone) {
    return this._members[userPhone].isBoss;
};

MobModel.prototype.getRoll = function() {
    var result = '';
    for (var memberPhone in this._members) {
        //add a linefeed if needed
        if (result != '') {
            result += '\n';
        }
        result += this._members[memberPhone].isBoss ? '* ' : ' ';
        result += memberPhone;
    }
    return result;
};

MobModel.prototype.addMember = function(userPhone, name, isBoss) {
    var member = {
        mobId: this.document._id,
        phone: userPhone,
        type: 'member',
        isBoss: isBoss ? true : false
    };

    if (name) {
        member.name = name;
        member.status = constants.ACTIVE;
    } else {
        member.name = '';
        member.status = constants.NO_NAME;
    }

    this._members[userPhone] = member;
    return this.insert(member);
};

MobModel.prototype.removeMember = function(memberPhone) {
    return db.destroyAsync(this._members[memberPhone]._id, this._members[memberPhone]._rev).then(function() {
        delete this._members[memberPhone];
    });
};

MobModel.prototype.addMemberName = function(memberPhone, name) {
    this._members[memberPhone].status = constants.ACTIVE;
    this._members[memberPhone].name = name;
    return this.update(this._members[memberPhone]);
};

MobModel.prototype.close = function() {
    //mark all the members as archived
    var memberArray = [];
    for (var memberPhone in this._members) {
        this._members[memberPhone].type = 'archivedMember';
        memberArray.push(this._members[memberPhone]);
    }
    db.bulkAsync(memberArray);
    this.document.type = 'archivedMob';
    return this.update(this.document);
};

/**
 * insert the model into the database
 * @param {object} doc The document to insert, will use this.doc if not specified
 * @returns {Promise}
 */
MobModel.prototype.insert = function(doc) {
    doc = doc || this.document;
    return db.insertAsync(doc).then(function(newDoc) {
        doc._id = newDoc.id;
        doc._rev = newDoc.rev;
    }).catch(function(e) {
        console.error(e.stack);
    });
};

/**
 * Update the item in the database
 * @param {object} doc The document to insert, will use this.doc if not specified
 * @returns {Promise}
 */
MobModel.prototype.update = function(doc) {
    return db.insertAsync(doc).then(function(newDoc) {
        doc._rev = newDoc.rev;
    }).catch(function(e) {
        console.error(e.stack);
    });
};

/**
 * Fetches the objects from the database
 * @returns Promise that will be resolved with an array of mobs
 */
MobModel.fetch = function() {
    return db.viewAsync('mobz', 'mobz_and_members').then(function(result) {
        var mobs = [];
        var mob;
        var doc;
        result.rows.forEach(function(row) {
            doc = row.value;
            if (doc.type == 'mob') {
                mob = new MobModel(doc);
                mobs.push(mob);
            } else {
                if (doc.mobId == mob.id) {
                    mob.members[doc.phone] = doc;
                } else {
                    console.log('got an unaffiliated member: ' + JSON.stringify(doc));
                }
            }
        });
        return mobs;
    }).catch(function(e) {
        console.error(e.stack);
    });
};
    
/**
 * Fetches an entity from the database
 * @param {string} objectId The id of the entity
 * @returns Promise that will be resolved with the desired entity
 * TODO - need to specify what will be returned if an invalid id is provided
 */
MobModel.fetchById = function(objectId) {
    return db.getAsync(objectId).then(function(doc) {
        return new MobModel(doc);
    }).catch(function(e) {
        console.error(e.stack);
    });
};

module.exports = MobModel;