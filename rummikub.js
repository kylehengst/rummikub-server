class Rummikub {
  constructor() {
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
    this.pendingBoard = require('./board.json');
    this.started = false;
    this.pending = false;
    this.currentUser = '';
  }
  addUser(userId) {
    let users = this.getUsers();
    if (this.users[userId] || this.started || users.length >= 4) return;
    this.users[userId] = new User();
    if (users.length == 1) {
      this.currentUser = userId;
    }
  }
  getUsers() {
    const users = Object.keys(this.users);
    return users.length ? users : [];
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
  updateBoard(update, remove) {
    this.pendingBoard[update.row][update.col] = new Tile(
      update.config.score,
      update.config.color,
      update.config.isJoker,
      update.config.isOwn,
      update.config.board
    ); 
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
  constructor() {
    this.tiles = [];
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
