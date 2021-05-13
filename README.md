Mobz is a Twilio based group messaging system where everything happens via SMS messages.

This was a hobby project built to help out my son's Scout troop - it is NOT production ready!!
There are a number of places where I had hard-coded credentials, I've replaced them like: {account_id}. Check in dbConnection.js, dbTest.js, and routes/routes.js.


Running:
$ npm start
or
$ node-debug app.js

Start Mongo
$ mongod

Start ngrok
$ ~/dev/ngrok http 5000  
copy the URL into the number page in twilio, and remember to add the '/sms' at the end!:
   http://0a0a4567.ngrok.io/sms