/*
The use of __dirname here is kinda jank
*/

const express = require('express')
const router = express.Router({mergeParams: true}) //mergeParams lets me split this up. It will take the params from the parent which is :userID
//I just by chance found an answer for that on stack overflow. There is zero chance I would have found that by looking at express docs
const {connection} = require('../../mysqlConnection.js')
const path = require('path');
const {upload, unlink} = require('../../multerFunctions.js') //not sure if unlink should be imported like this
const {userUpdateAuth} = require("../../middleware/userUpdateAuth.js")


/*=================================================================================
PROFILE PICTURE PATHS AND FUNCTONS

Profile picture should all be the same path, not sure why I made them differnt

==================================================================================*/
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
/*----------------------------------------------------------------------------------
DELETE PROFILE PICTURE MIDDLEWARE

pretty sure this does not need to be async
----------------------------------------------------------------------------------*/
const deleteProfilePicture = (req, res, next) => {
    connection.execute(`SELECT profilePicture FROM users WHERE userID = ?`,
    [req.params.userID])
    .then(result => {
        if(result[0].length < 1){
            //the user probably doesnt exist, this should really not happen under normal circumstances
            //if the user doesnt exist it should be caught by the auth middleware that occurs before this
        }
        else if (result[0][0].profilePicture === "none"){
            //console.log("delete middleware: no picture")
            req.pictureFound = false;
            next()
        }
        else{
            //console.log("delete middleware: picture found")
            req.pictureFound = true;
            const profilePicturePath = path.join(__dirname, '../../profilePictures/' + req.params.userID + result[0][0].profilePicture)
            //console.log(profilePicturePath)
            unlink(profilePicturePath)
            .then(()=> {
                //console.log("Deleted Successfully")
                next()

            }
            )
            .catch((err) => {
                console.log(err)
                //If it couldnt delete the file it shouldnt continue
                //althought this likely means that the file does not exist, but the datbase does not have "none" stored
                //Its probable the error thrown here would mentions that. If thats the case eventually I should check for that error,
                //and fix the database entry

                //this became an issue after I moved everything. This should only happen if the file doesn't exist, but the users info says it does.
                //Just set the users info say that it says none. Not sure if this will cause issues if they're trying to add a new profile picture, and the run into this issue
                connection.execute(`UPDATE users SET profilePicture = 'none' WHERE userID = ?`,
                [req.params.userID])
                .then(() =>{
                    //switch to res.status(200)
                    //res.send({error : false, errorType: "none"})
                    next();
                })
                .catch((err) => {
                    //If this happens then there's proably some serious issue with the database
                    res.status(500).send({message : "here was an issue processing your request."})
                })

                //res.status(500).send({message : "There was an issue processing your request."}
                
            })
        }
    })
}

/*----------------------------------------------------------------------------------
DELETE PROFILE PICTURE PATH

----------------------------------------------------------------------------------*/
router.delete('/', userUpdateAuth, deleteProfilePicture, (req, res) => {
    if(req.pictureFound)
    {
        //may cause some redundant issues if the file does not exist, but user info says it does, because of the middleware
        connection.execute(`UPDATE users SET profilePicture = 'none' WHERE userID = ?`,
        [req.params.userID])
        .then(() =>{
            //switch to res.status(200)
            res.send({error : false, errorType: "none"})
        })
        .catch((err) => {
            //picture was deleted but this was not updated in the database
            //this will cause issues later
            //should log if this happens
            //this could potentially be solved in the deletemiddleware. I left a comment about this situation in there
            res.status(500).send({message : "There was an issue uploading your profile pciture"})
        })
    }
    else{
        //there was no profile picture to begin with.
        //this should only be for api calls, in the frontend this is prevented
        res.send({error : false, errorType: "none"})
    }
})

/*----------------------------------------------------------------------------------
UPLOAD NEW PROFILE PICTURE

----------------------------------------------------------------------------------*/
router.patch('/', userUpdateAuth, deleteProfilePicture, upload.single('file'), function (req, res, next) {
    if(req.invalidFile){
        res.status(500).send({message : "Invalid file type"})
    }
    else{
        connection.execute(`UPDATE users SET profilePicture = ? WHERE userID = ?`,
        [req.fileExt, req.params.userID])
        .then(() =>{
            //switch to res.status(200)
            res.send({error : false, errorType: "none"})
        })
        .catch((err) => {
            //If an error happened then the profile picture was uploaded but there was an issue with the mysql server.
            //I guess this should attempt to delete the uploaded picture. If that causes an error, than there are some serious issues
            //in any case this stuff should be logged
            //maybe something to look into later, its an unlikely thing to happen, and not a big deal anyway
            res.status(500).send({message : "There was an issue uploading your profile pciture"})
        })
    }
})

/*---------------------------------------------------------------------------------
Get the profile picture

I used html error code 418 as it has no real error use to realy this message to the client. 
It works easily with the way server errors are handled by the client, but It should maybe do something different
---------------------------------------------------------------------------------*/

router.get('/', (req, res) => {
    connection.execute(`SELECT profilePicture FROM users WHERE userID = ?`,
    [req.params.userID])
    .then(result => {
        if(result[0].length < 1){
            /*
                the user probably doesnt exist
                this should never get reached, it should have been prevented by the auth middleware
            */
        }
        else if (result[0][0]. profilePicture === "none"){//the user has not set a profile picture
            //console.log(result[0][0])
            res.status(418).send({message: "No Profile Picture"});
        }
        else{//profile pciture set
            //console.log(result[0][0])
            res.sendFile(path.join(__dirname, '../../profilePictures/' + req.params.userID + result[0][0]. profilePicture),  (err) => {
                if (err) {
                    /*
                        Reaching this most likely means that the database was not successfully changed after a profile picture deletion.
                        Which means that the profile picture does not exist anymore
                        probably should just do an sql query here and set the profilePicture to "none"
                    */
                    res.status(418).send({message: "No Profile Picture"});
                } else {//no Error, maybe just delete this
                }}
            )
        }
    })
    .catch(err => {//not sure what could cause this error
        console.log(err)
        res.status(500).send({message : "There was an issue getting your profile picture."})
    })
})

module.exports = router;