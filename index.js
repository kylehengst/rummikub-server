const WebSocketServer = require("ws").Server;
const http = require("http");
const express = require("express");
const app = express();
const port = process.env.PORT || 5000;
const fs = require("fs");
const utils = require("./utils");
const Rummikub = require("./rummikub");

//start server
app.use(express.static(__dirname + "/"));

const server = http.createServer(app);
server.listen(port);
console.log("http server listening on %d", port);

const webSocketServer = new WebSocketServer({ server: server });
console.log("websocket server created");

let games = {};
let users = {};

app.get("/stats", function (req, res) {
  const data = {
    games: Object.keys(games).map((id) => {
      return {
        id,
        state: games[id].getState(),
      };
    }),
    users,
  };
  const str = JSON.stringify(data, null, 4);
  res.send(`<pre>${str}</pre>`);
  // res.json();
});

//connect client
webSocketServer.on("connection", function (ws) {
  console.log("connection");
  let userId = "";
  let gameId = "";

  // heartbeat?
  let interval = setInterval(() => {
    ws.send(utils.createMessage("pulse"));
  }, 30000);

  ws.send(utils.createMessage("connected"));

  //receive message
  ws.on("message", function (message) {
    const req = utils.parseMessage(message);
    console.log(req);
    if (req.event == "game") {
      gameId = req.id;
      initGame(req.data);
    }
    if (req.event == "start_game") {
      startGame(req.data);
    }
    if (req.event == "get_game") {
      sendGame(req.data.id, false, true);
    }
    if (req.event == "update_game_board") {
      updateGameBoard(req.data);
    }
    if (req.event == "reset_game_board") {
      resetGameBoard();
    }
    if (req.event == "skip_turn") {
      skipTurn(req.data);
    }
    if (req.event == "make_move") {
      makeMove(req.data);
    }
    if (req.event == "user") {
      initUser(req.data);
    }
    if (req.event == "update_user") {
      updateUser(req.data);
    }
  });

  ws.on("close", function () {
    console.log("close", userId, gameId);
    if (games[gameId]) games[gameId].disconnectUser(userId);
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  });

  function initGame(data) {
    if (!games[data.id]) {
      games[data.id] = new Rummikub();
    }
    let userAdded = games[data.id].addUser(userId, ws);
    sendGame(data.id, false, true);
    if (userAdded) {
      const userIds = games[data.id].getUsers();
      sendMessage("new_user", { users: getGameUsers(userIds) }, true);
    }
  }

  function startGame(data) {
    games[data.id].startGame();
    sendMessage("game_started", {});
    // sendGame(data.id);
  }

  function sendGame(gameId, update, userOnly) {
    console.log("sendGame", update, userOnly);
    if (!games[gameId]) {
      ws.send(utils.createMessage("game", { game: null, users: [] }));
      return;
    }
    const userIds = games[gameId].getUsers();
    const gameUsers = getGameUsers(userIds);
    let data = {
      game: games[gameId],
      users: gameUsers,
      update: update || false,
    };
    if (userOnly || !games[gameId].users[userId]) {
      ws.send(utils.createMessage("game", data));
      return;
    }
    games[gameId].sendMessage(utils.createMessage("game", data));
  }
  function updateGameBoard(data) {
    if (games[data.id].currentUser != userId) return;
    sendMessage("game_board_updated", data, true);
  }

  function resetGameBoard(data) {
    sendGame(gameId, true);
  }

  function skipTurn() {
    console.log("skipTurn", gameId, userId);
    let tile = games[gameId].skipTurn(userId);
    ws.send(
      utils.createMessage("new_tile", {
        tile,
      })
    );
    sendGame(gameId, true);
  }

  function makeMove(data) {
    console.log("makePlay", userId, gameId, data);
    let valid = games[gameId].makeMove(userId, data);
    if (valid) {
      games[gameId].users[userId].tiles = data.tiles;
      if (!data.tiles.length) {
        sendMessage("winner", { winner: { name: users[userId].name } });
        games[gameId].end = true;
      }
      sendGame(gameId, true);
      return;
    }
    ws.send(utils.createMessage("invalid_move"));
  }

  function sendMessage(event, data, ignore) {
    games[gameId].sendMessage(
      utils.createMessage(event, data),
      ignore ? userId : null
    );
  }

  function getGameUsers(userIds) {
    let gameUsers = [];
    userIds.forEach((id) => {
      gameUsers.push({
        id,
        name: users[id].name,
      });
    });
    return gameUsers;
  }

  function initUser(data) {
    let user = { id: "", name: "" };
    if (users[data.id]) {
      user.id = data.id;
      user.name = users[data.id].name;
    } else {
      user.id = utils.createUUID();
      users[user.id] = user;
    }
    userId = user.id;
    ws.send(utils.createMessage("user", user));
    // users[user.id].ws = ws;
  }
  function updateUser(data) {
    users[userId].name = data.name;
    // ws.send(utils.createMessage('user_updated', games[data.id]));
  }
});
