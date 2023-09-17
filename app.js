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

//login user
app.post("/login/", async (request, response) => {
  //check user is available in database
  const { username, password } = request.body;
  const isUserAvailableQuery = `
    SELECT * FROM user 
    WHERE username='${username}'
    `;
  const isUserAvailableArray = await data.get(isUserAvailableQuery);
  console.log(isUserAvailableArray);
  if (isUserAvailableArray !== undefined) {
    //user have twitter account
    //checking password
    const isPasswordCorrect = await bcrypt.compare(
      password,
      isUserAvailableArray.password
    );
    console.log(isPasswordCorrect);

    if (isPasswordCorrect) {
      //password is correct
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_TOKEN");
      response.send({ jwtToken }); //sending the jsonwebtoken
    } else {
      //password is wrong
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    //user doesn't have twitter account
    response.status(400);
    response.send("Invalid user");
  }
});

//authentication

const authenticatingToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    jwt.verify(jwtToken, "MY_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        const { username } = payload;
        //get user details
        const getUserDetails = `
    SELECT * FROM user 
    WHERE username='${username}';
    `;
        const userDetails = await data.get(getUserDetails);
        request.userDetails = userDetails;
        request.payload = payload;

        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};
app.get(
  "/user/tweets/feed/",
  authenticatingToken,
  async (request, response) => {
    const { payload } = request;
    const { userDetails } = request;
    const { username, password } = payload;
    console.log(`userDetails:${userDetails}`);
    const { name, user_id } = userDetails;

    console.log(name);
    console.log(user_id);

    const returnLatestTweetQuery = `
   SELECT username,tweet,date_time as dateTime FROM 
   follower INNER JOIN tweet ON follower.following_user_id=tweet.user_id INNER JOIN user ON user.user_id=follower.following_user_id
   where follower.follower_user_id=${user_id}
   ORDER BY dateTime DESC
   LIMIT 4 
   OFFSET 0 
    
    `;
    const returnLatestTweetsArray = await data.all(returnLatestTweetQuery);
    console.log(returnLatestTweetsArray);
    response.send(returnLatestTweetsArray);
  }
);

app.get"/user/following/", authenticatingToken, async (request, response) => {
  const { payload, userDetails } = request;
  const { user_id, name } = userDetails;
  const { username, password } = payload;

  //return the people who all are people user follows
  const userFollowingQuery = `
SELECT username as name FROM user 
INNER JOIN follower ON user.user_id=follower.follower_user_id 
WHERE follower.follower_id=${user_id};
`;
  const userFollowingArray = await data.all(userFollowingQuery);
  console.log(userFollowingArray);
  response.send(userFollowingArray);
});
module.exports = app;
