var express = require("express");
var app = express();
var bodyParser = require('body-parser');
var MobModel = require('./models/mobModel');

app.set('port', (process.env.PORT || 5000));
app.use(bodyParser.json({limit: '5mb'}));
app.use(bodyParser.urlencoded({limit: '5mb', extended: true}));

var routes = require("./routes/routes.js")(app);

//initial load of mobs from database
app.mobs = {};
MobModel.fetch().then(function(results) {
    results.forEach(function(mob) {
        if (!app.mobs[mob.phone]) {
            app.mobs[mob.phone] = {};
        }
        app.mobs[mob.phone][mob.code] = mob;
    });
});

var server = app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});