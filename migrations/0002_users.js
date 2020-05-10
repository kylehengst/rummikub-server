var sqlite3 = require('sqlite3').verbose();

var db = new sqlite3.Database('./data/db.db', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to database.');
});

let users = [
  `INSERT INTO "main"."users" ("id", "username", "email", "password", "uuid", "gamer_tag") VALUES ('1', 'kyle', 'kyle.hengst@gmail.com', 'c5e9fd4723d695d066e7145303c185a2f95116c79b8a84b1ce28a67d0fcd37620671fd81aac2e504c5a6cd7cb458252ce822db4656aa98cedcb62c55b13d86b6', 'faaf84bc-87a5-4984-b942-6bf346e5972a', 'Kyle')`,
  `INSERT INTO "main"."users" ("id", "username", "email", "password", "uuid", "gamer_tag") VALUES ('2', 'oma', 'brunhilde.gehrmann@icloud.com', 'c5e9fd4723d695d066e7145303c185a2f95116c79b8a84b1ce28a67d0fcd37620671fd81aac2e504c5a6cd7cb458252ce822db4656aa98cedcb62c55b13d86b6', '37bd5751-b7a1-48c3-b3ad-95de3025b840', 'Oma')`,
  `INSERT INTO "main"."users" ("id", "username", "email", "password", "uuid", "gamer_tag") VALUES ('3', 'bernhard', 'bernhard.hengst@icloud.com', 'c5e9fd4723d695d066e7145303c185a2f95116c79b8a84b1ce28a67d0fcd37620671fd81aac2e504c5a6cd7cb458252ce822db4656aa98cedcb62c55b13d86b6', 'fc1ef81a-1872-4812-98ef-79929484cdb2', 'Bernhard');`,
];
db.serialize(function () {
  users.forEach((user) => {
    db.run(user, (err) => {
      if (err) console.log(err.message);
    });
  });
});

db.close();
