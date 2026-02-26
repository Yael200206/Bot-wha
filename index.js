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
                <h1 style="color: #075e54;">WhatsApp Masivo - Modo Reporte</h1>
                <p>Al terminar, revisa el archivo <b>reporte_envio.xlsx</b></p>
                <form action="/upload" method="post" enctype="multipart/form-data" style="text-align: left;">
                    <input type="file" name="excelFile" accept=".xlsx, .xls, .csv" required><br><br>
                    <textarea name="message" rows="5" style="width: 100%;" placeholder="Hola {nombre}..."></textarea><br><br>
                    <button type="submit" style="width: 100%; background: #25D366; color: white; border: none; padding: 15px; cursor: pointer; border-radius: 5px;">
                        INICIAR Y GENERAR REPORTE
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

        // Lista que se irá actualizando con el estado de cada mensaje
        let reporteFinal = [];

        res.send("<h3>🚀 Envío en curso. Al finalizar, busca 'reporte_envio.xlsx' en la carpeta.</h3>");
        console.log(`--- Procesando ${rawData.length} contactos ---`);

        for (let i = 0; i < rawData.length; i++) {
            let fila = rawData[i];
            
            // Limpiar encabezados
            const rowClean = {};
            Object.keys(fila).forEach(key => rowClean[key.toLowerCase().trim()] = fila[key]);

            const nombre = (rowClean['nombre'] || "Sin Nombre").toString().trim();
            const telOriginal = rowClean['telefono'];
            let estadoEnvio = "";

            if (!telOriginal || telOriginal == "") {
                estadoEnvio = "❌ Error: Teléfono vacío";
            } else {
                const numLimpio = normalizarNumero(telOriginal);
                const chatId = `${numLimpio}@c.us`;

                try {
                    const isRegistered = await client.isRegisteredUser(chatId);
                    if (isRegistered) {
                        await client.sendMessage(chatId, baseMsg.replace('{nombre}', nombre));
                        estadoEnvio = "✅ Enviado";
                        console.log(`✅ ${nombre} (${numLimpio})`);
                    } else {
                        estadoEnvio = "❌ No tiene WhatsApp";
                        console.log(`❌ ${numLimpio} no está registrado`);
                    }
                } catch (e) {
                    estadoEnvio = "❌ Error técnico: " + e.message;
                    console.log(`🔴 Error en ${nombre}:`, e.message);
                }
            }

            // Añadimos el resultado a nuestro reporte
            reporteFinal.push({
                nombre: nombre,
                telefono: telOriginal,
                resultado: estadoEnvio,
                fecha_hora: new Date().toLocaleString()
            });

            // Guardamos el Excel cada vez que procesamos una fila (por si se corta la luz)
            guardarReporte(reporteFinal);

            // Delay aleatorio
            await delay(Math.floor(Math.random() * 3000) + 4000);
        }

        console.log("--- ✨ Proceso terminado. Reporte generado. ---");
        fs.unlinkSync(req.file.path);

    } catch (err) {
        console.error("🔴 Error Crítico:", err);
    }
});

app.listen(3000, () => console.log('🚀 Corriendo en http://localhost:3000'));