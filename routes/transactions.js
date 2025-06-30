const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const mongoose = require('mongoose');

let genAI;
let aiModel;
if (process.env.GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  } catch (error) { console.error('Error inicializando Gemini:', error); }
}

// @route   GET api/transactions
// @desc    Obtener todas las transacciones de un grupo específico
router.get('/', auth, async (req, res) => {
    try {
        const { ledgerId } = req.query;
        if (!ledgerId) {
            return res.status(400).json({ msg: 'Se requiere el ID del grupo (ledgerId)' });
        }
        const transactions = await Transaction.find({ user: req.user.id, ledger: ledgerId }).sort({ date: -1 });
        res.json(transactions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del Servidor');
    }
});

// @route   POST api/transactions
// @desc    Agregar una nueva transacción a un grupo
router.post('/', auth, async (req, res) => {
    const { type, description, amount, category, date, originalAmount, divisionFactor, isInstallment, totalInstallments, paidInstallments, ledgerId } = req.body;
    try {
        if (!ledgerId) {
             return res.status(400).json({ msg: 'Se requiere el ID del grupo (ledgerId)' });
        }
        const newTransaction = new Transaction({
            user: req.user.id,
            ledger: ledgerId,
            type, description, amount, category, date, originalAmount, divisionFactor, isInstallment, totalInstallments, paidInstallments
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
            transactionFields.amount = totalAmount / (divisionFactor || 1);
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
            transactionFields.originalAmount = totalAmount;
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
        res.json({ msg: 'Transacción eliminada' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del Servidor');
    }
});


// @route   POST api/transactions/analyze-ai
// @desc    Envía las transacciones de un grupo a la IA para obtener un análisis
router.post('/analyze-ai', auth, async (req, res) => {
    if (!aiModel) {
        return res.status(503).json({ msg: 'La funcionalidad de IA no está disponible.' });
    }

    try {
        const { startDate, endDate, ledgerId } = req.body;

        if (!ledgerId) {
            return res.status(400).json({ msg: 'Se requiere el ID del grupo (ledgerId)' });
        }

        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);
            dateFilter.$lte = end;
        }

        const baseFilter = { user: req.user.id, ledger: ledgerId };
        if (startDate || endDate) {
            baseFilter.date = dateFilter;
        }

        const transactions = await Transaction.find(baseFilter).sort({ date: -1 }).limit(100);

        if (transactions.length < 5) {
            return res.status(400).json({ msg: 'No hay suficientes datos en este grupo para realizar un análisis.' });
        }
        
        const simplifiedTransactions = transactions.map(t => ({
            tipo: t.type,
            monto: (t.originalAmount || t.amount),
            categoria: t.category,
            descripcion: t.description,
            fecha: t.date.toISOString().split('T')[0]
        }));
        
        const prompt = `
            Eres un asistente financiero personal experto llamado 'FinancIA'. Analiza el siguiente listado de transacciones de un usuario. Basado en estos datos, proporciona un análisis claro, útil y alentador en formato Markdown.

            Listado de transacciones:
            ${JSON.stringify(simplifiedTransactions, null, 2)}

            Tu respuesta debe seguir estrictamente la siguiente estructura:

            ### 📈 Resumen de tu Actividad
            Un párrafo breve que resuma el comportamiento general.

            ### 💡 Puntos Clave y Observaciones
            - **Observación 1:** Un punto específico y relevante que hayas notado.
            - **Observación 2:** Otro punto relevante.
            - **Observación 3:** Cualquier otro patrón interesante.

            ### 🚀 Consejos para Mejorar
            1.  **Consejo 1:** Una recomendación práctica y accionable.
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
