// bingo.js - Versión con letras de bingo e integración con servidor de sockets usando dotenv
const fetch = require('node-fetch');

class BingoGame {
  constructor(params) {
    // Guardamos los parámetros
    this.params = params;
    
    // Extraemos el código o generamos uno único si no se proporciona
    if (params?.codigo) {
      this.codigo = params.codigo;
    } else {
      // Generar un código único con timestamp + random
      const timestamp = new Date().getTime();
      const random = Math.floor(Math.random() * 10000);
      this.codigo = `bg_${timestamp}_${random}`;
      console.log(`Código generado automáticamente: ${this.codigo}`);
    }
    
    // Extraemos el parámetro start_in (minutos para iniciar)
    this.startIn = 0;
    if (params && params.start_in !== undefined) {
      const minutes = parseInt(params.start_in);
      // Validamos que sea un número no negativo (permitimos cualquier valor positivo)
      if (!isNaN(minutes) && minutes >= 0) {
        this.startIn = minutes;
        console.log(`Tiempo de inicio configurado: ${minutes} minutos`);
      } else {
        console.log('Valor de start_in inválido, debe ser un número no negativo. Usando 0.');
      }
    }
        
    // Extraemos el parámetro intervalo (segundos entre números de bingo)
    this.intervalo = 10; // Valor por defecto: 10 segundos
    if (params && params.intervalo !== undefined) {
      const segundos = parseInt(params.intervalo);
      // Validamos que sea un número positivo
      if (!isNaN(segundos) && segundos > 0) {
        this.intervalo = segundos;
      } else {
        console.log('Valor de intervalo inválido, debe ser un número positivo. Usando 10 segundos por defecto.');
      }
    }
    
    // Configuración del servidor de sockets desde variables de entorno
    this.socketConfig = {
      url: process.env.SOCKET_URL || 'https://socket2026.unatecla.us/api/send-message',
      token: process.env.SOCKET_TOKEN || '',
      canal: process.env.SOCKET_CANAL || 'bingo_revendedor_jugador'
    };
    
    // Inicializamos el array de números de bingo
    this.bingoNumbers = [];
    
    // Verificamos si se proporcionó una numeración personalizada
    if (params && params.numeracion) {
      this.procesarNumeracionPersonalizada(params.numeracion);
    } else {
      // Si no hay numeración personalizada, generamos la secuencia estándar (1-75)
      this.generarSecuenciaEstandar();
      // Mezclamos los números
      this.shuffleBingoNumbers();
    }
  }

  /**
   * Procesa una cadena de numeración personalizada para el bingo
   * @param {string} numeracion - Cadena con 75 números separados por coma
   */
  procesarNumeracionPersonalizada(numeracion) {
    try {
      // Convertir la cadena a array de números
      const numeros = numeracion
        .split(',')
        .map(num => num.trim())
        .map(num => parseInt(num))
        .filter(num => !isNaN(num));
      
      // Verificar que tengamos exactamente 75 números válidos
      if (numeros.length !== 75) {
        console.error(`Error: La numeración proporcionada debe contener exactamente 75 números (se encontraron ${numeros.length})`);
        console.log('Usando secuencia estándar mezclada en su lugar.');
        this.generarSecuenciaEstandar();
        this.shuffleBingoNumbers();
        return;
      }
      
      // Verificar que los números estén en el rango 1-75
      const numerosInvalidos = numeros.filter(num => num < 1 || num > 75);
      if (numerosInvalidos.length > 0) {
        console.error(`Error: Todos los números deben estar en el rango 1-75. Números inválidos: ${numerosInvalidos.join(', ')}`);
        console.log('Usando secuencia estándar mezclada en su lugar.');
        this.generarSecuenciaEstandar();
        this.shuffleBingoNumbers();
        return;
      }
      
      // Verificar que no haya números duplicados
      const numerosUnicos = new Set(numeros);
      if (numerosUnicos.size !== 75) {
        console.error('Error: La numeración contiene números duplicados');
        console.log('Usando secuencia estándar mezclada en su lugar.');
        this.generarSecuenciaEstandar();
        this.shuffleBingoNumbers();
        return;
      }
      
      // Si todo está correcto, creamos los objetos con letra y número
      console.log('Usando numeración personalizada proporcionada por el usuario');
      this.bingoNumbers = numeros.map(numero => {
        let letra = '';
        if (numero <= 15) letra = 'B';
        else if (numero <= 30) letra = 'I';
        else if (numero <= 45) letra = 'N';
        else if (numero <= 60) letra = 'G';
        else letra = 'O';
        
        return {
          numero: numero,
          letra: letra,
          combinacion: `${letra}${numero}`
        };
      });
    } catch (error) {
      console.error('Error al procesar la numeración personalizada:', error);
      console.log('Usando secuencia estándar mezclada en su lugar.');
      this.generarSecuenciaEstandar();
      this.shuffleBingoNumbers();
    }
  }

  /**
   * Genera la secuencia estándar de números de bingo (1-75)
   */
  generarSecuenciaEstandar() {
    this.bingoNumbers = [];
    // En el bingo, los números se asocian con letras:
    // B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
    for (let i = 1; i <= 75; i++) {
      let letra = '';
      if (i <= 15) letra = 'B';
      else if (i <= 30) letra = 'I';
      else if (i <= 45) letra = 'N';
      else if (i <= 60) letra = 'G';
      else letra = 'O';
      
      this.bingoNumbers.push({
        numero: i,
        letra: letra,
        combinacion: `${letra}${i}`
      });
    }
  }

  /**
   * Mezcla el array de números de bingo (algoritmo Fisher-Yates)
   */
  shuffleBingoNumbers() {
    for (let i = this.bingoNumbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.bingoNumbers[i], this.bingoNumbers[j]] = [this.bingoNumbers[j], this.bingoNumbers[i]];
    }
  }

  /**
   * Función de utilidad para crear retrasos
   * @param {number} ms - Milisegundos a esperar
   * @returns {Promise} Promesa que se resuelve después del retraso
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Envía un mensaje al servidor de sockets
   * @param {Object} mensaje - Mensaje a enviar
   * @param {number} numeroDeLaSerie - Número de orden (1-75)
   * @returns {Promise} Promesa que se resuelve con la respuesta
   */
  async enviarASocket(mensaje, numeroDeLaSerie) {
    const data = {
      canal: this.socketConfig.canal,
      token_write: this.socketConfig.token,
      evento: this.codigo,
      mensaje: JSON.stringify({
        numero: mensaje.combinacion,
        num: numeroDeLaSerie,
        time_utc: Math.floor(Date.now() / 1000)
      })
    };

    try {
      const response = await fetch(this.socketConfig.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      console.log(`Socket enviado: ${mensaje.combinacion} (${numeroDeLaSerie}/75)`, result);
    } catch (error) {
      console.error('Error al enviar al socket:', error);
    }
  }

  /**
   * Envía mensaje de "faltan" al servidor de sockets
   * @param {number} minutos - Minutos restantes
   */
  async enviarFaltan(minutos) {
    const data = {
      canal: this.socketConfig.canal,
      token_write: this.socketConfig.token,
      evento: this.codigo,
      mensaje: JSON.stringify({
        faltan: minutos,
        time_utc: Math.floor(Date.now() / 1000)
      })
    };

    try {
      const response = await fetch(this.socketConfig.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      console.log(`Socket faltan enviado: ${minutos} al evento: ${this.codigo}`, result);
    } catch (error) {
      console.error('Error al enviar faltan al socket:', error);
    }
  }

  /**
   * Iniciar el juego de bingo (con contador regresivo e intervalo)
   * @returns {Promise} Resultado del juego
   */
  async start() {
    console.log(`Iniciando juego con código: ${this.codigo}`);
    console.log(`Usando servidor de sockets: ${this.socketConfig.url}`);
    
    // Si start_in es mayor que 0, hacemos la cuenta regresiva
    let minutesLeft = this.startIn;
    
    if (minutesLeft > 0) {
      // Mostrar el tiempo inicial restante
      console.log(`faltan:${minutesLeft}`);
      await this.enviarFaltan(minutesLeft);
      
      // Bucle para la cuenta regresiva (cada minuto)
      while (minutesLeft > 0) {
        // Para pruebas, cambiar a un valor menor (ej. 5000 ms = 5 segundos)
        // En producción, usar 60000 ms = 1 minuto
        await this.delay(60000);
        
        // Decrementar y mostrar el tiempo restante
        minutesLeft--;
        
        // Mostrar los minutos restantes (incluso cuando sea 0)
        if (minutesLeft > 0) {
          console.log(`faltan:${minutesLeft}`);
          await this.enviarFaltan(minutesLeft);
        }
      }
    }
    
    // Cuando el contador llega a cero, mostramos 'starting'
    console.log('starting');
    
    // Enviamos mensaje de inicio (faltan:0)
    await this.enviarFaltan(0);
    
    // Esperamos el intervalo especificado antes del primer número
    console.log(`Esperando ${this.intervalo} segundos antes del primer número...`);
    await this.delay(this.intervalo * 1000);
    
    // Mostramos todos los números de bingo con el intervalo especificado
    const numerosMostrados = [];
    
    // Recorremos todos los números mezclados
    for (let i = 0; i < this.bingoNumbers.length; i++) {
      const bingoItem = this.bingoNumbers[i];
      const numeroDeLaSerie = i + 1; // El contador empieza en 1 y termina en 75
      
      console.log(`bingo:${bingoItem.combinacion} (${numeroDeLaSerie}/75)`);
      
      // Enviamos el número al servidor de sockets con su posición en la serie
      try {
        await this.enviarASocket(bingoItem, numeroDeLaSerie);
      } catch (error) {
        console.error('Error al enviar número al socket:', error);
      }
      
      numerosMostrados.push({
        ...bingoItem,
        posicion: numeroDeLaSerie
      });
      
      // No esperar después del último número
      if (i < this.bingoNumbers.length - 1) {
        // Esperar el intervalo especificado antes de mostrar el siguiente número
        await this.delay(this.intervalo * 1000);
      }
    }
    
    console.log('Juego de bingo completado. Se han mostrado todos los números.');
    
    // Devolvemos un resultado completo
    return {
      status: 'success',
      message: 'Juego de bingo completado',
      codigo: this.codigo,
      startIn: this.startIn,
      intervalo: this.intervalo,
      socket: this.socketConfig.url,
      total_numeros: numerosMostrados.length,
      numerosMostrados: numerosMostrados.map(item => `${item.combinacion} (${item.posicion}/75)`)
    };
  }
}

module.exports = { BingoGame };