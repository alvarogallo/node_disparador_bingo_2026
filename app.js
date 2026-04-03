// app.js - Servidor de bingo con dotenv usando POST
// Cargar variables de entorno lo antes posible
require('dotenv').config();

const fetch = require('node-fetch');
const express = require('express');
const bodyParser = require('body-parser');
const { BingoGame } = require('./bingo');

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_START = new Date().toISOString();

// Registro de juegos activos
const juegosActivos = new Map();

// Middleware para analizar cuerpos JSON y formularios
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ruta principal
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Servidor de bingo activo',
    servidor_iniciado: SERVER_START,
    juegos_activos: Array.from(juegosActivos.keys()),
    socket: {
      url: process.env.SOCKET_URL || 'No configurado',
      canal: process.env.SOCKET_CANAL || 'No configurado'
    }
  });
});

// Test de conexión al socket
app.get('/test-socket', async (req, res) => {
  const url = process.env.SOCKET_URL;
  const token = process.env.SOCKET_TOKEN;
  const canal = process.env.SOCKET_CANAL;

  if (!url || !token || !canal) {
    return res.status(500).json({ status: 'error', message: 'Variables de entorno del socket no configuradas' });
  }

  const data = {
    canal: canal,
    token_write: token,
    evento: 'test_disparador',
    mensaje: JSON.stringify({ test: true, time_utc: Math.floor(Date.now() / 1000) })
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    res.json({
      status: response.ok ? 'ok' : 'error',
      http_status: response.status,
      socket_url: url,
      canal: canal,
      respuesta_socket: result
    });
  } catch (error) {
    res.status(502).json({ status: 'error', message: error.message });
  }
});

// Middleware de autenticación
function checkApiToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token || token !== `Bearer ${process.env.API_TOKEN}`) {
    return res.status(401).json({ status: 'error', message: 'Token inválido o no proporcionado' });
  }
  next();
}

// Ruta para iniciar bingo
app.post('/start_bingo', checkApiToken, (req, res) => {
  try {
    console.log('Recibiendo solicitud POST con parámetros:', JSON.stringify(req.body));

    const params = req.body;

    if (!params || Object.keys(params).length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere un cuerpo JSON con los parámetros'
      });
    }

    const codigo = params.codigo;

    if (codigo && juegosActivos.has(codigo)) {
      return res.status(409).json({
        status: 'error',
        message: `Ya hay un juego activo con código: ${codigo}`
      });
    }

    const hasCustomNumbers = params.numeracion && typeof params.numeracion === 'string';

    res.json({
      status: 'ok',
      message: 'Procesando solicitud',
      params: {
        codigo: codigo || 'Se generará automáticamente',
        start_in: params.start_in || 0,
        intervalo: params.intervalo || 10,
        numeracion: hasCustomNumbers ? 'Personalizada proporcionada' : 'Generada automáticamente'
      }
    });

    const game = new BingoGame(params);
    juegosActivos.set(game.codigo, true);
    game.start()
      .catch(err => console.error('Error en juego:', err))
      .finally(() => juegosActivos.delete(game.codigo));

  } catch (error) {
    console.error('Error general:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`Iniciado: ${SERVER_START}`);
  console.log(`Socket configurado en: ${process.env.SOCKET_URL || 'No configurado'}`);
  console.log(`Canal configurado: ${process.env.SOCKET_CANAL || 'No configurado'}`);
  console.log(`Token configurado: ${process.env.SOCKET_TOKEN ? 'Sí' : 'No'}`);
});
