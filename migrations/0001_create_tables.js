var sqlite3 = require('sqlite3').verbose();

var db = new sqlite3.Database('./data/db.db', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to database.');
});

let users = `
CREATE TABLE "users" (
	"id"	INTEGER PRIMARY KEY AUTOINCREMENT,
	"username"	TEXT UNIQUE,
	"email"	TEXT,
	"password"	TEXT,
	"uuid"	TEXT UNIQUE,
	"gamer_tag"	TEXT
);
`;
let games = `
CREATE TABLE "games" (
	"id"	INTEGER PRIMARY KEY AUTOINCREMENT,
	"name"	TEXT UNIQUE,
	"tiles"	TEXT,
	"board"	TEXT,
	"started"	INTEGER DEFAULT 0,
	"complete"	INTEGER DEFAULT 0,
	"current_user"	INTEGER,
	"winning_user"	INTEGER,
	"date_created"	TEXT,
	FOREIGN KEY("winning_user") REFERENCES "users"("id"),
	FOREIGN KEY("current_user") REFERENCES "users"("id")
);`;
let games_users = `
CREATE TABLE "games_users" (
	"id"	INTEGER PRIMARY KEY AUTOINCREMENT,
	"user_id"	INTEGER,
	"game_id"	INTEGER,
	"shelf"	TEXT,
	"in_play"	INTEGER DEFAULT 0,
	FOREIGN KEY("user_id") REFERENCES "users"("id"),
	FOREIGN KEY("game_id") REFERENCES "games"("id")
);
`;
db.serialize(function () {
  db.run(users, (err) => {
    if (err) console.log(err.message);
  });
  db.run(games, (err) => {
    if (err) console.log(err.message);
  });
  db.run(games_users, (err) => {
    if (err) console.log(err.message);
  });
});

db.close();
