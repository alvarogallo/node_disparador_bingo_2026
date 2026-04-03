require('dotenv').config();

const fetch      = require('node-fetch');
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const { BingoGame } = require('./bingo');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
    cors: {
        origin:      '*',
        methods:     ['GET', 'POST'],
        credentials: false,
    },
    allowEIO3:  true,
    transports: ['websocket', 'polling'],
});

const PORT         = process.env.PORT || 3000;
const SERVER_START = new Date().toISOString();

const juegosActivos = new Map();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ── Health / info ────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Servidor de bingo activo (Socket.IO integrado)',
        servidor_iniciado: SERVER_START,
        juegos_activos: Array.from(juegosActivos.keys()),
    });
});

// ── Auth ─────────────────────────────────────────────────────────────────
function checkApiToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token || token !== `Bearer ${process.env.API_TOKEN}`) {
        return res.status(401).json({ status: 'error', message: 'Token inválido' });
    }
    next();
}

// ── POST /start_bingo ────────────────────────────────────────────────────
app.post('/start_bingo', checkApiToken, (req, res) => {
    try {
        const params = req.body;

        if (!params || Object.keys(params).length === 0) {
            return res.status(400).json({ status: 'error', message: 'Cuerpo JSON requerido' });
        }

        const codigo = params.codigo;

        if (codigo && juegosActivos.has(codigo)) {
            return res.status(409).json({
                status: 'error',
                message: `Ya hay un juego activo con código: ${codigo}`
            });
        }

        res.json({
            status: 'ok',
            message: 'Procesando solicitud',
            params: {
                codigo:    codigo || 'auto',
                start_in:  params.start_in  || 0,
                intervalo: params.intervalo || 10,
            }
        });

        const game = new BingoGame(params, io);
        juegosActivos.set(game.codigo, true);
        game.start()
            .catch(err => console.error('Error en juego:', err))
            .finally(() => juegosActivos.delete(game.codigo));

    } catch (error) {
        console.error('Error general:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// ── Socket.IO ────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
    console.log(`[socket] cliente conectado: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`[socket] cliente desconectado: ${socket.id}`);
    });
});

// ── Iniciar ──────────────────────────────────────────────────────────────
server.listen(PORT, () => {
    console.log(`Servidor bingo + Socket.IO en puerto ${PORT}`);
    console.log(`Iniciado: ${SERVER_START}`);
});
