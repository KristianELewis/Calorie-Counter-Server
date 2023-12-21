const express = require('express')
const router = express.Router()
const {connection} = require('../mysqlConnection.js')
const uuid = require('uuid');

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
router.get('/:mealitemID', (req, res) => {
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

router.get('/:mealitemID/p:start', (req, res) => {
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


router.post('/new-item', (req, res) => {
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

module.exports = router;