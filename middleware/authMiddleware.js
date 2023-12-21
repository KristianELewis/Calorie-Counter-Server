const {jwtSecret} = require("../enviroment.js")

/*================================================
authentication/ authorization

bcrypt to has passwords
jwt for authentication

Needd to make sure the expiration date will auto fail it, if not I need to check it for validity
=================================================*/


const jwt = require('jsonwebtoken');
//511 for missing token?  No it shouldnt
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
        else if (decoded.userID !== userID)
        {
            res.status(403).send({message: "unauthorized access"})
        }
    });
}
module.exports = {authMiddleware};