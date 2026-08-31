const express = require("express");
const { listModels } = require("../config/models");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ object: "list", data: listModels() });
});

module.exports = router;
