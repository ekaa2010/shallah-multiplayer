const express = require("express");
const app = express();
const http = require("http").Server(app);
const cors = require("cors");
const { Server } = require("socket.io");

app.use(cors());

const io = new Server(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("✅ A user connected");

  socket.on("disconnect", () => {
    console.log("❌ A user disconnected");
  });

  socket.on("send-move", (data) => {
    socket.broadcast.emit("receive-move", data);
  });
});

http.listen(3000, () => {
  console.log("🚀 Server is running on port 3000");
});
