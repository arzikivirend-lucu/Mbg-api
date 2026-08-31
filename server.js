const app = require("./src/app");

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Mindbot Genius API Platform jalan di http://localhost:${PORT}`);
});
