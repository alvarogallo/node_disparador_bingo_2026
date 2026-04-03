class BingoGame {
    constructor(params, io) {
        this.io = io;

        this.codigo = params?.codigo
            ? String(params.codigo)
            : `bg_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

        const minutes = parseInt(params?.start_in);
        this.startIn = (!isNaN(minutes) && minutes >= 0) ? minutes : 0;

        const segundos = parseInt(params?.intervalo);
        this.intervalo = (!isNaN(segundos) && segundos > 0) ? segundos : 10;

        this.bingoNumbers = [];
        if (params?.numeracion) {
            this.procesarNumeracionPersonalizada(params.numeracion);
        } else {
            this.generarSecuenciaEstandar();
            this.shuffleBingoNumbers();
        }

        console.log(`[BingoGame] codigo=${this.codigo} start_in=${this.startIn}min intervalo=${this.intervalo}s`);
    }

    procesarNumeracionPersonalizada(numeracion) {
        const numeros = numeracion.split(',')
            .map(n => parseInt(n.trim()))
            .filter(n => !isNaN(n) && n >= 1 && n <= 75);

        if (numeros.length !== 75 || new Set(numeros).size !== 75) {
            console.error('[BingoGame] Numeración inválida, usando secuencia estándar');
            this.generarSecuenciaEstandar();
            this.shuffleBingoNumbers();
            return;
        }

        this.bingoNumbers = numeros.map(numero => ({
            numero,
            letra:      this.letraDe(numero),
            combinacion: `${this.letraDe(numero)}${numero}`,
        }));
    }

    generarSecuenciaEstandar() {
        for (let i = 1; i <= 75; i++) {
            const letra = this.letraDe(i);
            this.bingoNumbers.push({ numero: i, letra, combinacion: `${letra}${i}` });
        }
    }

    shuffleBingoNumbers() {
        for (let i = this.bingoNumbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.bingoNumbers[i], this.bingoNumbers[j]] = [this.bingoNumbers[j], this.bingoNumbers[i]];
        }
    }

    letraDe(n) {
        if (n <= 15) return 'B';
        if (n <= 30) return 'I';
        if (n <= 45) return 'N';
        if (n <= 60) return 'G';
        return 'O';
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    emit(evento, data) {
        this.io.emit(evento, data);
        console.log(`[socket] emit → evento:${evento}`, JSON.stringify(data));
    }

    async start() {
        console.log(`[BingoGame] iniciando juego: ${this.codigo}`);

        // Cuenta regresiva por minutos
        let minutesLeft = this.startIn;
        if (minutesLeft > 0) {
            this.emit(this.codigo, { faltan: minutesLeft, time_utc: Math.floor(Date.now() / 1000) });
            while (minutesLeft > 0) {
                await this.delay(60_000);
                minutesLeft--;
                if (minutesLeft > 0) {
                    this.emit(this.codigo, { faltan: minutesLeft, time_utc: Math.floor(Date.now() / 1000) });
                }
            }
        }

        // Señal de arranque
        this.emit(this.codigo, { faltan: 0, time_utc: Math.floor(Date.now() / 1000) });

        console.log(`[BingoGame] esperando ${this.intervalo}s antes del primer número…`);
        await this.delay(this.intervalo * 1000);

        // Números
        for (let i = 0; i < this.bingoNumbers.length; i++) {
            const item  = this.bingoNumbers[i];
            const orden = i + 1;

            console.log(`[BingoGame] bingo:${item.combinacion} (${orden}/75)`);

            this.emit(this.codigo, {
                numero:   item.combinacion,
                num:      orden,
                time_utc: Math.floor(Date.now() / 1000),
            });

            if (i < this.bingoNumbers.length - 1) {
                await this.delay(this.intervalo * 1000);
            }
        }

        console.log(`[BingoGame] juego ${this.codigo} completado.`);
        this.emit(this.codigo, { fin: true, time_utc: Math.floor(Date.now() / 1000) });
    }
}

module.exports = { BingoGame };
