/*
TODO

-sort out userID username nonsense

-improve login functionality
    -signing up should log you in

-add rendered react stuff

-need to organize, and separate into diffedrent files

-make api restful

-look over status responses

-come up with generic success reponse to replace the old error system
    -the old error responses are still being sent, should not cause issues but is unecessary and should be removed
    -perhaps just send apropriate 200 status responses and any necessary data

-test authentication responses with postman

POTENTIAL TODO
-add express router

---------------------------------------------------

MYSQL STUFF
-add email
-connecting over encrypted connection(integrates easily with rds)
-is userID necessary
    -furthermore, am I useing userID or username for stuff?
    -it seems like Im using userID as the variable name but username for actual value? whats going on here?

PREPARED STATMENTS

CONNECTION POOL

CORS
-remove this?

UUID
-error checking with uuid (make sure to fail gracefully if there are collisions)

ERRORS
-really need to switch over to using statuses rather than sending the weird custom errors
    -almost complete


-should implement rate limiting on aws side, theres a http code for that
----------------------------------------------------
*/

/*======================================================================================

DOTENV config

======================================================================================*/
require('dotenv').config()

const dbHost = process.env.DBHOST
const dbUser = process.env.DBUSER
const dbPassword = process.env.DBPASSWORD
const database = process.env.DATABASE
const jwtSecret = process.env.JWTSECRET
const certLocation = process.env.CERT
const keyLocation = process.env.KEY




/*======================================================================================

EXPRESS CONFIG

======================================================================================*/


const cors = require('cors');
const bodyParser = require('body-parser');
const uuid = require('uuid');

//needed for TLS
const fs = require('fs');
const https = require('https');

const express = require('express');

const app = express()



const path = require('path'); //needed for the path stuff

app.use(cors());
app.use(express.json());
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

//app.use(express.static("dist"))

const port = 3000

/*
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
*/

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


/*======================================================================================
MULTER

multer is used for processing file uploads. 

only profile pictures are uploaded at the moment
TODO

//probably should make sure they are pictures
//this needs to change to make the filename something else
//check if req.params exists
======================================================================================*/

const multer = require('multer')
//const upload = multer({ dest: 'uploads/' })

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'profilePictures/')
    },
    filename: function (req, file, cb) {
      //const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      //cb(null, file.fieldname + '-' + uniqueSuffix + '.png')
      //console.log(req.body)
      cb(null, req.params.userID + '.png')

    }
  })
  
  const upload = multer({ storage: storage })


/*================================================
authentication/ authorization

bcrypt to has passwords
jwt for authentication

Needd to make sure the expiration date will auto fail it, if not I need to check it for validity
=================================================*/

const bcrypt = require('bcrypt');
const saltRounds = 12;

const jwt = require('jsonwebtoken');

//511 for missing token  No it shouldnt
//403 should be returned if userID does not match token
const authMiddleware = (req, res, next) => {
    const userID = req.params.userID
    const auth = req.get('authorization')

    if(!auth)
    {
        //this will be if auth is undefined, in other words there is no authroization header included in the request
        res.status(403).send({message: "Need authorization"})
        return
    }

    const [bearer_, token] = auth.split(" ");

    if(bearer_ != "Bearer")
    {
        //the authroization header was not formed correctly
        res.status(403).send({message: "Need authorization"})
        return
    }

    jwt.verify(token, jwtSecret, function(err, decoded) {

        //if token has expired
        if(err) {
            if (err.name === "TokenExpiredError"){
                res.status(403).send({message: "Session expired"})
            }
            return
        }

        if(decoded.userID === userID)
        {
            next();
        }
        else if (decoded.userID != userID)
        {
            res.status(403).send({message: "unauthorized access"})
        }
    });

}

/*================================================

CONNECTION POOL
-If the connection failed, the user needs to be told

=================================================*/

//mysql stuff
const mysql = require('mysql2/promise')

const connection = mysql.createPool({
    host: dbHost,
    user: dbUser,
    password: dbPassword,
    database: database,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10, // max idle connections, the default value is the same as `connectionLimit`
    idleTimeout: 60000, // idle connections timeout, in milliseconds, the default value 60000
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });

/*================================================
LOGIN

-need to make sure usernames are unique
  -I think I've satisfied this now

-token login may change
-creating a jwt should maybe be a utility function which could be used by both userLogin and signup
=================================================*/

//token login
app.post('/login/token/:userID', authMiddleware, (req, res) => {
    const userID = req.params.userID

    connection.execute(`SELECT userID, username, password, name, profilePicture, age, weight FROM users WHERE userID= ?`, [userID])
    .then(result => {
        if (result[0].length === 0){
            //this really should never happen
            res.send({userID: "notFound"})
        }
        else{
            const response = {
                userID : result[0][0].userID,
                username: result[0][0].username,
                name: result[0][0].name,
                profilePicture : result[0][0].profilePicture,
                age : result[0][0].age,
                weight : result[0][0].weight,
            }
            res.send(response)
        }
    })
})


//The lack of error handling is causing issues here
app.post('/login', (req, res) => {
    const username = req.body.username
    const password =  req.body.password
        //create better object for return value
    connection.execute(`SELECT userID, username, password, name, profilePicture, age, weight FROM users WHERE username= ?`, [username])
    .then(result => {
        if (result[0].length === 0){
            res.send({userID: "notFound"})
        }
        else{
            bcrypt.compare(password, result[0][0].password, function(err, hresult) {
                if(hresult === true){
                    const token = jwt.sign({username: result[0][0].username, userID : result[0][0].userID}, jwtSecret, { expiresIn: '1d' });
                    const response = {
                        userID : result[0][0].userID,
                        username: result[0][0].username,
                        name: result[0][0].name,
                        profilePicture : result[0][0].profilePicture,
                        age : result[0][0].age,
                        weight : result[0][0].weight,
                        token : token
                    }
                    res.send(response)
                }
                else{
                    res.send({userID: "notFound"})
                }
            })
        }
    })
    .catch(err => {console.log(err)})
})




/*==========================================================================
Sign up

Should not accept any empty inputs, should return an error

TODO

-should give a jwt for a new sessions for the user, so they can auto login
-generic 400 status code will be used
-needs more validiation, no spaces, no letters for number, things like that
==========================================================================*/
//not sure how else to handle this
const verifySignup = (req, res, next) => {
    if(req.body.userData === undefined)
    {
        res.send({error: true, errorType : "No information sent"})
    }
    else if(req.body.userData.username === undefined || req.body.userData.username === '')
    {
        res.send({error: true, errorType : "No username sent"})
    }
    else if(req.body.userData.password === undefined || req.body.userData.password === '')
    {
        res.send({error: true, errorType : "No password sent"})
    }
    else if(req.body.userData.name === undefined || req.body.userData.name === '')
    {
        res.send({error: true, errorType : "No name sent"})
    }
    else if(req.body.userData.age === undefined || req.body.userData.age < 1)
    {
        res.send({error: true, errorType : "No age sent"})
    }
    else if(req.body.userData.weight === undefined || req.body.userData.weight < 1)
    {
        res.send({error: true, errorType : "No weight sent"})
    }
    else 
    {
        next();
    }
}
app.post('/signup', verifySignup, async function (req, res, next) {
    
    const userID = uuid.v4();
    const username = req.body.userData.username
    const password = req.body.userData.password
    const hash = bcrypt.hashSync(password, saltRounds);
    const name = req.body.userData.name;
    const weight = req.body.userData.weight;
    const age = req.body.userData.age;

    //I can do this differently, dont need await probably
    //can probably get rid of "const mealQuery" as well
    //const mealQuery = await 
    connection.execute(`INSERT INTO users(userID, username, password, name, profilePicture, weight, age) VALUES (?, ?, ?, ?, FALSE, ?, ?)`,
        [userID, username, hash, name, weight, age])
    .then((response)=> {
        //should create a jwt and send it back to the users so they will auto log in
        res.send({error: false})
    })
    .catch(err => {
        if(err.code === "ER_DUP_ENTRY")
        {
            res.send({error: true, errorType: "Username already in use"})
        }
        else{
            //Getting wrong value for field here, could potentially use this for validating input, but probably should not be contacting the sql server
            //console.log(err)
            res.send({error: true, errorType: "Server side error. Try again later."})
        }
    })
})

/*==========================================================================
Get Daily Information

TODO
-if an inccorect date paramter is sent, it will probably cause an error sepcific to that
-this should never happen in the app, but for api reasons this should be accounted for

==========================================================================*/
app.get('/user/:userID/date/:date', authMiddleware, (req, res) => {
    connection.execute(
        `SELECT name, loggedID, calories, protein, fat, carbs, amount, meal 
            FROM loggedMealItems 
        JOIN foodItems ON foodItems.foodItemID = loggedMealItems.foodItemID 
            WHERE userID= ? AND day = ? `, [req.params.userID, req.params.date])
    .then(result => {
        //throw new Error("Testing Error");
        res.send(result[0])
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({message : "There was an issue getting the data for this day."})
    })
})

/*======================================================================
Change loggedItem amount

-query makes sure the authenticated user has authorization as well
TODO
-probably will stick with just regular 200 for now
======================================================================*/

app.patch('/user/:userID/logged-food/:loggedID', authMiddleware, (req, res) => {
    connection.execute(`UPDATE loggedMealItems SET amount = ? WHERE loggedID = ? AND userID = ?`, [req.body.amount, req.params.loggedID, req.params.userID])
    .then(result => {
        //throw new Error("Testing Error");
        res.send({error : false, errorType: "none"})
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({message : "There was an issue updating the food amount."})
    })
})

/*=================================================================================
DeleteLogged Item

TODO
-maybe change success code to 204
=====================================================================================*/

app.delete('/user/:userID/logged-food/:loggedID', authMiddleware, (req, res) => {
    connection.execute(`DELETE FROM loggedMealItems WHERE loggedID = ? AND userID = ?`, [req.params.loggedID, req.params.userID])
    .then(result => {
        //throw new Error("Testing Error");
        res.send({error : false, errorType: "none"})
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({message : "There was an issue deleting the food."})
    })
})

/*=================================================================================
Add logged Item
TODO
-202 status on success?
=====================================================================================*/

app.post('/user/:userID/date/:date/new-item', authMiddleware, (req, res) => {
    const loggedID = `${uuid.v4()}`;
    connection.execute(`INSERT INTO loggedMealItems(loggedID, foodItemID, userID, day, amount, meal) VALUES (?, ?, ?, ?, ?, ?)`,
    [loggedID, req.body.foodItemID, req.params.userID, req.params.date, req.body.amount, req.body.meal])
    .then(result => {
        //throw new Error("Testing Error");
        res.send({loggedID : loggedID})
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({message : "There was an issue adding the food to the meal."})
    })
})
/*=================================================================================

Search DB for Item

/foodDatabase/query

TODO
-rename
-add error stuff
    -what happens if the start is beyond the actual count?
    -will an error occur
-why are these two seperate functions/paths, does it really matter, theres not a big difference
    -maybe just go with the one that includes the page number
    -I beleive I was intending to remove the count query from the 2nd search function
        -at the very least, if the count is not being used it should be removed
        -but the count could change if more food is added to the database
            -that shouldnt cause errors, and is not a big deal for user expierence
=====================================================================================*/

async function testsearch(search) {
    const search_ = '%' + search + '%';
    const mealQuery = await connection.execute(`SELECT * FROM foodItems WHERE name LIKE ? ORDER BY name LIMIT 5`, [search_])
    const count = await connection.execute(`SELECT count(*) AS count FROM foodItems WHERE name LIKE ?`, [search_])
    meals = [mealQuery[0], count[0][0]]
    return meals;
}

//this isnt right, it should be a search query
app.get('/database-food/:mealitemID', (req, res) => {
    testsearch(req.params.mealitemID)
    .then(result => {
        //throw new Error("Testing Error");
        res.send(result)
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({message : "There was an issue processing the search."})
    })
})

async function testsearch2(search, start) {
    const search_ = '%' + search + '%';
    const mealQuery = await connection.execute(`SELECT * FROM foodItems WHERE name LIKE ? ORDER BY name LIMIT ?, 5`, [search_, start])
    const count = await connection.execute(`SELECT count(*) AS count FROM foodItems WHERE name LIKE ?`, [search_])
    meals = [mealQuery[0], count[0][0]]
    return meals;
}

app.get('/database-food/:mealitemID/p:start', (req, res) => {
    testsearch2(req.params.mealitemID, req.params.start)
    .then(result => {
        //throw new Error("Testing Error");
        res.send(result)
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({message : "There was an issue processing the search."})
    })})



/*=================================================================================
Add new food item to database     
=====================================================================================*/

app.post('/database-food/new-item', (req, res) => {
    const foodItemID = `${uuid.v4()}`;
    connection.execute(`INSERT INTO foodItems(foodItemID, name, calories, protein, fat, carbs) VALUES (?, ?, ?, ?, ?, ?)`, 
        [foodItemID, req.body.name, req.body.calories, req.body.protein, req.body.fat, req.body.carbs])
    .then(result => {
        //throw new Error("Testing Error");
        res.send({error : false, errorType: "none"})
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({message : "There was an issue adding the item to the food database."})
    })
})

/*=================================================================================
Get the profile picture

this should change
the way profile pictures are stored should change

TODO
-pehaps change so to fall back to the default
-could also just check if the user uploaded a profile picture from sql
-or just check of the file exists and then return the default profile or whatever info is needed to say there is none
-or maybe check through the client if the profile picture has been set, if not then dont bother fetching it

-best it to just see if its been set, if not then dont bother fetching
-then this can just be here for the api


=====================================================================================*/

app.get('/user/:userID/profile-picture/:profilePicture', (req, res) => {
    if(req.params.profilePicture === '0')
    {
        res.sendFile(path.join(__dirname, 'profilePictures/defaultPP.png'),  (err) => {
            if (err) {
                console.log(err);
                res.status(err.status).send({message : "There was an issue getting your profile picture"})
            } else {
                //console.log('Sent:', 'profilePictures/defaultPP.png');
            }}
            )
    }
    else if (req.params.profilePicture === '1') {
        res.sendFile(path.join(__dirname, 'profilePictures/' + req.params.userID + '.png'),  (err) => {
            if (err) {
                console.log(err);
                res.status(err.status).send({message : "There was an issue getting your profile picture"})
                //                res.status(err.status).send({message : "message"})
            } else {
                //console.log('Sent:', 'profilePictures/' + req.body.userID + '.png');
            }}
            )
    }
    else {console.log("Get Profile Picture Error. Should not see this.")}
    //if they get her it means the user supplied an incorrect value for the profile picture, I decided on a status for this
})

/*=================================================================================
Update User info
=====================================================================================*/

app.patch('/user/:userID/user-info', authMiddleware, (req, res) => {
    const userData = req.body.userData;
    connection.execute(`UPDATE users SET name = ?, age = ?, weight = ? WHERE userID = ?`,
    [userData.name, userData.age, userData.weight, userData.userID])
    .then(result => {
        //throw new Error("Testing Error");
        res.send({error : false, errorType: "none"})
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({message : "There was an issue updating your info."})
    })})

/*=================================================================================
Update user profile picture

this needs more complicated error hanling
=====================================================================================*/

app.patch('/user/:userID/upload-profile-picture', authMiddleware, upload.single('file'), function (req, res, next) {
    connection.execute(`UPDATE users SET profilePicture = 1 WHERE userID = ?`, [req.params.userID])
    .then(result => {
        //throw new Error("Testing Error");
        res.send({error : false, errorType: "none"})
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({message : "There was an issue updating your profile picture."})
    })})