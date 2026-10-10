import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { Server } from 'socket.io';

const PORT = Number(process.env.PORT || 3001);
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean);
const app = express();
app.use(cors({ origin: allowedOrigins, credentials: false }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'data-quiz-arena', rooms: rooms.size }));
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  pingInterval: 25000,
  pingTimeout: 20000
});

const QUESTION_MS = 20_000;
const BETWEEN_MS = 3_500;
const rooms = new Map();
const questions = [
  { category: 'Data Analysis', text: 'A dataset contains values 4, 6, 6, 8, and 11. What is the median?', options: ['4', '6', '6.5', '8'], answer: 1, explanation: 'The sorted middle value is 6.' },
  { category: 'Data Analysis', text: 'Which chart is generally best for showing a trend over monthly time periods?', options: ['Pie chart', 'Line chart', 'Treemap', 'Radar chart'], answer: 1, explanation: 'A line chart makes changes over time easy to see.' },
  { category: 'Excel', text: 'Which Excel function counts cells that meet one condition?', options: ['COUNTIF', 'SUM', 'LEFT', 'CONCAT'], answer: 0, explanation: 'COUNTIF counts cells in a range that satisfy one criterion.' },
  { category: 'Excel', text: 'In Excel, what does an absolute reference such as $A$1 do when copied?', options: ['Changes both row and column', 'Locks the row only', 'Locks the column only', 'Keeps the row and column fixed'], answer: 3, explanation: 'The dollar signs lock both the column and row.' },
  { category: 'SQL', text: 'Which SQL clause filters individual rows before grouping?', options: ['ORDER BY', 'WHERE', 'HAVING', 'AS'], answer: 1, explanation: 'WHERE filters rows before grouping and aggregation.' },
  { category: 'SQL', text: 'Which JOIN returns only rows with matching keys in both tables?', options: ['LEFT JOIN', 'FULL OUTER JOIN', 'INNER JOIN', 'CROSS JOIN'], answer: 2, explanation: 'INNER JOIN returns rows that match the join condition in both tables.' },
  { category: 'SQL', text: 'You want one row per department and the number of employees in each. Which combination fits?', options: ['GROUP BY department with COUNT(*)', 'ORDER BY department with SUM(*)', 'WHERE department with DISTINCT(*)', 'JOIN department with AVG(*)'], answer: 0, explanation: 'GROUP BY creates department groups and COUNT(*) counts rows in each group.' },
  { category: 'Power BI', text: 'In Power BI, what is the primary purpose of a relationship between tables in a model?', options: ['Set the report theme', 'Connect tables so filters can propagate', 'Export a PDF', 'Change the refresh schedule'], answer: 1, explanation: 'Relationships connect tables and enable filtering across the data model.' },
  { category: 'Power BI', text: 'Which DAX function evaluates an expression in a modified filter context?', options: ['FORMAT', 'CONCATENATE', 'CALCULATE', 'COUNTROWS'], answer: 2, explanation: 'CALCULATE evaluates an expression after applying or modifying filter context.' },
  { category: 'Mixed Challenge', text: 'A report shows sales by region. You need only regions with total sales above 100,000. In SQL, which clause filters the grouped totals?', options: ['WHERE', 'HAVING', 'LIMIT', 'ON'], answer: 1, explanation: 'HAVING filters groups after aggregation, such as SUM(sales) > 100000.' }
];

const makeCode = () => {
  let code;
  do { code = randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
  return code;
};
const publicQuestion = q => ({ category: q.category, text: q.text, options: q.options });
const safePlayers = room => [...room.players.values()].map(p => ({ id: p.id, name: p.name, score: p.score, correct: p.correct, answered: p.answered, connected: p.connected })).sort((a,b) => b.score - a.score || b.correct - a.correct || a.name.localeCompare(b.name));
function snapshot(room) {
  return { code: room.code, hostId: room.hostId, status: room.status, players: safePlayers(room), questionIndex: room.questionIndex,
    totalQuestions: questions.length, question: room.status === 'question' ? publicQuestion(questions[room.questionIndex]) : null,
    deadline: room.deadline, results: room.status === 'results' ? room.lastResult : null };
}
function broadcast(room) { io.to(room.code).emit('room:update', snapshot(room)); }
function errorTo(socket, message) { socket.emit('game:error', { message }); }
function cancelTimer(room) { if (room.timer) clearTimeout(room.timer); room.timer = null; }
function beginQuestion(room) {
  cancelTimer(room);
  if (room.questionIndex >= questions.length) { finishGame(room); return; }
  room.status = 'question'; room.deadline = Date.now() + QUESTION_MS; room.lastResult = null;
  for (const p of room.players.values()) { p.answered = false; p.lastAnswerCorrect = null; }
  broadcast(room);
  room.timer = setTimeout(() => closeQuestion(room), QUESTION_MS);
}
function closeQuestion(room) {
  if (room.status !== 'question') return;
  cancelTimer(room);
  const q = questions[room.questionIndex];
  room.status = 'reveal'; room.deadline = null;
  room.lastResult = { correctIndex: q.answer, explanation: q.explanation, correctCount: [...room.players.values()].filter(p => p.lastAnswerCorrect).length };
  broadcast(room);
  room.timer = setTimeout(() => { room.questionIndex += 1; beginQuestion(room); }, BETWEEN_MS);
}
function finishGame(room) {
  cancelTimer(room); room.status = 'finished'; room.deadline = null; room.lastResult = null; broadcast(room);
}
function removeRoomIfEmpty(room) {
  if (room.players.size === 0) { cancelTimer(room); rooms.delete(room.code); }
}

io.on('connection', socket => {
  socket.emit('server:ready', { ok: true });
  socket.on('room:create', ({ name } = {}) => {
    const playerName = String(name || '').trim().slice(0, 20);
    if (!playerName) return errorTo(socket, 'Enter a nickname first.');
    if ([...rooms.values()].some(r => [...r.players.values()].some(p => p.name.toLowerCase() === playerName.toLowerCase() && p.connected))) return errorTo(socket, 'That nickname is already in use. Try another.');
    const code = makeCode();
    const player = { id: socket.id, name: playerName, score: 0, correct: 0, answered: false, connected: true, lastAnswerCorrect: null };
    const room = { code, hostId: socket.id, players: new Map([[socket.id, player]]), status: 'lobby', questionIndex: 0, deadline: null, timer: null, lastResult: null };
    rooms.set(code, room); socket.join(code); socket.data.roomCode = code; socket.data.playerId = socket.id;
    socket.emit('room:joined', { code, playerId: socket.id }); broadcast(room);
  });
  socket.on('room:join', ({ code: rawCode, name } = {}) => {
    const code = String(rawCode || '').trim().toUpperCase();
    const playerName = String(name || '').trim().slice(0, 20);
    const room = rooms.get(code);
    if (!playerName) return errorTo(socket, 'Enter a nickname first.');
    if (!room) return errorTo(socket, 'Room not found. Check the code and try again.');
    if (room.status !== 'lobby') return errorTo(socket, 'This game has already started.');
    if (room.players.size >= 30) return errorTo(socket, 'This room is full (30 players max).');
    if ([...room.players.values()].some(p => p.name.toLowerCase() === playerName.toLowerCase())) return errorTo(socket, 'That nickname is already taken in this room.');
    const player = { id: socket.id, name: playerName, score: 0, correct: 0, answered: false, connected: true, lastAnswerCorrect: null };
    room.players.set(socket.id, player); socket.join(code); socket.data.roomCode = code; socket.data.playerId = socket.id;
    socket.emit('room:joined', { code, playerId: socket.id }); broadcast(room);
  });
  socket.on('game:start', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return errorTo(socket, 'Join a room first.');
    if (room.hostId !== socket.id) return errorTo(socket, 'Only the host can start the game.');
    if (room.status !== 'lobby') return errorTo(socket, 'The game has already started.');
    if (room.players.size < 2) return errorTo(socket, 'At least two players must join before starting.');
    room.questionIndex = 0; for (const p of room.players.values()) { p.score = 0; p.correct = 0; }
    beginQuestion(room);
  });
  socket.on('answer:submit', ({ optionIndex } = {}) => {
    const room = rooms.get(socket.data.roomCode); const player = room?.players.get(socket.id);
    if (!room || !player || room.status !== 'question') return errorTo(socket, 'There is no open question right now.');
    if (player.answered) return errorTo(socket, 'Your answer has already been submitted.');
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) return errorTo(socket, 'Invalid answer.');
    if (Date.now() > room.deadline) return errorTo(socket, 'Time is up.');
    player.answered = true;
    const correct = optionIndex === questions[room.questionIndex].answer;
    player.lastAnswerCorrect = correct;
    let earned = 0;
    if (correct) {
      const remaining = Math.max(0, room.deadline - Date.now());
      earned = Math.round(50 + 50 * (remaining / QUESTION_MS));
      player.score += earned; player.correct += 1;
    }
    socket.emit('answer:receipt', { correct, earned, totalScore: player.score });
    broadcast(room);
    if ([...room.players.values()].every(p => p.answered || !p.connected)) closeQuestion(room);
  });
  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.roomCode); if (!room) return;
    const player = room.players.get(socket.id); if (player) { player.connected = false; }
    if (room.status === 'lobby' && room.hostId === socket.id) {
      const next = [...room.players.values()].find(p => p.connected);
      if (next) room.hostId = next.id;
    }
    if (room.status === 'question' && [...room.players.values()].every(p => p.answered || !p.connected)) closeQuestion(room);
    if (room.status === 'lobby') {
      if (player) room.players.delete(socket.id);
      if (room.hostId === socket.id) room.hostId = room.players.keys().next().value || null;
      removeRoomIfEmpty(room);
    } else {
      broadcast(room);
      // Retain disconnected players in an active match for their score/history; remove after the match.
      if (room.status === 'finished') { room.players.delete(socket.id); broadcast(room); removeRoomIfEmpty(room); }
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => console.log(`Data Quiz Arena server listening on ${PORT}`));
