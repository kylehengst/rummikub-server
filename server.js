var sqlite3 = require('sqlite3').verbose();

var db = new sqlite3.Database('./db.db', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to database.');
});

// db.serialize(() => {
//   db.each(`SELECT * FROM users`, (err, row) => {
//     if (err) {
//       console.error(err.message);
//     }
//     console.log(row.id + '\t' + row.name);
//   });
// });

let sql = `SELECT * FROM users where id = 5`;

db.all(sql, [], (err, rows) => {
  if (err) {
    throw err;
  }
  console.log(rows, 'rows')
  rows.forEach((row) => {
    console.log(row.username);
  });
});

// db.get(
//   'SELECT * FROM users WHERE username = ? and password = ?',
//   [
//     'kyle',
//     'c5e9fd4723d695d066e7145303c185a2f95116c79b8a84b1ce28a67d0fcd37620671fd81aac2e504c5a6cd7cb458252ce822db4656aa98cedcb62c55b13d86b6',
//   ],
//   (err, row) => {
//     if (err) {
//       throw err;
//     }
//     console.log(row);
//   }
// );

// let sql2 = `
// SELECT G.* 
// FROM games_users AS GU
// LEFT JOIN users as U ON U.id = GU.user_id
// LEFT JOIN games AS G ON G.id = GU.game_id
// WHERE U.username = 'kyle'
// `;

// db.get(sql2, [1], (err, row) => {
//   if (err) {
//     throw err;
//   }
//   console.log(row);
// });

// db.close();

// login
