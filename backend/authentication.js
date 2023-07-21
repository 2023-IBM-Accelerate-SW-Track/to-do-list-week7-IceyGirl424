var crypto = require('crypto');
var fs = require('fs');
const basicAuth = require("express-basic-auth");

// users holds user information that is backed up on file
let users = {};

// initialize users store from file
(() => {
    users = JSON.parse(fs.readFileSync('users.json', 'utf8')).users;
})()

// performs a SHA256 hash of a string
const sha256 = x => crypto.createHash('sha256').update(x, 'utf8').digest('hex');

// looks for the username/password combo in the users store
const authenticator = (user, password) => {
    if(!users[user] || !user || !password) return false;
    return basicAuth.safeCompare(sha256(password), users[user].passwordHash);
}

// write the users store to file
const writeUsers = (_users) => {
    const data = {
        users: _users
    }
    var json = JSON.stringify(data);
    fs.writeFile("users.json", json, function (err, result) {
        if (err) {
            console.log("error", err);
        } else {
            console.log("Successfully wrote users");
        }
    });
}

// update or insert a user object to the store
// returns true/false to indicate success of the operation
const upsertUser = (username, password, userDetail) => {
    if(users[username]) {
        if(basicAuth.safeCompare(sha256(password), users[username].passwordHash)) {
            users[username] = { ...users[username], ...userDetail };
        } else {
            console.log("incorrect password in upsertUser");
            return false;
        }
    } else {
        users[username] = {
            ...userDetail,
            passwordHash: sha256(password)
        }
    }
    writeUsers(users);
    return true;
}

// express middleware for validating `user` cookie against users store
const cookieAuth = (req, res, next) => {
    if(!req.signedCookies.user || !users[req.signedCookies.user]) {
        res.sendStatus(401);
    } else {
        next();
    }
}

module.exports = { authenticator, upsertUser, cookieAuth }