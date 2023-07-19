# Project: Week 7 - Security: To-do list application

## Adding Authentication

For the Week 7 Lab, we will add authentication to the TODO app. To do this, we will add an npm package called `express-basic-auth` to help us read and validate Basic Authentication usernames and passwords. After authenticating, the client will need to send a cookie on future requests with a credential.

## Installation

In the `backend` directory:

`npm install --save express-basic-auth`

`npm install --save cookie-parser`

## Backend Setup

In the `backend` directory, create a new file called `authentication.js`. In it, paste the following code:

```
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
```

In this file, we hold user data in the `users` variable, and persist the data in `users.json`. To add default users, create the file `backend/users.json`, and paste this document in it:

```
{
  "users": {
    "user": {
      "passwordHash": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"
    }
  }
}

```

This will add a user with the name `user` and password `password` to the user store. The user's plaintext password is not stored, but instead a SHA256 hash of it. The `authorizer` function hashes the password that the client sends, and checks it against the users store. This way we don't risk leaking a plaintext password.

The `upsertUser` function can be used to create new users and add them to the store.

`cookieAuth` will be used to check for signed cookies on requests that indicate that a user has already authenticated.

In `server.js` we will import `express-basic-auth` and the authentication file.

```
const basicAuth = require("express-basic-auth");
var { authenticator, upsertUser, cookieAuth } = require("./authentication");
const auth = basicAuth({
    authorizer: authenticator
});
const cookieParser = require("cookie-parser");
app.use(cookieParser("82e4e438a0705fabf61f9854e3b575af"));

...

app.use(cors({
    credentials: true,
    origin: 'http://localhost:3000'
}));
```

The `auth` variable is express middleware that we can add to endpoints to make them authenticated. Before the endpoints are run, the middleware uses the `authenticator` function to ensure the user has provided authentication. Also note the update to the `app.use(cors({}));` line. It's important so that our app can send credentials to the backend.

Now let's add three new endpoints:

```
app.get("/authenticate", auth, (req, res) => {
    console.log(`user logging in: ${req.auth.user}`);
    res.cookie('user', req.auth.user, { signed: true });
    res.sendStatus(200);
});

app.post("/users", (req, res) => {
    const b64auth = (req.headers.authorization || '').split(' ')[1] || ''
    const [username, password] = Buffer.from(b64auth, 'base64').toString().split(':')
    const upsertSucceeded = upsertUser(username, password)
    res.sendStatus(upsertSucceeded ? 200 : 401);
});

app.get("/logout", (req, res) => {
    res.clearCookie('user');
    res.end();
});
```

`GET /authenticate` uses the `auth` middleware to verify that the user is authenticated. If the authentication succeeds, it will set a signed cookie on the response that will persist the user's authentication for later requests.

`POST /users` will add a new user to the users store and update the users.json file.

`GET /logout` will clear the signed `user` cookie.

We can now make the other endpoints authenticated by adding the `cookieAuth` middleware which will check for the signed cookie:

> app.post("/items", cookieAuth, addItem);
>
> app.get("/items", cookieAuth, getItems);
>
> app.get("/items/search", cookieAuth, searchItems);

## Frontend setup

We first want a login screen for users to create an account or log in.

Update App.js to add a login screen:

```
import * as api from './services/api';
import React, { useState } from 'react';

    ...

    const [authenticated, setAuthenticated] = useState(false);
    const [username, setUsername] = useState();
    const [password, setPassword] = useState();

    const authUser = async () => {
       setAuthenticated(await api.authenticate(username, password));
    }

    const createUser = async () => {
        await api.createUser(username, password);
    }

    return (
        <div className="App">
            {!authenticated ? (
                <div>
                    <label>Username: </label>
                    <br />
                    <input
                        type="text"
                        onChange={(e) => setUsername(e.target.value)}
                    />
                    <br />
                    <label>Password: </label>
                    <br />
                    <input
                        type="password"
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <br />
                    <button onClick={createUser}>Create User</button>
                    <button onClick={authUser}>Login</button>
                </div>
            ) : (
                <div className="App">
                    <NavbarComp />
                </div>
            )}
        </div>
    );
```

This Login form will ask users to login before showing them the TODO app. It relies on a file called `src/services/api.js`. Create that file and add the following code:

```
import axios from "axios";

const baseUrl = "http://localhost:8080";

export const authenticate = async (username, password) => {
    try {
        await axios.get(`${baseUrl}/authenticate`, {
            auth: { username, password },
            withCredentials: true
        });
        return true;
    } catch (e) {
        console.log(e);
        return false;
    }
};

export const createUser = async (username, password) => {
    try {
        const options = {
            auth: {
                username: username,
                password: password
            }
        }
        return await axios.post(`${baseUrl}/users`, {}, options);
    } catch (e) {
        console.log(e);
    }
}
```

These two functions interact with the API and send the username and password to be validated. Users can now log in, but for the cookies to be sent we need to add the `withCredentials` flag for Axios.

For example, on the call to `/item`:

```
    Axios({
      method: "POST",
      url: "http://localhost:8080/item",
      data: {jsonObject},
      headers: {
        "Content-Type": "application/json"
      },
      withCredentials: true
    }).then(res => {
      console.log(res.data.message);
    });
```

## Testing
1. Go to the *to-do-list* directory, if this is the first time running the front-end for this week execute the following:
```
    npm install
    npm audit fix --force
```
2. Start the front end by running the following command in the *to-do-list* directory:
```
    npm start
```

3. Open *another* terminal or command window and go to the *to-do-list/backend* directory and run the backend:
```
    npm start
```

4. Go to a browser and open the front-end, if not open already, http://localhost:3000, this should bring up the user login page. Login with the username `user` and password `password`. 

5. This will navigate to the home page. Go to the top navigation bar and click on the "SearchPage" link.

6. Notice the input text box and button that will search for a Todo list in the backend. Type a task name that you know exists or doesn't exist and click the button. (Note if you left the frontend and backend services running after completing the lab steps above make sure you refresh the page so the changes you made load correctly in the browser)

7. Observe the returned value in the div section below the search UI, it will be updated in real-time after we submit the form, returning with the data obtained from the backend.

## Conclusion

We have now protected our TODO app behind username and password, persisted the authentication info (without the plaintext password) in a file, and added authentication to the frontend through cookies.

To continue to improve the security of the TODO app, we might:

-   use a database for our authentication data
-   switch the signed cookie for a token with authorization claim
-   include an expiration / timeout on the cookie session
-   scope authorization to view and delete TODO items to their creators
-   serve the entire site (both frontend / backend) using HTTPS

### Optional Exercise

- Try to set up a simple authentication for the TODO app using [IBM Cloud App ID](https://cloud.ibm.com/docs/appid?topic=appid-getting-started) service by using the [tutorial](https://cloud.ibm.com/docs/appid?topic=appid-web-node).
