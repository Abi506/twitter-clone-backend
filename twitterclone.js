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

//database initialization

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

//creating an account or register

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

//authentication and validation
// in this phase where the user is verified and the token is given user should need to provide the token for accessing services
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

//provides the user following people latest tweets
//here it provide the user following people latest tweets

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

//get the people who user follows
//in this phase it shows the whom the user follows

app.get("/user/following/", authenticatingToken, async (request, response) => {
  const { payload, userDetails } = request;
  const { user_id, name } = userDetails;
  const { username, password } = payload;
  console.log(`userDetails:${userDetails}`);

  //return the people who all are people user follows
  const userFollowingQuery = `
SELECT name FROM user 
INNER JOIN follower ON user.user_id=follower.following_user_id 
WHERE follower.follower_user_id=${user_id};
`;
  const userFollowingArray = await data.all(userFollowingQuery);
  console.log(userFollowingArray);
  response.send(userFollowingArray);
});

// the list of all names of people who follows the user
//here it shows the who all are follows the user

app.get("/user/followers/", authenticatingToken, async (request, response) => {
  const { payload, userDetails } = request;
  const { user_id, name } = userDetails;
  const { username, password } = payload;

  const followersOfUserQuery = `
  SELECT name FROM user INNER JOIN follower ON user.user_id=follower.follower_user_id
  WHERE follower.following_user_id=${user_id};
  `;
  const followerOfUserArray = await data.all(followersOfUserQuery);
  console.log(followerOfUserArray);
  response.send(followerOfUserArray);
});

//The user requested tweet
//it provides the user requested tweet like tweet searches and tweet_id etc..

app.get("/tweets/:tweetId/", authenticatingToken, async (request, response) => {
  const { payload, userDetails } = request;
  const { user_id, name } = userDetails;
  const { username, password } = payload;
  const { tweetId } = request.params;
  const tweetQuery = `
  SELECT * FROM tweet 
  WHERE tweet_id=${tweetId};
  `;
  const tweetArray = await data.get(tweetQuery);
  console.log("------------");
  console.log("given tweet");
  console.log(tweetArray);

  const userFollowsQuery = `
  SELECT user.name as userFollowingPerson,user.user_id as userFollowingPersonID FROM user INNER JOIN follower ON user.user_id=follower.following_user_id
  WHERE follower.follower_user_id=${user_id}
  `;
  const userFollowsArray = await data.all(userFollowsQuery);
  console.log("------------");
  console.log("user following peoples");
  console.log(userFollowsArray);

  //user following people tweets

  const isUserFollowsPeopleTweetQuery = `
  SELECT tweet.user_id as userFollowingPersonId,tweet.tweet as userFollowingPeopleTweet,tweet.tweet_id FROM follower INNER JOIN tweet ON follower.following_user_id=tweet.user_id
  WHERE follower.follower_user_id=${user_id}
  `;
  const isUserFollowsPeopleTweetArray = await data.all(
    isUserFollowsPeopleTweetQuery
  );
  console.log("------------");
  console.log("user following people posted tweets");
  console.log(isUserFollowsPeopleTweetArray);

  //getting along with the name of the person who posted the tweet

  const isUserFollowingPeopleTweetAlongWithNameQuery = `
  SELECT user.name as userFollowingPersonName,user.user_id as userFollowingPersonId,tweet.tweet,tweet.tweet_id,tweet.date_time FROM follower INNER JOIN tweet ON follower.following_user_id=tweet.user_id INNER JOIN user ON user.user_id=follower.following_user_id
  WHERE follower.follower_user_id=${user_id};`;
  const isUserFollowingPeopleTweetAlongWithNameArray = await data.all(
    isUserFollowingPeopleTweetAlongWithNameQuery
  );
  console.log("----------");
  console.log("getting the name of the person who tweeted");
  console.log(isUserFollowingPeopleTweetAlongWithNameArray);

  //getting the user request tweet
  const userRequestedTweetQuery = `SELECT user.name as userFollowingPersonName,user.user_id as userFollowingPersonId,tweet.tweet,tweet.tweet_id,tweet.date_time FROM follower INNER JOIN tweet ON follower.following_user_id=tweet.user_id INNER JOIN user ON user.user_id=follower.following_user_id
  WHERE follower.follower_user_id=${user_id} AND tweet.tweet_id=${tweetId};`;
  const userRequestedTweetArray = await data.get(userRequestedTweetQuery);
  console.log("------");
  console.log("user Requested tweet");
  console.log(userRequestedTweetArray);
  if (userRequestedTweetArray === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    //getting the tweet along with the like and reply
    const userRequestedTweetLikeAndReplyQuery = `SELECT 
  tweet.tweet,
  COUNT(DISTINCT(like.like_id)) as likes,
  COUNT(DISTINCT(reply.reply_id)) as replies,
  tweet.date_time as dateTime
  FROM follower INNER JOIN tweet ON 
  follower.following_user_id=tweet.user_id
   INNER JOIN user ON user.user_id=follower.following_user_id 
   INNER JOIN LIKE ON like.tweet_id=tweet.tweet_id
    INNER JOIN REPLY ON reply.tweet_id=tweet.tweet_id
  WHERE follower.follower_user_id=${user_id} AND tweet.tweet_id=${tweetId};`;
    const userRequestedTweetLikeAndReplyArray = await data.get(
      userRequestedTweetLikeAndReplyQuery
    );
    console.log("-----------");
    console.log("user requested tweet along with it's like and reply");
    console.log(userRequestedTweetLikeAndReplyArray);
    response.send(userRequestedTweetLikeAndReplyArray);
  }
});

//displays user requested tweet that are liked by other people
//in this part where the it displays the who all are the user like the particular tweet

app.get(
  "/tweets/:tweetId/likes/",
  authenticatingToken,
  async (request, response) => {
    const { payload, userDetails } = request;
    const { user_id, name } = userDetails;
    const { username, password } = payload;
    const { tweetId } = request.params;

    //returning the users who like the tweet
    const peopleLikedTheTweetQuery = `
      SELECT like.user_id as liked_user_id,tweet.tweet_id,tweet.tweet FROM tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id 
      WHERE tweet.tweet_id=${tweetId}
      `;
    const peopleLikedTheTweetArray = await data.all(peopleLikedTheTweetQuery);
    console.log(peopleLikedTheTweetArray);
    //get the name of the user who liked
    const peopleLikedQuery = `
    SELECT user.name as likes FROM 
    tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id 
    INNER JOIN user ON like.user_id=user.user_id 
    WHERE tweet.tweet_id=${tweetId}
    `;
    const peopleLikedArray = await data.all(peopleLikedQuery);
    console.log("---------");
    console.log("Liked people names");
    console.log(peopleLikedArray);
    //the tweet should be belong to the user follows
    const userFollowingPeopleTweetLikesQuery = `
    SELECT user.username as likes FROM tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id 
    INNER JOIN user ON like.user_id=user.user_id INNER JOIN follower ON follower.following_user_id=tweet.user_id
    WHERE follower.follower_user_id=${user_id} AND tweet.tweet_id=${tweetId};
    `;
    const userFollowingPeopleTweetLikesArray = await data.all(
      userFollowingPeopleTweetLikesQuery
    );
    console.log("________");
    console.log("along with user following people tweets liked people");
    console.log(userFollowingPeopleTweetLikesArray);

    if (userFollowingPeopleTweetLikesArray.length === 0) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send(userFollowingPeopleTweetLikesArray);
    }
  }
);

//displays user requested tweet that are replied by other people
//it displays where who all are replied to the user requested tweet

app.get(
  "/tweets/:tweetId/replies/",
  authenticatingToken,
  async (request, response) => {
    const { payload, userDetails } = request;
    const { user_id, name } = userDetails;
    const { username, password } = payload;
    const { tweetId } = request.params;

    const userFollowingPeopleTweetReplyQuery = `
    SELECT user.username as name,reply.reply as reply FROM tweet INNER JOIN reply ON tweet.tweet_id=reply.tweet_id 
    INNER JOIN user ON reply.user_id=user.user_id INNER JOIN follower ON follower.following_user_id=tweet.user_id
    WHERE follower.follower_user_id=${user_id} AND tweet.tweet_id=${tweetId};
    `;
    const userFollowingPeopleTweetReplyArray = await data.all(
      userFollowingPeopleTweetReplyQuery
    );
    console.log("________");
    console.log("along with user following people tweets liked people");
    console.log({ replies: userFollowingPeopleTweetReplyArray });
    if (userFollowingPeopleTweetReplyArray.length === 0) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const replies = { replies: userFollowingPeopleTweetReplyArray };
      response.send(replies);
    }
  }
);

//user posted tweets
//using this code where we can post a tweet

app.get("/user/tweets/", authenticatingToken, async (request, response) => {
  const { payload, userDetails } = request;
  const { user_id, name } = userDetails;
  const { username, password } = payload;
  const { tweetId } = request.params;
  const userPostedTweetsQuery = `
  SELECT * FROM user INNER JOIN tweet ON user.user_id=tweet.user_id 
  WHERE user.user_id=${user_id};
  `;
  const userPostedTweetsArray = await data.all(userPostedTweetsQuery);
  console.log("_________");
  console.log("user posted tweets");
  console.log(userPostedTweetsArray);

  const userPostedTweetsWithLikesAndRepliesQuerie = `
  SELECT  
  tweet.tweet as tweet,
  COUNT(DISTINCT(like.like_id)) as likes,
  COUNT(DISTINCT(reply.reply_id)) as replies,
  tweet.date_time as dateTime  
  FROM user INNER JOIN tweet ON user.user_id=tweet.user_id 
  INNER JOIN like ON like.tweet_id=tweet.tweet_id
  INNER JOIN reply ON reply.tweet_id=tweet.tweet_id 
  WHERE user.user_id=${user_id}
  GROUP BY tweet.tweet_id;
  `;
  const userPostedTweetsWithLikesAndRepliesArray = await data.all(
    userPostedTweetsWithLikesAndRepliesQuerie
  );
  console.log("-------------");
  console.log("user posted tweet like and replies");
  console.log(userPostedTweetsWithLikesAndRepliesArray);
  response.send(userPostedTweetsWithLikesAndRepliesArray);
});

//post a tweet

app.post("/user/tweets/", authenticatingToken, async (request, response) => {
  const { payload, userDetails } = request;
  const { user_id, name } = userDetails;
  const { username, password } = payload;
  const { tweet } = request.body;

  const postATweetQuery = `
  INSERT INTO tweet(tweet,user_id)
  VALUES(
     '${tweet}',
      ${user_id}
  )
  `;
  const tweetPostedArray = await data.run(postATweetQuery);
  console.log(tweetPostedArray);
  response.send("Created a Tweet");
});

//delete a tweet
//we can delete a tweet

app.delete(
  "/tweets/:tweetId/",
  authenticatingToken,
  async (request, response) => {
    const { payload, userDetails } = request;
    const { user_id, name } = userDetails;
    const { username, password } = payload;

    const { tweetId } = request.params;
    //showing user posted tweet and checking given tweet id is given there
    const userPostedTweetsQuery = `
  SELECT * FROM user INNER JOIN tweet ON user.user_id=tweet.user_id
  WHERE user.user_id=${user_id} AND tweet.tweet_id=${tweetId};
  `;
    const userPostedTweetsArray = await data.all(userPostedTweetsQuery);
    console.log(userPostedTweetsArray);
    if (userPostedTweetsArray.length === 0) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const deleteTweetQuery = `
        DELETE FROM tweet 
        WHERE tweet_id=${tweetId};
        `;
      const deletedTweet = await data.run(deleteTweetQuery);
      response.send("Tweet Removed");
    }
  }
);

//get my tweets
//this part shows the user posted tweets

app.get("/myTweets/", authenticatingToken, async (request, response) => {
  const { payload, userDetails } = request;
  const { user_id, name } = userDetails;
  const { username, password } = payload;

  const getMyPostedTweetsQuery = `
    SELECT username as postedBy,tweet as tweeted FROM user INNER JOIN tweet ON user.user_id=tweet.user_id 
    WHERE user.user_id=${user_id}
    `;
  const userPostedTweetsArray = await data.all(getMyPostedTweetsQuery);
  console.log(userPostedTweetsArray);
  response.send(userPostedTweetsArray);
});
module.exports = app;
