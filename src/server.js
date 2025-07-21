const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// 🎴 أدوات الكوتشينة
function generateDeck() {
  const suits = ["♠", "♥", "♦", "♣"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const deck = [];

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }

  return deck;
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// 🧠 الغرف
let rooms = {};

io.on("connection", (socket) => {
  console.log("✅ User connected");

  socket.on("joinRoom", ({ roomId }) => {
    socket.join(roomId);
    socket.roomId = roomId;

    if (!rooms[roomId]) {
      rooms[roomId] = [];
      console.log(`🆕 Room ${roomId} created`);
    }

    const playerId = rooms[roomId].length;
    rooms[roomId].push({ id: socket.id, playerId });

    console.log(`👤 Player ${playerId} joined room ${roomId}`);
    io.to(socket.id).emit("playerIdAssigned", { playerId });

    if (rooms[roomId].length === 2) {
      console.log(`⌛ Room ${roomId} full. Starting countdown...`);

      io.to(roomId).emit("waitingStart", { countdown: 5 });

      let countdown = 5;
      const interval = setInterval(() => {
        countdown--;
        io.to(roomId).emit("waitingUpdate", { countdown });

        if (countdown <= 0) {
          clearInterval(interval);
          console.log(`🎮 Starting game in room ${roomId}`);

          const startingPlayerId = Math.floor(Math.random() * 2);
          const fullDeck = shuffle(generateDeck());
          const playerHands = [[], []];
          const playerGroundPiles = [[], []];

          // 4 أوراق أرضية عند اللاعب 0
          playerGroundPiles[0] = fullDeck.splice(0, 4);

          // توزيع 6 أوراق على كل لاعب
          for (let i = 0; i < 6; i++) {
            playerHands[0].push(fullDeck.shift());
            playerHands[1].push(fullDeck.shift());
          }

          io.to(roomId).emit("startGame", {
            playerCount: 2,
            targetScore: 101,
            startingPlayerId,
            playerHands,
            playerGroundPiles,
            deck: fullDeck,
          });
        }
      }, 1000);
    }
  });

  socket.on("send-move", (data) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit("receive-move", data);
    }
  });

  socket.on("roundEnd", (payload) => {
    socket.to(socket.roomId).emit("roundEnd", payload);
  });

  socket.on("newRound", (payload) => {
    socket.to(socket.roomId).emit("newRound", payload);
  });

  socket.on("gameEnd", (payload) => {
    io.to(socket.roomId).emit("gameEnd", payload);
  });

  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    console.log("❌ User disconnected");

    if (roomId && rooms[roomId]) {
      rooms[roomId] = rooms[roomId].filter(p => p.id !== socket.id);
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
      } else {
        socket.to(roomId).emit("opponent-disconnected");
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
