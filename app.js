const express = require("express");
const app = express();
app.use(express.json());

const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

let data = null;
let dbPath = path.join(__dirname, "twitterClone.db");

const databaseAndServerInitialization = async () => {
  try {
    data = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log(`Server running at ${dbPath}`);
    });
  } catch (error) {
    console.log(`Database Error ${error.message}`);
  }
};
databaseAndServerInitialization();

//register
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  //checking username already exist
  const isUserNameAvailableQuery = `
    SELECT username from user 
    WHERE username='${username}'
    `;
  const isUserNameAvailable = await data.get(isUserNameAvailableQuery);
  if (isUserNameAvailable === undefined) {
    //username not available proceed next
    if (password.length < 6) {
      //password is less than 6 characters
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const addUserQuery = `
      INSERT INTO user(name,username,password,gender)
      VALUES(
          '${name}',
          '${username}',
          '${hashedPassword}',
          '${gender}'
      )
      `;
      const userAdded = await data.run(addUserQuery);
      console.log(userAdded);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    //username available
    response.status(400);
    response.send("User already exists");
  }
});

module.exports = app;
