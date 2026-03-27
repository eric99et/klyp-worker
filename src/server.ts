import express from "express";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/", (_req, res) => {
  res.status(200).send("Klyp worker running");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Worker running on port ${PORT}`);
});
