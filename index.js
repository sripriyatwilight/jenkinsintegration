const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.send("Jenkins");
});

app.listen(3000);
