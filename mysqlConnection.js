const {dbHost, dbUser, dbPassword, database} = require("./enviroment.js")



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

module.exports = {connection};