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

  socket.on("joinRoom", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit("roomNotFound", { message: "Room not found." });
      return;
    }
    if (room.players.length >= 2) {
      socket.emit("roomFull", { message: "Room is full." });
      return;
    }

    room.players.push(socket);
    socket.join(roomId);

    const playerId = 1; // second player always gets 1
    room.playerIds.push(playerId);
    socket.emit("playerIdAssigned", { playerId });
    socket.emit("roomJoined", { roomId });
    console.log(`🚪 Player joined room ${roomId}`);

    // Notify host that a player has joined
    const hostSocket = room.players[0];
    if (hostSocket) {
      hostSocket.emit("playerJoined", { playerCount: 2 });
    }

    // Start countdown for all players
    startCountdown(roomId, 3);
  });

  socket.on("waitingStart", ({ countdown }) => {
    // should be handled automatically by server after both players join
  });

  socket.on("startGame", (initialState) => {
    const roomId = initialState.roomId;
    console.log("🟢 Game initialized by host. Broadcasting startGame to room:", roomId);
    io.to(roomId).emit("startGame", initialState);
  });

  socket.on("restartGame", (newGameState) => {
    const roomId = newGameState.roomId;
    console.log("🔁 Restarting game for room:", roomId);
    io.to(roomId).emit("restartGame", newGameState);
  });

  socket.on("sendMove", ({ card, roomId }) => {
    socket.to(roomId).emit("receiveMove", { card, actingPlayerId: getPlayerId(roomId, socket) });
  });

  socket.on("updateState", ({ gameState, roomId }) => {
    socket.to(roomId).emit("stateUpdate", gameState);
  });

  socket.on("newRound", ({ roundData, roomId }) => {
    io.to(roomId).emit("newRound", roundData);
  });

  socket.on("roundEnd", ({ roundResult, roomId }) => {
    io.to(roomId).emit("roundEnd", roundResult);
  });

  socket.on("gameEnd", ({ gameResult, roomId }) => {
    io.to(roomId).emit("gameEnd", gameResult);
  });

  socket.on("disconnecting", () => {
    const roomsJoined = Array.from(socket.rooms).filter(r => r !== socket.id);
    for (const roomId of roomsJoined) {
      const room = rooms[roomId];
      if (room) {
        io.to(roomId).emit("opponentDisconnected");
        delete rooms[roomId];
        console.log("⚠️ Opponent disconnected from room", roomId);
      }
    }
  });
});

// -------- Helpers --------

function generateRoomId() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function getPlayerId(roomId, socket) {
  const room = rooms[roomId];
  if (!room) return -1;
  return room.players.indexOf(socket);
}

function startCountdown(roomId, seconds) {
  let remaining = seconds;
  const interval = setInterval(() => {
    if (remaining <= 0) {
      clearInterval(interval);
      io.to(roomId).emit("waitingUpdate", { countdown: 0 });

      // Let the host emit startGame with initial state
      const hostSocket = rooms[roomId]?.players[0];
      if (hostSocket) {
        hostSocket.emit("waitingStart", { countdown: 0 });
        // NOTE: gameScene on host should send 'startGame' after countdown
      }

    } else {
      io.to(roomId).emit("waitingStart", { countdown: remaining });
      remaining--;
    }
  }, 1000);
}

// -------- Start Server --------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
