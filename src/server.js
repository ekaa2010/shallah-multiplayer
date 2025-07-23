const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // allow all for testing
    methods: ["GET", "POST"]
  }
});

const rooms = {};

io.on("connection", (socket) => {
  console.log("✅ A user connected:", socket.id);

  socket.on("createRoom", ({ playerId }) => {
    const roomId = generateRoomId();
    rooms[roomId] = {
      players: [socket],
      playerIds: [playerId]
    };
    socket.join(roomId);
    console.log(`✅ Room created: ${roomId} by player ${playerId}`);
    socket.emit("roomCreated", { roomId, playerId });
  });

  socket.on("joinRoom", ({ roomId, playerId }) => {
    const room = rooms[roomId];
    if (room && room.players.length === 1) {
      room.players.push(socket);
      room.playerIds.push(playerId);
      socket.join(roomId);
      console.log(`✅ Player joined room ${roomId}`);

      room.players.forEach(p =>
        p.emit("playerJoined", { roomId, playerId })
      );

      // Start countdown for game
      startCountdown(io, roomId);
    } else {
      socket.emit("joinError", "Room full or does not exist.");
    }
  });

  socket.on("disconnect", () => {
    console.log("⚠️ A user disconnected");
    for (const roomId in rooms) {
      const room = rooms[roomId];
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[roomId];
      } else {
        io.to(roomId).emit("opponentDisconnected");
      }
    }
  });
});

function startCountdown(io, roomId) {
  let countdown = 3;
  const interval = setInterval(() => {
    io.to(roomId).emit("waitingStart", { countdown });
    if (countdown === 0) {
      clearInterval(interval);
      // ✅ host should emit startGame AFTER countdown
      io.to(roomId).emit("triggerStartGameFromHost", {});
    }
    countdown--;
  }, 1000);
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

server.listen(10099, () => {
  console.log("🚀 Server running on http://localhost:10099");
});
