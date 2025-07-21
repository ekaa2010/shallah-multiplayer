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

// 🧠 تخزين الغرف
let rooms = {};

function generateRoomCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

// 🎴 توليد الديك الكامل (Standard 52-card deck)
function generateDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

// 🔀 خلط الورق
function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

io.on("connection", (socket) => {
  console.log("✅ A user connected");

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

          const startingPlayerId = Math.floor(Math.random() * 2);

          // 🃏 توزيع الأوراق
          let fullDeck = shuffle(generateDeck());
          const playerHands = [[], []];
          const playerGroundPiles = [[], []];

          // 4 أوراق للأرض عند اللاعب 0
          playerGroundPiles[0] = fullDeck.splice(0, 4);

          // توزيع 6 أوراق على كل لاعب كبداية
          for (let i = 0; i < 6; i++) {
            playerHands[0].push(fullDeck.pop());
            playerHands[1].push(fullDeck.pop());
          }

          console.log(`🎮 Game starting in room ${roomId}`);
          io.to(roomId).emit("startGame", {
            playerCount: 2,
            targetScore: 101,
            startingPlayerId,
            deck: fullDeck,
            playerHands,
            playerGroundPiles,
          });
        }
      }, 1000);
    }
  });

  // 🎯 إرسال الحركة
  socket.on("send-move", (data) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit("receive-move", data);
    }
  });

  // 🧾 نهاية الجولة
  socket.on("roundEnd", (payload) => {
    console.log(`📦 Round ended in room ${socket.roomId}`);
    socket.to(socket.roomId).emit("roundEnd", payload);
  });

  // ♻️ بدء جولة جديدة
  socket.on("newRound", (payload) => {
    console.log(`🔄 New round in room ${socket.roomId}`);
    socket.to(socket.roomId).emit("newRound", payload);
  });

  // 🏁 نهاية اللعبة
  socket.on("gameEnd", (payload) => {
    console.log(`🏁 Game ended in room ${socket.roomId}`);
    io.to(socket.roomId).emit("gameEnd", payload);
  });

  // ❌ فصل اللاعب
  socket.on("disconnect", () => {
    console.log("❌ A user disconnected");

    const roomId = socket.roomId;
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
