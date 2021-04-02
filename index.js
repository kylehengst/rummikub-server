const WebSocketServer = require('ws').Server;
const http = require('http');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const port = process.env.PORT || 5000;
const fs = require('fs');
const utils = require('./utils');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const db = new sqlite3.Database('./data/db.db', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to database.');
});

let salt = 'VRVaFnx0bmTSf1zk';
let jwtSalt = 'Lgj61MONMw3auv8fa';
const Rummikub = require('./rummikub');

// catch errors
process.on('uncaughtException', (err) => {
  console.error('There was an uncaught error', err.message);
  process.exit(1); //mandatory (as per the Node.js docs)
});

//start server
app.use(express.static(__dirname + '/'));
app.use(bodyParser.json());
app.use(cors());

app.post('/login', (req, res) => {
  console.log(req.body, salt);

  authUser(req.body.username, req.body.password)
    .then((auth) => {
      res.json(auth);
    })
    .catch((err) => {
      res.status(401).json({ message: err.message || 'error' });
    });
});

app.post('/signup', (req, res) => {
  // basic validation
  ['username', 'password', 'gamer_tag'].forEach((key) => {
    if (!req.body[key]) {
      res.status(401).send({
        message: `${key} is required`,
      });
      return;
    }
  });
  let password = req.body.password;
  // check if user exists
  getUser(req.body.username)
    .then((user) => {
      if (user) {
        throw { message: 'Username already exists' };
      }
      return getUserHash(req.body.password);
    })
    .then((hash) => {
      req.body.password = hash;
      return createUser(req.body);
    })
    .then(() => {
      return authUser(req.body.username, password);
    })
    .then((auth) => {
      console.log('signup auth', auth);
      res.json(auth);
    })
    .catch((err) => {
      console.log('signup error', err);
      res.status(401).json({ message: err.message || 'error' });
    });
});

const server = http.createServer(app);
server.listen(port);
console.log('http server listening on %d', port);

const webSocketServer = new WebSocketServer({ server: server });
console.log('websocket server created');

let liveGames = {};

app.get('/stats', function (req, res) {
  const data = {
    games: getGames(),
  };
  const str = JSON.stringify(data, null, 4);
  res.send(`<pre>${str}</pre>`);
  // res.json();
});

//connect client
webSocketServer.on('connection', function (ws) {
  // jwtSalt = utils.createUUID();
  console.log('connection');

  let USER_ID = 0;
  let USER_NAME = '';
  let USER_UUID = '';
  let GAME_NAME = '';

  // heartbeat?
  let interval = setInterval(() => {
    ws.send(utils.createMessage('pulse'));
  }, 30000);

  ws.send(utils.createMessage('connected'));

  //receive message
  ws.on('message', function (message) {
    const req = utils.parseMessage(message);
    console.log('event', req.event, 'user_id', USER_NAME, 'game_id', GAME_NAME);

    if (req.event == 'user') {
      jwt.verify(req.data.id, jwtSalt, (err, authData) => {
        if (err) {
          console.log('Could not verify token', req.data.id);
          return;
        }
        console.log(authData);
        USER_ID = authData.id;
        USER_NAME = authData.username;
        USER_UUID = authData.uuid;
        sendUserDetails(authData.username);
      });
      return;
    }
    if (req.event == 'update_user') {
      updateUser(req.data);
      return;
    }

    // user id required beyond this point
    if (!USER_NAME) {
      ws.send(utils.createMessage('reset'));
      return;
    }

    if (req.event == 'create_game') {
      GAME_NAME = utils.createUUID();
      initGame();
      return;
    }

    if (req.event == 'game_details') {
      // sendGame(req.data.id, false, true);
      getGame(req.data.id).then((game) => {
        ws.send(utils.createMessage('game_details', { game }));
      });
      return;
    }

    if (req.event == 'get_game') {
      sendGame(req.data.id, false, true);
      // getGame(req.data.id).then((game) => {
      //   ws.send(utils.createMessage('game_details', { game }));
      // });
      return;
    }

    if (req.event == 'game') {
      GAME_NAME = req.id;
      initGame();
      return;
    }

    // valid game id required
    if (!GAME_NAME || !liveGames[GAME_NAME]) {
      ws.send(utils.createMessage('reset'));
      return;
    }

    if (req.event == 'start_game') {
      startGame(req.data);
    }
    if (req.event == 'update_game_board') {
      updateGameBoard(req.data);
    }
    if (req.event == 'reset_game_board') {
      resetGameBoard();
    }
    if (req.event == 'skip_turn') {
      skipTurn(req.data);
    }
    if (req.event == 'make_move') {
      makeMove(req.data);
    }
    if (req.event == 'rematch') {
      rematch();
    }
    if (req.event == 'remove') {
      remove();
    }
  });

  ws.on('close', function () {
    // db.close();
    console.log('close', USER_NAME, GAME_NAME);
    if (liveGames[GAME_NAME]) liveGames[GAME_NAME].disconnectUser(USER_UUID);
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  });

  function initGame() {
    (async () => {
      let game = await getGame(GAME_NAME);
      let rummikub;

      // check for a live game
      if (liveGames[GAME_NAME]) rummikub = liveGames[GAME_NAME];

      if (rummikub && game) {
        // update live game
        console.log('update game', GAME_NAME);
        rummikub.updateData(game);
      } else if (game) {
        // create new live game with existing data
        console.log('new game with existing data', GAME_NAME);
        rummikub = new Rummikub(game);
      } else {
        // create new game
        console.log('new game', GAME_NAME);
        rummikub = new Rummikub();
        // save game
        await createGame(GAME_NAME, rummikub);
        game = await getGame(GAME_NAME);
        rummikub.id = game.id;
        rummikub.name = game.name;
      }
      // add to live games
      if (!liveGames[GAME_NAME]) {
        liveGames[GAME_NAME] = rummikub;
      }
      // add user
      let userAdded = rummikub.addUser(USER_ID, USER_UUID, ws);
      if (userAdded) {
        console.log('user added', USER_ID, game.id);
        await addGameUser(USER_ID, game.id);
      }
      let users = await getGameUsers(game.id);
      if (userAdded) {
        sendMessage(
          'new_user',
          {
            users: users.map((user) => {
              if (user.id != USER_UUID) {
                user.shelf = user.shelf.flat().length;
              }
              return user;
            }),
          },
          true
        );
      }
      rummikub.updateData({ users });
      sendGame(GAME_NAME, false, true);
    })().catch((err) => {
      console.log('initGame', err);
    });
  }

  function startGame(data) {
    liveGames[GAME_NAME].startGame();
    (async () => {
      await saveGame(GAME_NAME, liveGames[GAME_NAME]);
      // let state = liveGames[GAME_NAME].getState();
      let users = liveGames[GAME_NAME].getUsers();
      for (let i = 0; i < users.length; i++) {
        let id = users[i];
        let user = liveGames[GAME_NAME].users[id];
        console.log('update user', user.id, liveGames[GAME_NAME].id);
        await saveGameUser(user.id, liveGames[GAME_NAME].id, {
          shelf: user.shelf,
          in_play: 0,
        });
      }
      sendMessage('game_started', {});
    })();
    // sendGame(data.id);
  }

  function sendGame(gameId, update, userOnly) {
    if (!liveGames[gameId]) {
      ws.send(utils.createMessage('game', { game: null, users: [] }));
      return;
    }

    (async () => {
      // const users = await getGameUsers(liveGames[gameId].id, USER_ID);
      // const users = liveGames[gameId].getUsers();
      let data = {
        id: gameId,
        game: liveGames[gameId].getState(true, USER_ID),
        users: liveGames[gameId].getUsersAsArray(),
        update: update || false,
      };
      console.log('sendGame', update, userOnly);
      if (userOnly || !liveGames[gameId].users[USER_UUID]) {
        ws.send(utils.createMessage('game', data));
        return;
      }
      liveGames[gameId].sendMessage(utils.createMessage('game', data));
    })();
  }
  function updateGameBoard(data) {
    console.log('updateGameBoard', data);
    if (liveGames[GAME_NAME].current_user != USER_ID) return;
    sendMessage('game_board_updated', data, true);
  }

  function resetGameBoard(data) {
    sendGame(GAME_NAME, true);
  }

  function skipTurn(data) {
    let user = liveGames[GAME_NAME].users[USER_UUID];
    user.shelf = data.shelf;
    console.log('skipTurn', GAME_NAME, USER_NAME);
    let tile = liveGames[GAME_NAME].skipTurn(USER_UUID);
    ws.send(
      utils.createMessage('new_tile', {
        tile,
      })
    );
    // add tile to shelf
    sendGame(GAME_NAME, true);
    saveGame(GAME_NAME, liveGames[GAME_NAME]);
    // user.shelf = data.shelf;
    saveGameUser(USER_ID, liveGames[GAME_NAME].id, {
      shelf: user.shelf,
      in_play: user.in_play,
    });
  }

  function makeMove(data) {
    let valid = liveGames[GAME_NAME].makeMove(USER_UUID, data);
    if (!valid) {
      ws.send(utils.createMessage('invalid_move'));
      return;
    }
    (async () => {
      let user = liveGames[GAME_NAME].users[USER_UUID];
      user.shelf = data.shelf;

      await saveGameUser(USER_ID, liveGames[GAME_NAME].id, {
        shelf: user.shelf,
        in_play: user.in_play ? 1 : 0,
      });

      let userTiles = user.shelf.flat().filter((tile) => {
        return tile;
      });

      if (!userTiles.length) {
        sendMessage('winner', { winner: { name: user.gamer_tag } });
        liveGames[GAME_NAME].complete = true;
        liveGames[GAME_NAME].winning_user = USER_ID;
      }

      await saveGame(GAME_NAME, liveGames[GAME_NAME]);

      sendGame(GAME_NAME, true);
      // save game
    })();
  }

  function remove() {
    (async () => {
      await deleteGameUsers(liveGames[GAME_NAME].id);
      await deleteGame(liveGames[GAME_NAME].id);
      sendMessage('removed', { id: GAME_NAME });
    })().catch((err) => {
      console.log('remove', err);
    });
  }

  function rematch() {
    (async () => {
      // create new game
      let gameName = utils.createUUID();
      let rummikub = new Rummikub();
      let gameId = await createGame(gameName, rummikub);

      // add users
      let users = liveGames[GAME_NAME].getUsers();
      for (let i = 0; i < users.length; i++) {
        let user = liveGames[GAME_NAME].users[users[i]];
        rummikub.addUser(user.id, users[i], user.ws);      
      }
      
      // start game
      rummikub.startGame();

      // add and save user tiles
      let usersArray = rummikub.getUsersAsArray();
      for (let i = 0; i < usersArray.length; i++) {
        await addGameUser(usersArray[i].id, gameId);
        await saveGameUser(usersArray[i].id, gameId, {
          shelf: usersArray[i].shelf,
          in_play: 0,
        });         
      }      

      // update users
      let gameUsers = await getGameUsers(gameId);
      rummikub.updateData({ users: gameUsers });

      // save game
      await saveGame(gameName, rummikub);

      // add to live games
      rummikub.id = gameId;
      rummikub.name = gameName;
      liveGames[gameName] = rummikub;

      sendMessage('rematch', { id: gameName });
    })().catch((err) => {
      console.log('initGame', err);
    });
  }

  function saveGames() {
    let data = {};
    Object.keys(liveGames).forEach((id) => {
      data[id] = liveGames[id].getState(true);
    });
    fs.writeFileSync(`./data/games.json`, JSON.stringify(data));
  }

  function sendMessage(event, data, ignore) {
    liveGames[GAME_NAME].sendMessage(
      utils.createMessage(event, data),
      ignore ? USER_UUID : null
    );
  }
  function updateUser(data) {
    users[USER_NAME].name = data.name;

    let savedata = {};
    Object.keys(users).forEach((id) => {
      if (!users[id].name) return;
      savedata[id] = users[id];
    });
    sendUserDetails(USER_NAME);
    fs.writeFileSync(`./data/users.json`, JSON.stringify(savedata));
    // ws.send(utils.createMessage('user_updated', games[data.id]));
  }
  function sendUserDetails(username) {
    (async () => {
      let user = await getUser(username);
      let games = await getUserGames(username);
      for (let i = 0; i < games.length; i++) {
        let gameUsers = await getGameUsers(games[i].id);
        games[i].users = gameUsers;
        games[i].board = JSON.parse(games[i].board);
        games[i].tiles = JSON.parse(games[i].tiles);
      }
      let data = {
        user,
        games,
      };
      console.log('sendUserDetails', username);
      ws.send(utils.createMessage('user', data));
    })().catch((err) => {
      console.log(err.message);
    });
  }
});

// FORMAT OF TOKEN
// Authorization: Bearer <access_token>

// Verify Token
function verifyToken(req, res, next) {
  // Get auth header value
  const bearerHeader = req.headers['authorization'];
  // Check if bearer is undefined
  if (typeof bearerHeader !== 'undefined') {
    // Split at the space
    const bearer = bearerHeader.split(' ');
    // Get token from array
    const bearerToken = bearer[1];
    // Set the token
    req.token = bearerToken;
    // Next middleware
    next();
  } else {
    // Forbidden
    res.sendStatus(403);
  }
}

function authUser(username, password) {
  let p = new Promise((resolve, reject) => {
    getUserHash(password)
      .then((hash) => {
        return getUser(username, hash);
      })
      .then((row) => {
        if (!row) {
          throw { message: 'Invalid request' };
        }
        jwt.sign(
          { id: row.id, username: row.username, uuid: row.uuid },
          jwtSalt,
          (err, token) => {
            if (err) {
              throw { message: 'Invalid token' };
            }
            resolve({ token });
          }
        );
      })
      .catch(reject);
  });
  return p;
}

function getUserHash(password) {
  let p = new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(derivedKey.toString('hex'));
    });
  });
  return p;
}

function getUser(username, password) {
  let p = new Promise((resolve, reject) => {
    let sql =
      'SELECT id, username, email, gamer_tag, uuid from users WHERE (id = ? OR username = ?)';
    if (password) {
      sql += ' AND password = ?';
    }

    db.get(sql, [username, username, password], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      if (!row) {
        resolve(null);
        return;
      }
      resolve(row);
    });
  });
  return p;
}

function createUser(data) {
  let p = new Promise((resolve, reject) => {
    let sql = `
    INSERT INTO users(username, password, gamer_tag, email, uuid) VALUES(?,?,?,?,?)
  `;
    db.run(
      sql,
      [
        data.username,
        data.password,
        data.gamer_tag,
        data.email,
        utils.createUUID(),
      ],
      function (err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      }
    );
  });
  return p;
}

function getUserGame(username, game) {
  let p = new Promise((resolve, reject) => {
    let sql = `
  SELECT GU.* 
  FROM games_users AS GU
  LEFT JOIN users as U ON U.id = GU.user_id
  LEFT JOIN games AS G ON G.id = GU.game_id
  WHERE U.username = ? AND G.name = ?
`;
    db.get(sql, [username, game], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
  return p;
}

function getUserGames(username) {
  let p = new Promise((resolve, reject) => {
    getUser(username).then(() => {
      let sql = `
        SELECT 
          G.*, 
          C.username AS current_username, C.gamer_tag as current_gamer_tag, 
          W.username AS winning_username, W.gamer_tag as winning_gamer_tag
        FROM games_users AS GU
        LEFT JOIN users as U ON U.id = GU.user_id
        LEFT JOIN games AS G ON G.id = GU.game_id
        LEFT JOIN users AS C ON C.id = G.current_user
        LEFT JOIN users AS W ON W.id = G.winning_user
        WHERE U.username = ?
        ORDER BY G.id DESC
        LIMIT 10
      `;
      db.all(sql, [username], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  });
  return p;
}

function getGameUsers(id, userId) {
  let p = new Promise((resolve, reject) => {
    let sql = `
    SELECT U.id, U.username, U.gamer_tag, U.uuid, GU.in_play, GU.shelf 
    FROM games_users AS GU
    LEFT JOIN users as U ON U.id = GU.user_id
    WHERE GU.game_id = ?
  `;
    db.all(sql, [id], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      rows.forEach((row) => {
        let shelf = JSON.parse(row.shelf);
        // if (userId && row.id != userId) shelf = shelf.flat().length;
        row.shelf = shelf;
      });
      resolve(rows);
    });
  });
  return p;
}

function getGame(name) {
  let p = new Promise((resolve, reject) => {
    let sql = 'SELECT * FROM games WHERE name = ?';

    db.get(sql, [name], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      if (!row) {
        resolve(null);
        return;
      }
      getGameUsers(row.id)
        .then((users) => {
          row.board = JSON.parse(row.board);
          row.tiles = JSON.parse(row.tiles);
          row.users = users;
          resolve(row);
        })
        .catch(reject);
    });
  });
  return p;
}

function createGame(gameId, rummikub) {
  let p = new Promise((resolve, reject) => {
    let sql = `
    INSERT INTO games(name, tiles, board, date_created) VALUES(?,?,?,?)
  `;
    let state = rummikub.getState(true);
    db.run(
      sql,
      [
        gameId,
        JSON.stringify(state.tiles),
        JSON.stringify(state.board),
        state.date_created,
      ],
      function (err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      }
    );
  });
  return p;
}

function deleteGameUsers(gameId) {
  let p = new Promise((resolve, reject) => {
    let sql = `
    DELETE FROM games_users WHERE game_id = ?
  `;
    // let state = rummikub.getState(true);
    db.run(
      sql,
      [
        gameId,
      ],
      function (err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(true);
      }
    );
  });
  return p;
}

function deleteGame(gameId) {
  let p = new Promise((resolve, reject) => {
    let sql = `
    DELETE FROM games WHERE id = ?
  `;
    db.run(
      sql,
      [
        gameId,
      ],
      function (err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(true);
      }
    );
  });
  return p;
}

function addGameUser(userId, gameId) {
  let p = new Promise((resolve, reject) => {
    let sql = `
    INSERT INTO games_users(user_id, game_id, shelf) VALUES(?,?,?)
  `;
    // let state = rummikub.getState(true);
    db.run(sql, [userId, gameId, '[]'], function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this.lastID);
    });
  });
  return p;
}

function saveGame(name, rummikub) {
  let p = new Promise((resolve, reject) => {
    let state = rummikub.getState(true);
    let sql = `UPDATE games 
    SET 
      tiles = ?, 
      board = ?, 
      started = ?, 
      complete = ?, 
      current_user = ?, 
      winning_user = ?
    WHERE name = ?
    `;
    db.run(
      sql,
      [
        JSON.stringify(state.tiles),
        JSON.stringify(state.board),
        state.started,
        state.complete,
        state.current_user,
        state.winning_user,
        name,
      ],
      function (err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      }
    );
  });
  return p;
}

function saveGameUser(userId, gameId, data) {
  let p = new Promise((resolve, reject) => {
    // let state = rummikub.getState(true);
    let sql = `UPDATE games_users
    SET 
      shelf = ?, 
      in_play = ?
    WHERE user_id = ? AND game_id = ?
    `;
    db.run(
      sql,
      [JSON.stringify(data.shelf), data.in_play, userId, gameId],
      function (err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      }
    );
  });
  return p;
}

function getGames() {
  return Object.keys(liveGames).map((id) => {
    let state = liveGames[id].getState(true);
    state.tiles = state.tiles.length;
    state.board = [];
    return {
      id,
      state,
    };
  });
}
