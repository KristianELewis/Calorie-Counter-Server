//Maybe I shouldn't do it like this, but for now I am

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


module.exports = {dbHost, dbUser, dbPassword, database, jwtSecret, certLocation, keyLocation};