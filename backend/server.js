const express = require("express"),
       app = express(),
       port = process.env.PORT || 8080,
       cors = require("cors");
const bodyParser = require('body-parser');
const fsPromises = require("fs").promises;
//const fs = require("fs");
const todoDBName = "tododb";
const useCloudant = true;



//Init code for Cloudant
const {CloudantV1} = require('@ibm-cloud/cloudant');
if (useCloudant)
{
    initDB();
}

const basicAuth = require("express-basic-auth");
var { authenticator, upsertUser, cookieAuth } = require("./authentication");
const auth = basicAuth({
    authorizer: authenticator
});
const cookieParser = require("cookie-parser");
app.use(cookieParser("82e4e438a0705fabf61f9854e3b575af"));

app.use(cors({
  credentials: true,
  origin: 'http://localhost:3000'
}));

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

app.use(cors());
app.use(bodyParser.json({ extended: true }));

app.listen(port, () => console.log("Backend server live on " + port));



app.get("/", (request, response) => {
    response.send({ message: "Connected to Backend server!" });
});

//add new item to json file
app.post("/add/item", addItem)

async function addItem (request, response) {
    try {
        // Converting Javascript object (Task Item) to a JSON string
        const id = request.body.jsonObject.id
        const task = request.body.jsonObject.task
        const curDate = request.body.jsonObject.currentDate
        const dueDate = request.body.jsonObject.dueDate
        const newTask = {
          ID: id,
          Task: task,
          Current_date: curDate,
          Due_date: dueDate
        }
        
        if (useCloudant) {
            //begin here for cloudant
            //const todoDocID = id;

            // Setting `_id` for the document is optional when "postDocument" function is used for CREATE.
            // When `_id` is not provided the server will generate one for your document.
            const todoDocument = { _id: id.stringify };
          
            // Add "name" and "joined" fields to the document
            todoDocument['task'] = task;
            todoDocument.curDate = curDate;
            todoDocument.dueDate = dueDate;
          
            // Save the document in the database with "postDocument" function
            const client = CloudantV1.newInstance({});
            console.log('Writing to: ', todoDBName)
            const createDocumentResponse = await client.postDocument({
              db: todoDBName,
              document: todoDocument,
            });
            console.log('Successfully wrote to cloudant DB');
        } else {
            //original write to local file
            const data = await fsPromises.readFile("database.json");
            const json = JSON.parse(data);
            json.push(newTask);
            await fsPromises.writeFile("database.json", JSON.stringify(json))
            console.log('Successfully wrote to file') 
        }
        response.sendStatus(200)
    } catch (err) {
        console.log("error: ", err)
        response.sendStatus(500)
    }
}

//** week 6, get all items from the json database*/
app.get("/get/items", getItems)
async function getItems (request, response) {
    //begin here

    //begin cloudant here
    if (useCloudant) {
    //add for cloudant client
    const client = CloudantV1.newInstance({});
    var listofdocs;
    await client.postAllDocs({
        db: todoDBName,
        includeDocs: true
    }).then(response => {
        listofdocs=response.result;
        });
    response.json(JSON.stringify(listofdocs));
    }
    else {
    //for non-cloudant use-case
    var data = await fsPromises.readFile("database.json");
    response.json(JSON.parse(data));
    }

};

//** week 6, search items service */
app.get("/get/searchitem", searchItems) 
async function searchItems (request, response) {
    //begin here
    var searchField = request.query.taskname;

    if (useCloudant){
        const client = CloudantV1.newInstance({});
        var search_results
        await client.postSearch({
            db: todoDBName,
            ddoc: 'newdesign',
            query: 'task:'+searchField,
            index: 'newSearch'
          }).then(response => {
            search_results=response.result;
            console.log(response.result);
          });
        console.log(search_results);
        response.json(JSON.stringify(search_results));
        
    }
    else {
    var json = JSON.parse (await fsPromises.readFile("database.json"));
    var returnData = json.filter(jsondata => jsondata.Task === searchField);
    response.json(returnData);
    }
};


// Add initDB function here
async function initDB ()
{
    //TODO --- Insert to create DB
    //See example at https://www.npmjs.com/package/@ibm-cloud/cloudant#authentication-with-environment-variables for how to create db
    
    try {
        const client = CloudantV1.newInstance({});
        const putDatabaseResult = (
        await client.putDatabase({
        db: todoDBName,
      })
    ).result;
    if (putDatabaseResult.ok) {
      console.log(`"${todoDBName}" database created.`);
    }
  } catch (err) {
   
      console.log(
        `Cannot create "${todoDBName}" database, err: "${err.message}".`
      );

  }
};