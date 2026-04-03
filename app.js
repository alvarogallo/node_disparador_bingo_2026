// app.js - Servidor de bingo con dotenv usando POST
// Cargar variables de entorno lo antes posible
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const { BingoGame } = require('./bingo');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para analizar cuerpos JSON y formularios
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ruta principal - solo devuelve JSON
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Servidor de bingo activo',
    usage: 'Enviar petición POST a /start_bingo con un objeto JSON que contenga: codigo, start_in, intervalo y opcionalmente numeracion',
    socket: {
      url: process.env.SOCKET_URL || 'No configurado',
      canal: process.env.SOCKET_CANAL || 'No configurado'
    }
  });
});

// Ruta para iniciar bingo (ahora con método POST)
app.post('/start_bingo', (req, res) => {
  try {
    console.log('Recibiendo solicitud POST con parámetros:', JSON.stringify(req.body));
    
    // Los parámetros vienen directamente en el cuerpo de la petición
    const params = req.body;
    
    // Validar que haya un cuerpo en la petición
    if (!params || Object.keys(params).length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere un cuerpo JSON con los parámetros'
      });
    }
    
    // Verificar si se incluye numeración personalizada
    const hasCustomNumbers = params.numeracion && typeof params.numeracion === 'string';
    
    // Enviar respuesta inmediata
    res.json({ 
      status: 'ok', 
      message: 'Procesando solicitud',
      params: {
        codigo: params.codigo || 'Se generará automáticamente',
        start_in: params.start_in || 0,
        intervalo: params.intervalo || 10,
        numeracion: hasCustomNumbers ? 'Personalizada proporcionada' : 'Generada automáticamente'
      }
    });
    
    // Iniciar juego en segundo plano
    const game = new BingoGame(params);
    game.start().catch(err => console.error('Error en juego:', err));
    
  } catch (error) {
    console.error('Error general:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Mantener la ruta GET anterior para compatibilidad con clientes existentes
app.get('/start_bingo/:params', (req, res) => {
  try {
    console.log('Recibiendo solicitud GET con parámetros:', req.params.params);
    
    // Decodificar parámetros
    let params = {};
    try {
      params = JSON.parse(decodeURIComponent(req.params.params));
      console.log('Parámetros decodificados:', params);
    } catch (error) {
      console.log('Error al parsear parámetros:', error.message);
      return res.status(400).json({
        status: 'error',
        message: 'Formato de parámetros inválido. Se esperaba un objeto JSON válido.'
      });
    }
    
    // Verificar si se incluye numeración personalizada
    const hasCustomNumbers = params.numeracion && typeof params.numeracion === 'string';
    
    // Enviar respuesta inmediata
    res.json({ 
      status: 'ok', 
      message: 'Procesando solicitud. Nota: Esta ruta está obsoleta, use POST /start_bingo en su lugar.',
      params: {
        codigo: params.codigo || 'Se generará automáticamente',
        start_in: params.start_in || 0,
        intervalo: params.intervalo || 10,
        numeracion: hasCustomNumbers ? 'Personalizada proporcionada' : 'Generada automáticamente'
      }
    });
    
    // Iniciar juego en segundo plano
    const game = new BingoGame(params);
    game.start().catch(err => console.error('Error en juego:', err));
    
  } catch (error) {
    console.error('Error general:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`Socket configurado en: ${process.env.SOCKET_URL || 'No configurado'}`);
  console.log(`Canal configurado: ${process.env.SOCKET_CANAL || 'No configurado'}`);
  console.log(`Token configurado: ${process.env.SOCKET_TOKEN ? 'Sí' : 'No'}`);
  console.log('Para usar vía POST: curl -X POST -H "Content-Type: application/json" -d \'{"codigo":"juego_123","start_in":2,"intervalo":10,"numeracion":"1,2,3,4,5,..."}\' http://localhost:3000/start_bingo');
});