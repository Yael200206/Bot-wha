const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

// --- CONFIGURACIÓN DE WHATSAPP ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        handleSIGINT: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', qr => {
    console.log('SCANEA EL QR:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => console.log('✅ WhatsApp Conectado!'));
client.initialize();

const delay = ms => new Promise(res => setTimeout(res, ms));

// Normalización robusta para México
function normalizarNumero(numeroSucio) {
    if (!numeroSucio) return null;
    let num = numeroSucio.toString().replace(/\D/g, ''); 
    if (num.length === 10) return "521" + num;
    if (num.startsWith("52") && num.length === 12) return "521" + num.substring(2);
    return num;
}

// Función para guardar el progreso en el Excel de reporte
function guardarReporte(datos) {
    const ws = xlsx.utils.json_to_sheet(datos);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Estado de Envío");
    xlsx.writeFile(wb, "reporte_envio.xlsx");
}

app.get('/', (req, res) => {
    res.send(`
        <body style="font-family: Arial; text-align: center; background: #e5ddd5; padding: 50px;">
            <div style="background: white; display: inline-block; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h1 style="color: #075e54;">WhatsApp Masivo Pro</h1>
                <p>Usa etiquetas como <b>{nombre}</b> o <b>{id}</b> según tus columnas.</p>
                <form action="/upload" method="post" enctype="multipart/form-data" style="text-align: left;">
                    <label>Archivo Excel:</label><br>
                    <input type="file" name="excelFile" accept=".xlsx, .xls, .csv" required><br><br>
                    <label>Mensaje Personalizado:</label><br>
                    <textarea name="message" rows="5" style="width: 100%;" placeholder="Hola {nombre}, tu código es {id}"></textarea><br><br>
                    <button type="submit" style="width: 100%; background: #25D366; color: white; border: none; padding: 15px; cursor: pointer; border-radius: 5px;">
                        INICIAR ENVÍO DINÁMICO
                    </button>
                </form>
            </div>
        </body>
    `);
});

app.post('/upload', upload.single('excelFile'), async (req, res) => {
    try {
        const workbook = xlsx.readFile(req.file.path);
        const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
        const baseMsg = req.body.message || "Hola {nombre}";

        let reporteFinal = [];
        res.send("<h3>🚀 Envío en curso. Revisa la consola y al finalizar busca 'reporte_envio.xlsx'.</h3>");

        for (let i = 0; i < rawData.length; i++) {
            let fila = rawData[i];
            
            // 1. Limpiar encabezados y normalizar a minúsculas para reemplazo fácil
            const rowClean = {};
            Object.keys(fila).forEach(key => {
                rowClean[key.toLowerCase().trim()] = fila[key];
            });

            // 2. Construir el mensaje dinámico
            let mensajePersonalizado = baseMsg;
            Object.keys(rowClean).forEach(key => {
                // Reemplaza todas las ocurrencias de {columna} con su valor
                const regex = new RegExp(`{${key}}`, 'gi');
                mensajePersonalizado = mensajePersonalizado.replace(regex, rowClean[key]);
            });

            const telOriginal = rowClean['telefono'] || rowClean['tel'] || rowClean['phone'];
            const nombreParaLog = rowClean['nombre'] || "Sin Nombre";
            let estadoEnvio = "";

            if (!telOriginal) {
                estadoEnvio = "❌ Error: Columna 'telefono' no encontrada";
            } else {
                const numLimpio = normalizarNumero(telOriginal);
                const chatId = `${numLimpio}@c.us`;

                try {
                    const isRegistered = await client.isRegisteredUser(chatId);
                    if (isRegistered) {
                        await client.sendMessage(chatId, mensajePersonalizado);
                        estadoEnvio = "✅ Enviado";
                        console.log(`[${i+1}/${rawData.length}] Enviado a: ${nombreParaLog}`);
                    } else {
                        estadoEnvio = "❌ No tiene WhatsApp";
                        console.log(`[${i+1}/${rawData.length}] ❌ ${numLimpio} no registrado`);
                    }
                } catch (e) {
                    estadoEnvio = "❌ Error técnico: " + e.message;
                }
            }

            // 3. Agregar al reporte
            reporteFinal.push({
                ...fila, // Mantiene todas tus columnas originales en el reporte
                resultado_envio: estadoEnvio,
                fecha_procesado: new Date().toLocaleString()
            });

            // Guardar reporte cada 5 mensajes para no saturar el disco pero mantener seguridad
            if (i % 5 === 0 || i === rawData.length - 1) {
                guardarReporte(reporteFinal);
            }

            // 4. Delay Ajustado: 3 a 5 segundos (3000ms a 5000ms)
            await delay(Math.floor(Math.random() * 2000) + 3000);
        }

        console.log("--- ✨ Proceso terminado ---");
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    } catch (err) {
        console.error("🔴 Error Crítico:", err);
    }
});

app.listen(3000, () => console.log('🚀 Sistema listo en http://localhost:3000'));