// File: hash-password.js
const bcrypt = require("bcrypt");
const saltRounds = 10;
const plainPassword = "HIDUPJOKOWI";

bcrypt.hash(plainPassword, saltRounds, function (err, hash) {
  if (err) {
    console.error(err);
    return;
  }
  console.log("--- Password Hash Generator ---");
  console.log("Password Anda:", plainPassword);
  console.log("Simpan HASH ini di database:", hash);
  console.log("-----------------------------");
});
