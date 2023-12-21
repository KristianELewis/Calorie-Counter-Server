const {connection} = require('../mysqlConnection.js')
const bcrypt = require('bcrypt');
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

module.exports = {userUpdateAuth}