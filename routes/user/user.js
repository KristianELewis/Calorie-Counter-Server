/*
This is split up even more

decided to leave user-info in here
*/

const express = require('express')
const router = express.Router({mergeParams: true}) //mergeParams lets me split this up. It will take the params from the parent which is :userID
//I just by chance found an answer for that on stack overflow. There is zero chance I would have found that by looking at express docs
const {connection} = require('../../mysqlConnection.js')

const bcrypt = require('bcrypt');
const saltRounds = 12;
const {userUpdateAuth} = require("../../middleware/userUpdateAuth.js")
const loggedFood = require("./logged-food.js")
router.use('/logged-food', loggedFood)
const profilePicture = require("./profile-picture.js")
router.use('/profile-picture', profilePicture)

/*=================================================================================
Update User info

I should look this over and make sure everything is still okay.
Seems to work fine at the moment
=====================================================================================*/

router.patch('/user-info', userUpdateAuth, (req, res) => {
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

router.patch('/user-info/password', userUpdateAuth, (req, res) => {
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




module.exports = router;