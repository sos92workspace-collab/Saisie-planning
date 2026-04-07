const range = "08:00:00 - 13:40:00";
const match = range.match(/(\d+)(?:[hH:\.](\d*))?\s*[-a-zA-Zà-ÿ\s/,]*\s*(\d+)(?:[hH:\.](\d*))?/);
console.log(match);
