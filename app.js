/*
TODO


-improve login functionality
    -signing up should log you in

-Need to add express router
    -make api restful
    -routing files based on resources

-look over status responses

-come up with generic success reponse to replace the old error system
    -the old error responses are still being sent, should not cause issues but is unecessary and should be removed
    -perhaps just send apropriate 200 status responses and any necessary data

-test authentication responses with postman

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
app.use(bodyParser.json());
//I had this set to false for some reason
app.use(bodyParser.urlencoded({ extended: false }))

//app.use(express.static("dist"))

const port = 3000


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

/*================================================

CONNECTION POOL
-If the connection failed, the user needs to be told

=================================================*/

//mysql stuff
const mysql = require('mysql2/promise')

//I need to change these connection limits
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
*/

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

//511 for missing token?  No it shouldnt
//403 should be returned if userID does not match token
/*


*/
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
        else if (decoded.userID !== userID)
        {
            res.status(403).send({message: "unauthorized access"})
        }
    });
}

/*================================================
LOGIN

-need to make sure usernames are unique
  -I think I've satisfied this now

Eventually I should use sessions for logging in. The user will then get a jwt token for making crud operations that has a lifespan of 30 minutes or something
Theres no real user data to protect, that level of security is not important. The current JWT tokens will become invalid after a day.
=================================================*/


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



/*==========================================================================
Sign up

Should not accept any empty inputs, should return an error

TODO

-should give a jwt for a new sessions for the user, so they can auto login
-generic 400 status code will be used
-needs more validiation, no spaces, no letters for number, things like that
==========================================================================*/
//not sure how else to handle this

//checks if there is white space
//  /\s/ is regular expression for white space
function hasWhiteSpace(str) {
    return /\s/.test(str);
}


//i think this validate function could be broken up, lots of overlap. Some of this could be turned into different functions
//should probably check the length
//this needs to stop using the old error system
const verifySignup = (req, res, next) => {
    if(req.body.userData === undefined)
    {
        res.send({error: true, errorType : "No information sent"})
    }
    else if(req.body.userData.username === undefined || req.body.userData.username === '' || hasWhiteSpace(req.body.userData.username))
    {
        res.send({error: true, errorType : "Invalid Username"})
    }
    else if(req.body.userData.password === undefined || req.body.userData.password === '' || hasWhiteSpace(req.body.userData.password))
    {
        res.send({error: true, errorType : "Invalid Password"})
    }
    else if(req.body.userData.name === undefined || req.body.userData.name === '') //names can contain white space
    {
        res.send({error: true, errorType : "No name sent"})
    }
    //isNaN checks if a value is valid number. Maybe remove the undefined check?
    //currently using the old error system, If moving over to errors, undefined and isNan will be checking for different errors, The users should be told what the issue is
    /*

    No longer should be checking for age and weight

    else if(req.body.userData.age === undefined || req.body.userData.age < 1 || isNaN(req.body.userData.age))
    {
        res.send({error: true, errorType : "Invalid Age"})
    }
    else if(req.body.userData.weight === undefined || req.body.userData.weight < 1 || isNaN(req.body.userData.weight))
    {
        res.send({error: true, errorType : "Invalid Weight"})
    }*/
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
    /* no longer using age and weight
    const weight = req.body.userData.weight;
    const age = req.body.userData.age;
    */
    //I can do this differently, dont need await probably
    //can probably get rid of "const mealQuery" as well
    //const mealQuery = await 
    //also not using profilePicture anymore
    connection.execute(`INSERT INTO users(userID, username, password, name, profilePicture) VALUES (?, ?, ?, ?, FALSE)`,
        [userID, username, hash, name])
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
        `SELECT name, loggedID, servingSize, servingUnit, calories, protein, fat, carbs, amount, meal 
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

const verifyNewItem = (item) => {
    if(item.name === "")
    {
        return true
    }
    if(item.servingSize < 1)
    {
        return true
    }
    else return false
}


app.post('/database-food/new-item', (req, res) => {
    if (verifyNewItem(req.body) === true)
    {
        res.status(500).send({message : "There was an issue adding the item to the food database."})
    }
    else{
        const foodItemID = `${uuid.v4()}`;
        connection.execute(`INSERT INTO foodItems(foodItemID, name, brand, servingSize, servingUnit, calories, protein, fat, carbs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [foodItemID, req.body.name, req.body.brandName, req.body.servingSize, req.body.servingUnit, req.body.calories, req.body.protein, req.body.fat, req.body.carbs])
        .then(result => {
            console.log("no error")
            res.send({error : false, errorType: "none"})
        })
        .catch(err => {
            console.log(err)
            res.status(500).send({message : "There was an issue adding the item to the food database."})
        })
    }
})

/*=================================================================================
Get the profile picture

Originally checked if user ever uploaded a profile picture.
Seems unecesary, If theres no profile picture just assume they never uploaded one

I used html error code 418 as it has no real error use to realy this message to the client. 
It works easily with the way server errors are handled by the client, but It should maybe do something different
=====================================================================================*/

app.get('/user/:userID/profile-picture', (req, res) => {


    res.sendFile(path.join(__dirname, 'profilePictures/' + req.params.userID + '.png'),  (err) => {
        if (err) {
            //console.log(err);
            res.status(418).send({message: "No Profile Picture"});
            //res.status(err.status).send({message : "There was an issue getting your profile picture"})
            //                res.status(err.status).send({message : "message"})
        } else {
            //console.log('Sent:', 'profilePictures/' + req.body.userID + '.png');
        }}
    )

    /*
    if(req.params.profilePicture === '0')
    {
        res.status(418).send({message: "No Profile Picture"});

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

    }
    else {console.log("Get Profile Picture Error. Should not see this.")}*/
    //if they get her it means the user supplied an incorrect value for the profile picture, I decided on a status for this
})





/*=================================================================================
AUTH MIDDLEWARE FOR UPDATING USER DATA

spent a long time trying to get file upload working with password as part of the body
Its not something you can do with multer. I just decided to put the password in the authentication header.
It took two seconds to get that working. Not sure if its a bad way to do it. should have just done it earlier but was being stuborn
=====================================================================================*/

const userUpdateAuth = (req, res, next) => {
    const password = req.get('authorization')
    if (password === "")
    {
        //this needs unauthorized accces status code
        res.status(500).send({message : "You need to submit your current password to make changes to your profile."})
        return
    }
    connection.execute(`SELECT password from users WHERE userID = ?`, [req.params.userID])
    .then(result => {
        if (result[0].length === 0){
            res.send({userID: "notFound"})
        }
        else{
            bcrypt.compare(password, result[0][0].password, function(err, hresult) {
                if(hresult === true){
                    next();
                }
                else{
                    res.status(500).send({message : "Invalid Password"})
                }
            })
        }
    })

}


/*=================================================================================
Update User info

I should look this over and make sure everything is still okay.
Seems to work fine at the moment
=====================================================================================*/

app.patch('/user/:userID/user-info', userUpdateAuth, (req, res) => {
    const userData = req.body.userData;

    connection.execute(`UPDATE users SET username = ?, name = ? WHERE userID = ?`,
    [userData.username, userData.name, userData.userID])
    .then(result => {
        //throw new Error("Testing Error");
        //why is this sending error false information?
        res.send({error : false, errorType: "none"})
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({message : "There was an issue updating your info."})
    })
})


/*=================================================================================
Change password

do not need to be sending userdta

=====================================================================================*/

app.patch('/user/:userID/user-info/password', userUpdateAuth, (req, res) => {
    const userID = req.params.userID;
    const password = req.body.password

    const hash = bcrypt.hashSync(password, saltRounds);
    connection.execute(`UPDATE users SET password = ? WHERE userID = ?`,
    [hash, userID])
    .then(result => {
        res.send({error : false, errorType: "none"})
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({message : "There was an issue updating password."})
    })
})

/*=================================================================================
Update user profile picture

this needs more complicated error hanling

needs to check if sent file is actaully an image
need to remove this database query, unecessary
=====================================================================================*/
app.patch('/user/:userID/upload-profile-picture', userUpdateAuth, upload.single('file'), function (req, res, next) {
    
    //I think these were just to send something. probably could just send a status of 200
    res.send({error : false, errorType: "none"})
    /*
        Theres no need to do anything here anymore
      
        Ill probably end up removing profilePicture from users table, its useless
    */
    //console.log(req.body)
    /*
    connection.execute(`UPDATE users SET profilePicture = 1 WHERE userID = ?`, [req.params.userID])
    .then(result => {
        //throw new Error("Testing Error");
        console.log("success")
        res.send({error : false, errorType: "none"})
    })
    .catch(err => {
        console.log(err)
        res.status(500).send({message : "There was an issue updating your profile picture."})
    })
    */
})