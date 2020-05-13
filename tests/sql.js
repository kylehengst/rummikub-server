var sqlite3 = require('sqlite3').verbose();

var db = new sqlite3.Database('./data/db.db', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to database.');
});

let queries = [
//   `DELETE FROM games_users WHERE game_id = ( SELECT id FROM games WHERE name = 'b59c79d8-2727-41d3-b905-957bc325d4e5' )`,
//   `DELETE FROM games_users WHERE game_id = ( SELECT id FROM games WHERE name = 'b59c79d8-2727-41d3-b905-957bc325d4e5' )`,
  `UPDATE games SET complete = 1 WHERE name = '7189ba7d-45d2-4670-b9e5-db36741a9d30'`,
];
db.serialize(function () {
  queries.forEach((user) => {
    db.run(user, (err) => {
      if (err) console.log(err.message);
    });
  });
});

db.close();
