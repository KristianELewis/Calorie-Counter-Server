const express = require('express')
const router = express.Router()
const { authMiddleware }= require('../middleware/authMiddleware.js')
const {connection} = require('../mysqlConnection.js')
const {jwtSecret} = require("../enviroment.js")
const jwt = require('jsonwebtoken');
const uuid = require('uuid');
const bcrypt = require('bcrypt');
const saltRounds = 12;
/*================================================
LOGIN
Might switch to useing sessions instead of using JWT
Theres no real user data to protect, that level of security is not important. The current JWT tokens will become invalid after a day.
=================================================*/
//The lack of error handling is causing issues here
router.post('/', (req, res) => {
    const username = req.body.username
    const password =  req.body.password
        //create better object for return value
    connection.execute(`SELECT userID, username, password, name, profilePicture, age, weight FROM users WHERE username= ?`, [username])
    .then(result => {
        if (result[0].length === 0){
            //res.send({userID: "notFound"})
            res.status(401).send({message : "Incorrect username or password"})
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
                else{        //res.status(500).send({message : "There was an issue getting the data for this day."})

                    res.status(401).send({message : "Incorrect username or password"})
                }
            })
        }
    })
    .catch(err => {console.log(err)}) //Shouldn't this be sending an error to the user?
})
//token login
router.post('/token/:userID', authMiddleware, (req, res) => {
    const userID = req.params.userID

    connection.execute(`SELECT userID, username, password, name, profilePicture, age, weight FROM users WHERE userID= ?`, [userID])
    .then(result => {
        if (result[0].length === 0){
            //this really should never happen
            res.status(401).send({message : "Incorrect username or password"})
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

I had something in the lgin secttions that said make sure usernames are unique, it also said that was taken care, double check it

Should not accept any empty inputs, should return an error

TODO

-should give a jwt for a new sessions for the user, so they can auto login
-generic 400 status code will be used
-needs more validiation, no spaces, no letters for number, things like that
==========================================================================*/

//checks if there is white space
//  /\s/ is regular expression for white space
function hasWhiteSpace(str) {
    return /\s/.test(str);
}
const verifySignup = (req, res, next) => {
    if(req.body.userData === undefined)
    {
        res.status(400).send({error: true, message : "No information sent"})
    }
    else if(req.body.userData.username === undefined || req.body.userData.username === '' || hasWhiteSpace(req.body.userData.username))
    {
        res.status(400).send({error: true, message : "Invalid Username"})
    }
    else if(req.body.userData.password === undefined || req.body.userData.password === '' || hasWhiteSpace(req.body.userData.password))
    {
        res.status(400).send({error: true, message : "Invalid Password"})
    }
    else if(req.body.userData.name === undefined || req.body.userData.name === '') //names can contain white space
    {
        res.status(400).send({error: true, message : "No name sent"})
    }
    else 
    {
        next();
    }
}
router.post('/signup', verifySignup, async function (req, res, next) {
    
    const userID = uuid.v4();
    const username = req.body.userData.username
    const password = req.body.userData.password
    const hash = bcrypt.hashSync(password, saltRounds);
    const name = req.body.userData.name;

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
            res.status(400).send({error: true, message: "Username already in use"})
        }
        else{
            //Getting wrong value for field here, could potentially use this for validating input, but probably should not be contacting the sql server
            //console.log(err)
            res.status(400).send({error: true, message: "Server side error. Try again later."})
        }
    })
})

module.exports = router;