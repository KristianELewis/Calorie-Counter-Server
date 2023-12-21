
const path = require('path');
const { unlink } = require('node:fs/promises');

/*======================================================================================
MULTER
multer is used for processing file uploads. 
only profile pictures are uploaded at the moment
TODO
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
        cb(null, req.params.userID + req.fileExt)
    }
})
const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        /*
        I thought mime types might be better to check, but if you change the extension of a txt file to png, checking the mime type will still show image/png
        not sure the best way to prevent non images from being uploaded. Interestingly enough, trying to load it into an img tag will actually not work, which is how im checking image validity on the front end
        I could potentially do something cursed here and try to load it into an image tag

        const acceptedTypes = file.mimetype.split('/');
        */
        req.fileExt = path.extname(file.originalname);
        if(req.fileExt !== '.png' && req.fileExt !== '.jpg' && req.fileExt !== '.gif' && req.fileExt !== '.jpeg') {
            req.invalidFile = true;
            cb(null, false)
        }
        else{
            cb(null, true)
        }
    },
    limits:{
        //Idk what this file size translates to. Is this (1024 * 1024) bytes?
        //this is 1 MB I guess?
        //I think thats more than enough for a profile pic honestly
        fileSize: 1024 * 1024
    }
})

module.exports = {upload, storage, unlink}