const WebSocketServer = require('ws').Server;
const http = require('http');
const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
const fs = require('fs');

//start server
app.use(express.static(__dirname + '/'));

const server = http.createServer(app);
server.listen(port);
console.log('http server listening on %d', port);

const webSocketServer = new WebSocketServer({ server: server });
console.log('websocket server created');

//broadcast client
webSocketServer.broadcast = function (data) {
  //console.log("[broadcast msg]=" + JSON.stringify(data));
  for (let i in rummikub.users) {
    rummikub.users[i].ownWebsocket.send(JSON.stringify(data));
  }
};

//send specific client
webSocketServer.sendMessage = function (data, id) {
  //console.log("[send msg -> " + id + "]=" + JSON.stringify(data));
  for (let i in rummikub.users) {
    if (id == rummikub.users[i].id) {
      rummikub.users[i].ownWebsocket.send(JSON.stringify(data));
    }
  }
};

//connect client
webSocketServer.on('connection', function (ws) {
  //   const user = new User(
  //     BOARD.USER_PREFIX + UTIL.random4digit(),
  //     ws,
  //     UTIL.randomChatColor()
  //   );
  //   rummikub.users.push(user);

  //receive message
  ws.on('message', function (message) {
    const requestObject = JSON.parse(message);

    //console.log("[Message Received] Command : " + requestObject.command + " Param : " + requestObject.param);
    console.log('[Message Received] Command : ' + requestObject.command);
  });

  ws.on('close', function () {});
});
