class Rummikub {
  constructor(data) {
    this.id = 0;
    this.name = '';
    this.scores = [
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
      '13',
    ];
    this.colors = [
      'red',
      'blue',
      'yellow',
      'black',
      'red',
      'blue',
      'yellow',
      'black',
    ];
    this.tiles = [];
    this.users = {};
    this.sockets = {};
    this.board = require('./board.json');
    this.started = 0;
    this.complete = 0;
    this.current_user = 0;
    this.winning_user = 0;
    if (data) {
      this.updateData(data);
    } else {
      this.date_created = new Date().getTime();
    }
  }
  updateData(data) {
    console.log('update data', Object.keys(data));
    Object.keys(data).forEach((key) => {
      if (key == 'users') {
        data.users.forEach((user) => {
          // user.shelf = JSON.parse(user.shelf);
          this.users[user.uuid] = user;
        });
        return;
      }
      if (!(data[key] instanceof Array))
      console.log(key, this[key], data[key]);
      this[key] = data[key];
    });
  }
  addUser(id, uuid, ws) {
    console.log('addUser', uuid);
    let users = this.getUsers();
    this.sockets[uuid] = ws;
    if (this.users[uuid]) {
      return;
    }
    if (this.started || users.length >= 4) return false;
    this.users[uuid] = new User(id, ws);
    if (users.length == 1) {
      this.current_user = id;
    }
    return true;
  }
  disconnectUser(userId) {
    if (!this.sockets[userId]) return;
    delete this.sockets[userId];
  }
  getUsers() {
    const users = Object.keys(this.users);
    return users.length ? users : [];
  }
  getUsersAsArray() {
    return this.getUsers().map(id => {
      return this.users[id];
    })
  }
  getUserTiles(userId) {
    return this.users[userId].shelf;
  }
  startGame() {
    //init
    this.tiles = [];

    for (var i in this.colors) {
      for (var j in this.scores) {
        this.tiles.push(new Tile(this.scores[j], this.colors[i], false));
      }
    }
    // add joker tiles
    this.tiles.push(new Tile('30', '', true));
    this.tiles.push(new Tile('30', '', true));

    this.shuffle(this.tiles);

    // assign tiles to users
    let users = this.getUsers();
    users.forEach((id) => {
      let user = this.users[id];
      user.shelf = JSON.parse(JSON.stringify(require('./shelf.json')));
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 7; col++) {
          let tile = this.tiles.pop();
          tile.isOwn = true;
          user.shelf[row][col] = tile;
        }
      }
    });

    this.started = 1;

    this.shuffle(users);
    this.current_user = this.users[users[0]].id;
  }
  skipTurn(userId) {
    // next player
    this.nextPlayer(userId);
    // add user tile
    let tile = this.tiles.pop();
    tile.isOwn = true;

    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < this.users[userId].shelf[0].length; col++) {
        if (!this.users[userId].shelf[row][col]) continue;
        this.users[userId].shelf[row][col] = tile;
        break;
      }
    }

    return tile;
  }
  makeMove(userId, data) {
    // validate move
    let moveValid = true;
    let totalScore = 0;
    let in_play = this.users[userId].in_play;
    let tilesPlayed = 0;

    // get groups
    let tileGroups = [];
    data.board.forEach((row) => {
      let group = [];
      row.forEach((tile) => {
        if (!tile) {
          if (group.length) {
            tileGroups.push(group);
            group = [];
          }
          return;
        }
        if (tile.isOwn) tilesPlayed++;
        if (tile.isOwn || in_play) group.push(tile);
        tile.isOwn = false;
      });
    });
    // validate groups
    tileGroups.forEach((group) => {
      if (group.length < 3) moveValid = false;

      let tileScore = 0;

      // check if same numbers
      let sameNumber = true;
      let colors = [];
      group.forEach((tile) => {
        if (tile.isJoker) return;
        if (!tileScore) {
          tileScore = tile.score;
          colors.push(tile.color);
          return;
        }
        if (tile.score != tileScore || colors.includes(tile.color))
          sameNumber = false;
      });

      if (sameNumber) {
        totalScore += tileScore * group.length;
        return;
      }

      // check if sequence
      let isSequence = true;
      tileScore = 0;
      let groupTotal = 0;
      let groupIndex = 0;
      let jokerIsFirst = false;
      group.forEach((tile, tileIndex) => {
        if (!tileIndex && tile.isJoker) {
          jokerIsFirst = true;
          return;
        }
        if (!tileScore) {
          groupTotal = tileScore = parseInt(tile.score);
          if (jokerIsFirst) {
            groupTotal += groupTotal - 1;
          }
          groupIndex++;
          return;
        }
        if (!tile.isJoker && tileScore + groupIndex != tile.score) {
          isSequence = false;
          return;
        }
        groupTotal =
          groupTotal +
          (tile.isJoker ? tileScore + tileIndex : parseInt(tile.score));
        groupIndex++;
      });

      totalScore += groupTotal;

      if (!sameNumber && !isSequence) {
        moveValid = false;
      }
    });
    console.log('group', tileGroups);

    console.log('makeMove', moveValid, totalScore, tilesPlayed);

    if (
      !tilesPlayed ||
      !moveValid ||
      (totalScore < 30 && !this.users[userId].in_play)
    )
      return false;

    // update board
    this.board = data.board;
    this.users[userId].in_play = true;

    // next player
    this.nextPlayer(userId);

    return true;
  }
  nextPlayer(userId) {
    let users = this.getUsers();
    let index = users.indexOf(userId);
    index++;
    if (index >= users.length) index = 0;
    console.log('nextPlayer', userId, users, users[index]);
    this.current_user = this.users[users[index]].id;
  }
  getState(full, userId) {
    let users = {};
    this.getUsers().forEach((id) => {
      let data = JSON.parse(JSON.stringify(this.users[id]));
      data.connected = this.sockets[id] ? true : false,
      data.shelf = full || userId == id
      ? data.shelf
      : data.shelf.flat().length,
      users[id] = data;
    });
    let data = {
      id: this.id,
      name: this.name,
      tiles: this.tiles.length,
      started: this.started,
      complete: this.complete,
      current_user: this.current_user,
      winning_user: this.winning_user,
      users,
      date_created: this.date_created,
    };
    if (full) {
      data.tiles = this.tiles;
      data.board = this.board;
    }
    return data;
  }
  sendMessage(data, ignoreUserId) {
    this.getUsers().forEach((id) => {
      if (id == ignoreUserId || !this.sockets[id]) return;
      this.sockets[id].send(data);
    });
  }

  shuffle(array) {
    for (var i = array.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }
}

class User {
  constructor(id, ws) {
    this.id = id;
    this.ws = ws;
    this.shelf = [[],[]];
    this.in_play = false;
  }
}

class Tile {
  constructor(score, color, isJoker, isOwn, board) {
    this.score = score;
    this.color = color;
    this.isJoker = isJoker;
    this.isOwn = isOwn;
    this.board = board || false;
  }
}

module.exports = Rummikub;
