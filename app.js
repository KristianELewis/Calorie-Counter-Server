/*
TODO
-improve login functionality
    -signing up should log you in
-look over status responses
-test with postman
---------------------------------------------------
UUID
-error checking with uuid (make sure to fail gracefully if there are collisions)
----------------------------------------------------
*/
/*======================================================================================

EXPRESS CONFIG

======================================================================================*/
const cors = require('cors');
const bodyParser = require('body-parser');
//needed for TLS
//const fs = require('fs');
//const https = require('https');
const express = require('express');
const app = express()

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
//I had this set to false for some reason
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static("dist"))

const port = 3000
//const port = 443;

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
/*
https.createServer(
    {
      requestCert: true,
      rejectUnauthorized: false,
      cert: fs.readFileSync(certLocation),
      key: fs.readFileSync(keyLocation),
    },
    app
  )
  .listen(port, () => {
    console.log("started")
  });

//This redirects. Seems to work just as is
//https://stackoverflow.com/questions/7450940/automatic-https-connection-redirect-with-node-js-express
var http = require('http');
http.createServer(function (req, res) {
    res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
    res.end();
}).listen(80);
*/
const login = require("./routes/login.js")
app.use('/caloriecounter/login', login)

const databaseFood = require("./routes/database-food.js")
app.use('/caloriecounter/database-food', databaseFood)

const user = require("./routes/user/user.js")
app.use('/caloriecounter/user/:userID', user)
