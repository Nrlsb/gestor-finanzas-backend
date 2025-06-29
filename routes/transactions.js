const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const mongoose = require('mongoose'); // Importar mongoose

// --- INICIO: Configuración del cliente de IA de Gemini ---
let genAI;
let aiModel;
if (process.env.GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log('Cliente de IA de Gemini inicializado correctamente.');
  } catch (error) {
    console.error('Error inicializando el cliente de IA de Gemini:', error);
  }
} else {
  console.warn('ADVERTENCIA: La variable de entorno GEMINI_API_KEY no está definida. La funcionalidad de IA estará deshabilitada.');
}
// --- FIN: Configuración del cliente de IA de Gemini ---

// @route   GET api/transactions
// @desc    Obtener todas las transacciones del usuario logueado
router.get('/', auth, async (req, res) => {
    try {
        const transactions = await Transaction.find({ user: req.user.id }).sort({ date: -1 });
        res.json(transactions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del Servidor');
    }
});

// @route   POST api/transactions
// @desc    Agregar una nueva transacción
router.post('/', auth, async (req, res) => {
    const { type, description, amount, category, date, originalAmount, divisionFactor, isInstallment, totalInstallments, paidInstallments } = req.body;
    try {
        const newTransaction = new Transaction({
            user: req.user.id, type, description, amount, category, date, originalAmount, divisionFactor, isInstallment, totalInstallments, paidInstallments
        });
        const transaction = await newTransaction.save();
        res.json(transaction);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del Servidor');
    }
});

// @route   PUT api/transactions/:id
// @desc    Actualizar una transacción
router.put('/:id', auth, async (req, res) => {
    const { description, amount: totalAmount, category, divisionFactor, isInstallment, totalInstallments, paidInstallments } = req.body;
    try {
        let transaction = await Transaction.findById(req.params.id);
        if (!transaction) return res.status(404).json({ msg: 'Transacción no encontrada' });
        if (transaction.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'No autorizado' });
        }
        const transactionFields = { description, category, originalAmount: totalAmount };
        if (transaction.type === 'egreso') {
            transactionFields.divisionFactor = divisionFactor || 1;
            transactionFields.amount = totalAmount / transactionFields.divisionFactor;
            transactionFields.isInstallment = isInstallment || false;
            if (isInstallment) {
                transactionFields.totalInstallments = totalInstallments;
                transactionFields.paidInstallments = paidInstallments;
            } else {
                transactionFields.totalInstallments = undefined;
                transactionFields.paidInstallments = undefined;
            }
        } else {
            transactionFields.amount = totalAmount;
        }
        const updatedTransaction = await Transaction.findByIdAndUpdate(
            req.params.id, { $set: transactionFields }, { new: true }
        );
        res.json(updatedTransaction);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del Servidor');
    }
});

// @route   DELETE api/transactions/:id
// @desc    Eliminar una transacción
router.delete('/:id', auth, async (req, res) => {
    try {
        let transaction = await Transaction.findById(req.params.id);
        if (!transaction) return res.status(404).json({ msg: 'Transacción no encontrada' });
        if (transaction.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'No autorizado' });
        }
        await Transaction.findByIdAndDelete(req.params.id);
        res.status(204).send();
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del Servidor');
    }
});


// --- INICIO: NUEVAS RUTAS DE ANÁLISIS ---

/**
 * @route   GET api/transactions/summary
 * @desc    Obtiene un resumen de ingresos, egresos y gastos por categoría.
 * Acepta query params opcionales: `startDate` y `endDate` (formato YYYY-MM-DD).
 * @access  Private
 */
router.get('/summary', auth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Construir el filtro de fecha
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999); // Incluir todo el día final
            dateFilter.$lte = end;
        }
        
        // El filtro base siempre incluye al usuario
        const baseFilter = { user: new mongoose.Types.ObjectId(req.user.id) };
        if (startDate || endDate) {
            baseFilter.date = dateFilter;
        }

        const transactions = await Transaction.find(baseFilter);

        let totalIncome = 0;
        let totalExpenses = 0;
        const expensesByCategory = {};

        transactions.forEach(t => {
            if (t.type === 'ingreso') {
                totalIncome += t.amount;
            } else {
                totalExpenses += (t.originalAmount || t.amount); // Usar originalAmount si existe para el total
                expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + (t.originalAmount || t.amount);
            }
        });

        res.json({
            totalIncome,
            totalExpenses,
            balance: totalIncome - totalExpenses,
            expensesByCategory
        });

    } catch (err) {
        console.error("Error en /summary:", err.message);
        res.status(500).send('Error del Servidor al generar el resumen');
    }
});

/**
 * @route   POST api/transactions/analyze-ai
 * @desc    Envía las transacciones a una IA para obtener un análisis financiero.
 * El cuerpo de la solicitud (body) puede contener `startDate` y `endDate`.
 * @access  Private
 */
router.post('/analyze-ai', auth, async (req, res) => {
    if (!aiModel) {
        return res.status(503).json({ msg: 'La funcionalidad de IA no está disponible. Contacta al administrador.' });
    }

    try {
        const { startDate, endDate } = req.body;

        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);
            dateFilter.$lte = end;
        }

        const baseFilter = { user: req.user.id };
        if (startDate || endDate) {
            baseFilter.date = dateFilter;
        }

        const transactions = await Transaction.find(baseFilter).sort({ date: -1 }).limit(100);

        if (transactions.length < 5) {
            return res.status(400).json({ msg: 'No hay suficientes datos para realizar un análisis significativo. Registra al menos 5 transacciones.' });
        }
        
        const simplifiedTransactions = transactions.map(t => ({
            tipo: t.type,
            monto: (t.originalAmount || t.amount),
            categoria: t.category,
            descripcion: t.description,
            fecha: t.date.toISOString().split('T')[0]
        }));
        
        const prompt = `
            Eres un asistente financiero personal experto llamado 'FinancIA'. Tu tono es amigable, alentador y profesional.
            Analiza el siguiente listado de transacciones (en formato JSON) de un usuario. Basado en estos datos, proporciona un análisis claro y útil.

            Listado de transacciones:
            ${JSON.stringify(simplifiedTransactions, null, 2)}

            Tu respuesta debe seguir estrictamente la siguiente estructura en formato Markdown:

            ### 📈 Resumen de tu Actividad
            Un párrafo breve que resuma el comportamiento general (ej: "He notado que tus ingresos son estables, y la mayoría de tus gastos se concentran en...").

            ### 💡 Puntos Clave y Observaciones
            - **Observación 1:** Un punto específico que hayas notado (ej: "El gasto en 'Comida' representa el 40% de tus egresos.").
            - **Observación 2:** Otro punto relevante (ej: "Tus ingresos han aumentado ligeramente este último período.").
            - **Observación 3:** Cualquier otro patrón interesante.

            ### 🚀 Consejos para Mejorar
            1.  **Consejo 1:** Una recomendación práctica y accionable basada en las observaciones (ej: "Considera establecer un presupuesto semanal de X para la categoría 'Ocio' para controlar esos gastos.").
            2.  **Consejo 2:** Otra recomendación específica.

            No incluyas saludos iniciales ni despedidas. Ve directamente al análisis.
        `;
        
        const result = await aiModel.generateContent(prompt);
        const response = await result.response;
        const analysisText = response.text();

        res.json({ analysis: analysisText });

    } catch (err) {
        console.error("Error en /analyze-ai:", err.message);
        res.status(500).send('Error del Servidor al contactar al servicio de IA');
    }
});


module.exports = router;
