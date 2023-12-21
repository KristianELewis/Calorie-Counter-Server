/*
I'm not set on the path names. I don't know if by_ID or by_date is restful or not
*/
const express = require('express')
const router = express.Router({mergeParams: true}) //mergeParams lets me split this up. It will take the params from the parent which is :userID
//I just by chance found an answer for that on stack overflow. There is zero chance I would have found that by looking at express docs
const {connection} = require('../../mysqlConnection.js')
const uuid = require('uuid');
const { authMiddleware }= require('../../middleware/authMiddleware.js')



/*======================================================================
Change loggedItem amount

-query makes sure the authenticated user has authorization as well
TODO
-probably will stick with just regular 200 for now
======================================================================*/

router.patch('/by-ID/:loggedID', authMiddleware, (req, res) => {
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

router.delete('/by-ID/:loggedID', authMiddleware, (req, res) => {
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
/*==========================================================================
Get Daily Information

TODO
-if an inccorect date paramter is sent, it will probably cause an error sepcific to that
-this should never happen in the app, but for api reasons this should be accounted for

==========================================================================*/
router.get('/by-date/:date', authMiddleware, (req, res) => {
    connection.execute(
        `SELECT name, loggedID, brand, servingSize, servingUnit, calories, protein, fat, carbs, amount, meal 
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

/*=================================================================================
Add logged Item
TODO
-202 status on success?
=====================================================================================*/

router.post('/by-date/:date/new-item', authMiddleware, (req, res) => {
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


module.exports = router;