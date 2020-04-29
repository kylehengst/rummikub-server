class Rummikub {
  constructor(data) {
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
    this.board = require('./board.json');
    this.started = false;
    this.pending = false;
    this.end = false;
    this.currentUser = '';
    if (data) {
      Object.keys(data).forEach((key) => {
        this[key] = data[key];
      });
    }
  }
  addUser(userId, ws) {
    let users = this.getUsers();
    if (this.users[userId] && !this.users[userId].ws) {
      this.users[userId].ws = ws;
      return;
    }
    if (this.started || users.length >= 4) return false;
    this.users[userId] = new User(ws);
    if (users.length == 1) {
      this.currentUser = userId;
    }
    return true;
  }
  disconnectUser(userId) {
    if (!this.users[userId] || !this.users[userId].ws) return;
    delete this.users[userId].ws;
  }
  getUsers() {
    const users = Object.keys(this.users);
    return users.length ? users : [];
  }
  getUserTiles(userId) {
    return this.users[userId].tiles;
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
      user.tiles = [];
      for (var idx = 0; idx < 14; idx++) {
        let tile = this.tiles.pop();
        tile.isOwn = true;
        user.tiles.push(tile);
      }
    });

    this.started = true;

    this.shuffle(users);
    this.currentUser = users[0];
  }
  skipTurn(userId) {
    // next player
    this.nextPlayer(userId);
    // add user tile
    let tile = this.tiles.pop();
    tile.isOwn = true;
    this.users[userId].tiles.push(tile);
    return tile;
  }
  makeMove(userId, data) {
    // validate move
    let moveValid = true;
    let totalScore = 0;
    let inPlay = this.users[userId].inPlay;

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
        if (tile.isOwn || inPlay) group.push(tile);
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

    console.log('makeMove', moveValid, totalScore);

    if (!moveValid || (totalScore < 30 && !this.users[userId].inPlay))
      return false;

    // update board
    this.board = data.board;
    this.users[userId].inPlay = true;

    // next player
    this.nextPlayer(userId);

    return true;
  }
  nextPlayer(userId) {
    let users = this.getUsers();
    let index = users.indexOf(userId);
    index++;
    if (index >= users.length) index = 0;
    console.log('nextPlayer', users, users[index]);
    this.currentUser = users[index];
  }
  getState(full, userId) {
    // let users = this.getUsers().map((id) => {
    //   return {
    //     id,
    //     connected: this.users[id].ws ? true : false,
    //     tiles: full ? this.users[id].tiles : this.users[id].tiles.length
    //   };
    // });
    let users = {};
    this.getUsers().forEach((id) => {
      users[id] = {
        inPlay: false,
        connected: this.users[id].ws ? true : false,
        tiles:
          full || userId == id
            ? this.users[id].tiles
            : this.users[id].tiles.length,
      };
    });
    let data = {
      tiles: this.tiles.length,
      started: this.started,
      end: this.end,
      currentUser: this.currentUser,
      users,
    };
    if (full) {
      data.tiles = this.tiles;
      data.board = this.board;
    }
    return data;
  }
  sendMessage(data, ignoreUserId) {
    this.getUsers().forEach((id) => {
      if (id == ignoreUserId || !this.users[id].ws) return;
      this.users[id].ws.send(data);
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
  constructor(ws) {
    this.ws = ws;
    this.tiles = [];
    this.inPlay = false;
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
