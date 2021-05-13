var twilio = require('twilio')('{twilio_sid}', '{twilio_tkn}');
var async = require('async');
var twilioPhone = '{your_twilio_phone}}';
var MobModel = require('../models/mobModel');
var constants = require('../constants');

var appRouter = function(app) {
    app.get("/", function(req, res) {
        res.send("Hello World");
    });

    /**
     *
     * @param parts
     * @param userPhone
     * @param warning
     * @param {boolean} hasOptionalArgument
     * @returns {null | array} null if not enough arguments, or the an array of arguments, with the last one possibly having spaces
     */
    function getCommandArguments(parts, userPhone, warning, hasOptionalArgument) {
        //get rid of the command
        parts.shift();

        hasOptionalArgument = hasOptionalArgument || false;
        if (parts.length == 0) {
            sendSMS(userPhone, warning);
            return null;
        } else {
            var arguments = [];
            if (hasOptionalArgument) {
                arguments.push(parts.shift());
                if (parts.length > 0) {
                    arguments.push(parts.join(' '));
                }
            } else {
                //if there are no optionals, then the required argument can have spaces
                arguments.push(parts.join(' '));
            }
            return arguments;
        }
    }

    function sendSMS(toPhone, content, images, callback) {
        var message =                 {
            to: toPhone,
            from: twilioPhone,
            body: content
        };
        if (images && images.length > 0) {
            message.mediaUrl = images;
        }
        return twilio.sendMessage(message, function(err, responseData) {
            if (err) {
                if (callback) {
                    callback(err);
                }
                console.log('err: ' + JSON.stringify(err));
            }
        });
    }

    function sendToAllMembers(mob, content, excludePhone) {
        for (var memberPhone in mob.members) {
            if (memberPhone != excludePhone) {
                sendSMS(memberPhone, content);
            }
        }
    }

    /**
     * Find what mob a user's phone number is associated with
     * @param mobPhone The main Twilio phone number for the mob
     * @param userPhone The member's phone number
     * @returns {MobModel} The mob, or null if not found
     */
    function findMob(mobPhone, userPhone) {
        for (var code in app.mobs[mobPhone]) {
            if (app.mobs[mobPhone][code].members[userPhone]) {
                return app.mobs[mobPhone][code];
            }
        }
        //if if got here, the userPhone is not a member of any mobs
        return null;
    }

    function isValidMobPhone (mobPhone) {
        if (!app.mobs[mobPhone]) {
            console.log('Got a request refering to an unknown Twilio number: ' + mobPhone);
            return false;
        } else {
            return true;
        }
    }

    //determine if we've received a command
    function processCommand(req) {
        var content = req.body.Body;
        var userPhone = req.body.From;
        var mobPhone = req.body.To;
        var mob;
        var parts = content.split(' ');
        var commandArguments;
        switch(parts[0].substring(1).toLowerCase()) {
            case 'close':
            case 'c':
                if (!isValidMobPhone(mobPhone)) {
                    sendAcknowlegement(res);
                    return;
                }
                mob = findMob(mobPhone, userPhone);
                if (mob != null) {
                    if (mob.isBoss(userPhone)) {
                        commandArguments = getCommandArguments(parts, userPhone, 'The /close command must be followed by a space and a code number. Your current code is: ' + mob.code, true);
                        if (commandArguments != null) {
                            var codeToClose = commandArguments[0];
                            if (codeToClose == mob.code) {
                                sendToAllMembers(mob, "The '" + mob.name + "' group has been closed.  Use the /start command to create a new group.");
                                mob.close().then(function() {
                                    delete app.mobs[mobPhone][mob.code];
                                });
                            } else {
                                sendSMS(userPhone, "Sorry, you're not a member of that group.");
                            }
                        }
                    } else {
                        sendSMS(userPhone, "Sorry, only bosses can use the close command");
                    }
                }
                break;

            case 'help':
            case 'h':
            case '?':
                //todo, see if there's a command argument, and give details about the specific command
                sendSMS(userPhone, "All commands start with a slash. /start {description} creates new group. /invite {phone} sends invitation. /join {code} {your name} joins you to the group. /quit leave the group. /name {name} set your name. For group organizers only: /close {code} closes the group, /roll lists members.");
                break;

            case 'invite':
            case 'i':
                if (!isValidMobPhone(mobPhone)) {
                    sendAcknowlegement(res);
                    return;
                }
                commandArguments = getCommandArguments(parts, userPhone, 'The /invite command must be followed by a space and phone number');
                if (commandArguments != null) {
                    var inviteePhone = commandArguments[0];
                    mob = findMob(mobPhone, userPhone);
                    if (mob != null) {
                        if (mob.members[userPhone].status != constants.ACTIVE) {
                            sendSMS(userPhone, "Can't invite others just yet since your account is not active. Please send the /name {your name} command if you haven't yet.");
                        } else {
                            var sender = mob.members[userPhone];
                            sendSMS(inviteePhone, sender.name + " at " + userPhone + " has invited you to a group text through the 'Mobz' service.  Just reply to this message with the following, and you're in: '/join " + mob.code + " {your name}'", null, function(err) {
                                sendSMS(userPhone, "Something went wrong with your invite to " + inviteePhone + ".  Error: " + err.message);
                            });
                        }
                    }
                }
                break;

            case 'join':
            case 'j':
                if (!isValidMobPhone(mobPhone)) {
                    sendAcknowlegement(res);
                    return;
                }
                commandArguments = getCommandArguments(parts, userPhone, 'The /join command must be followed by a space and a code number, and then optionally, another space and your name.', true);
                if (commandArguments != null) {
                    var code = commandArguments[0];

                    if (!app.mobs[mobPhone][code]) {
                        sendSMS(userPhone, "Sorry, I don't know that code.  Join messages are entered like this: /join 12345");
                    } else {
                        var name;
                        if (commandArguments.length > 1) {
                            name = commandArguments[1];
                        }
                        if (code != null && isValidMobPhone(mobPhone)) {
                            mob = app.mobs[mobPhone][code];
                            mob.addMember(userPhone, name);
                            if (name) {
                                sendSMS(userPhone, "Thanks, " + name + ". You are good to go! Whatever you text to this number will go out to all the other members. Text /help to get a list of additional commands.");
                                sendToAllMembers(mob, "New member! " + name + " has joined the " + mob.name + " group", userPhone);
                            } else {
                                sendSMS(userPhone, "You have successfully joined!  Please send a /name command next, like this:  /name Chris");
                            }
                        }
                    }
                }
                break;

            case 'name':
            case 'n':
                if (!isValidMobPhone(mobPhone)) {
                    sendAcknowlegement(res);
                    return;
                }
                mob = findMob(mobPhone, userPhone);
                if (mob != null) {
                    commandArguments = getCommandArguments(parts, userPhone, 'The /name command must be followed by a space and your name.');
                    if (commandArguments != null) {
                        var name = commandArguments[0];
                        mob.addMemberName(userPhone, name);
                        sendSMS(userPhone, "Thanks, " + name + ". You are good to go! Whatever you text to this number will go out to all the other members. Text /help to get a list of additional commands.");
                        sendToAllMembers(mob, "New member! " + name + " has joined the " + mob.name + " group", userPhone);
                    }
                }
                break;

            case 'purge':
                twilio.messages.list({'DateSent<': '2016-05-10'}, function(err, data) {
                    data.messages.forEach(function(message) {

//this listing doesn't seem to work, it skipped the image in MM86494d1d1ad74e07a2846283b721ba30
// of https://media.twiliocdn.com/ACb1d778dc36dcfc676b30e63ce75cd5e0/65d22913d20bd3248e23d0b451ebca56?Signature=AwMILx3XOplG8cBv7Yg29NxF9Zw%3D&AWSAccessKeyId=ASIAJFY63YXYULHFW6WQ&Expires=1463638190&x-amz-security-token=FQoDYXdzELb%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaDHfrWi2KpvDkAlHG8CKZAxW8voXMVze03EgEVPAXeWW3HhEoRRanNB1Q3EB9enzmyH33CDI0wU5Q3%2ByDp9BtEvYah5rlQhJbDTcE%2FHF6FZnbsh4eBBkpf3tvkEd%2Fj1Y1EUmItu4VExJ269aV16mP2Er7mBpjo0UMGULa86G7BiMsTRwSdhH%2BfPaOhwe2FQtpiMYtsgMKxZOj2A96hTzdqDHU4gxXfvge5mB87X3S88WX5n3skwAiHTSRccij%2F32GVHsmgtcIL7j2Lkx1SqD9arUbXY2wKTXXCair22fBlCSgX%2FuaxbhygiKzdh2QssE87sHWpJ0fA%2FPVtuFTe32FhS4chvndwLdZkqczgTXaWS1JfPhozwK3skKnBu%2FWmt6vewYPQTGC9lBQHUifxTBVLdIlXLA4vP2V77oyeadB4Ty0%2BOoXo%2BAEm2hqnV627Yy%2Ba2lnNOFbzB7Ay%2FiM5t66E77YEQnGmT6ANL2Xo53xhcSahKQo7CuFCi8dkAjf3KhccY8vzX3mZ3t8N8yHUwhkbihkLj0Bh0tRpmeOvZ8%2F3FWDxVOjAmFuQkYooOfvuQU%3D
                        twilio.messages(message.sid).media.list(function(err, data) {
                            if (data) {
                                data.mediaList.forEach(function(media) {
                                    twilio.messages(message.sid).media(media.sid).delete(function(err, data) {
                                        if (err) {
                                            console.log(err.status);
                                        } else {
                                            console.log(media.sid + " Sid deleted successfully.");
                                        }
                                    });
                                    //console.log(media.ContentType);
                                });
                            }
                        });
                        twilio.messages(message.sid).delete(function(err, data) {
                            if (err) {
                                console.log(err.status);
                            } else {
                                console.log(message.sid + " Message sid deleted successfully.");
                            }
                        });
                        // console.log(message.body);
                    });
                });
               // sendSMS(userPhone, "All commands start with a slash. /start {description} creates new group. /invite {phone} sends invitation. /join {code} {your name} joins you to the group. /quit leave the group. /name {name} set your name. For group organizers only: /close {code} closes the group, /roll lists members.");
                break;

            case 'quit':
            case 'q':
                if (!isValidMobPhone(mobPhone)) {
                    sendAcknowlegement(res);
                    return;
                }
                mob = findMob(mobPhone, userPhone);
                if (mob != null) {
                    mob.removeMember(userPhone);
                    sendSMS(userPhone, "You have left '" + mob.name + "'");
                }
                break;

            case 'rollcall':
            case 'roll':
            case 'r':
                if (!isValidMobPhone(mobPhone)) {
                    sendAcknowlegement(res);
                    return;
                }
                mob = findMob(mobPhone, userPhone);
                if (mob != null) {
                    if (mob.isBoss(userPhone)) {
                        sendSMS(userPhone, mob.getRoll());
                    } else {
                        sendSMS(userPhone, "Sorry, only bosses can get the member roll");
                    }
                }
                break;

            case 'start':
            case 's':
                commandArguments = getCommandArguments(parts, userPhone, 'The /start command must be followed by a space and a group name.');
                if (commandArguments != null) {
                    var mobName = commandArguments[0];
                    var code = 'm' + (parseInt((Math.random() * (9999 - 1000 + 1)), 10) + 1000);
                    var mobModel = new MobModel(
                        {
                            type: "mob",
                            name: mobName,
                            code: code,
                            phone: mobPhone
                        }
                    );
                    mobModel.insert().then(function() {
                        if (!app.mobs[mobPhone]) {
                            app.mobs[mobPhone] = {};
                        }
                        app.mobs[mobPhone][code] = mobModel;
                        //add in the mob boss's member entry
                        mobModel.addMember(userPhone, null, true);
                        sendSMS(userPhone, "Congratulations, your Mob is ready to go. Your invite code is '" + code + "'.  Please send a /name command next!");
                    }).catch(function(err) {
                        console.log("Error creating mob: ", err);
                    });
                }
                break;

            default:
        }
    }

    app.post("/sms", function(req, res) {
        if (req && req.body && req.body.From && req.body.To && (req.body.Body || req.body.MediaUrl0)) {
            var mobPhone = req.body.To;
            //determine if we've received a command
            if (req.body.Body.charAt(0) == '/') {
                processCommand(req, res);
            } else {
                if (!isValidMobPhone(mobPhone)) {
                    sendAcknowlegement(res);
                    return;
                }
                var userPhone = req.body.From;

                //figure out what mob this user is a member of
                mob = findMob(mobPhone, userPhone);
                if (mob === null) {
                    sendAcknowlegement(res);
                    return;
                }
                
                //make sure they're active
                if (mob.members[userPhone].status != constants.ACTIVE) {
                    sendSMS(userPhone, mob.members[userPhone].status);
                    sendAcknowlegement(res);
                    return;
                }

                //the sender is a member of a mob, now get their name
                var userName = mob.members[userPhone].name;

                //assemble the outgoing message
                var message = {
                    from: twilioPhone, // A number you bought from Twilio and can use for outbound communication
                    body: req.body.Body ? userName + ': ' + req.body.Body : 'From: ' + userName
                };
                //collect any images and bundle them into an array to include in the message
                var images = [];
                for (var i = 0; i <= 9; i++) {
                    if (req.body['MediaUrl' + i]) {
                        images.push(req.body['MediaUrl' + i]);
                    } else {
                        break;
                    }
                }
                if (images.length > 0) {
                    message.mediaUrl = images;
                }

                //send the message to all the members
                var member;
                for (var memberPhone in mob.members) {
                    if (memberPhone == userPhone) {
                        //don't send to the originator
                        continue;
                    }
                    member = mob.members[memberPhone];
                    if (member.status = constants.ACTIVE) {
                        message.to = memberPhone;
                        twilio.sendMessage(message,
                            function(err, responseData) {
                                if (err) {
                                    console.log('err: ' + JSON.stringify(err));
                                }
                            }
                        );
                    }
                }
            }

        }
        sendAcknowlegement(res);
    });

    function sendAcknowlegement(res) {
        res.send('<?xml version="1.0" encoding="UTF-8"?> <Response></Response>');
    }

    function getSender(senderPhone, callback) {
        db.find({selector:{"type": "person", "phone": senderPhone}}, function(err, data) {
            if (err) {
                throw err;
            }

            for (var i = 0; i < data.docs.length; i++) {
                console.log('  Name: %s', data.docs[i].name);
            }
            callback(err, data);
        });
    }
};

module.exports = appRouter;

// // create a database
// var createDatabase = function(callback) {
//     console.log("Creating database '" + dbname  + "'");
//     cloudant.db.create(dbname, function(err, data) {
//         console.log("Error:", err);
//         console.log("Data:", data);
//         db = cloudant.db.use(dbname);
//         callback(err, data);
//     });
// };
//
//
// // read a document
// var readDocument = function(callback) {
//     console.log("Reading document");
//     db.find({selector:{"type": "mob"}}, function(err, data) {
//         console.log("Error:", err);
//         console.log("Data:", data);
//
//         console.log('Found %d mobz', data.docs.length);
//         for (var i = 0; i < data.docs.length; i++) {
//             console.log('  Name: %s', data.docs[i].name);
//         }
//         callback(err, data);
//     });
//
//     console.log("Reading document 'mydoc'");
//     db.get("mydoc", function(err, data) {
//         console.log("Error:", err);
//         console.log("Data:", data);
//         // keep a copy of the doc so we know its revision token
//         doc = data;
//         callback(err, data);
//     });
// };
//
// // update a document
// var updateDocument = function(callback) {
//     console.log("Updating document 'mydoc'");
//     // make a change to the document, using the copy we kept from reading it back
//     doc.c = true;
//     db.insert(doc, function(err, data) {
//         console.log("Error:", err);
//         console.log("Data:", data);
//         // keep the revision of the update so we can delete it
//         doc._rev = data.rev;
//         callback(err, data);
//     });
// };
//
// // deleting a document
// var deleteDocument = function(callback) {
//     console.log("Deleting document 'mydoc'");
//     // supply the id and revision to be deleted
//     db.destroy(doc._id, doc._rev, function(err, data) {
//         console.log("Error:", err);
//         console.log("Data:", data);
//         callback(err, data);
//     });
// };