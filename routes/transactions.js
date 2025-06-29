const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');

// @route   GET api/transactions
// @desc    Obtener todas las transacciones del usuario logueado
// @access  Private
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
// @access  Private
router.post('/', auth, async (req, res) => {
    const { type, description, amount, category, originalAmount, divisionFactor, isInstallment, totalInstallments, paidInstallments } = req.body;
    try {
        const newTransaction = new Transaction({
            user: req.user.id, type, description, amount, category, originalAmount, divisionFactor, isInstallment, totalInstallments, paidInstallments
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
// @access  Private
router.put('/:id', auth, async (req, res) => {
    // <-- CAMBIO: Extraemos todos los campos posibles del body
    const { description, amount: totalAmount, category, divisionFactor, isInstallment, totalInstallments, paidInstallments } = req.body;

    try {
        let transaction = await Transaction.findById(req.params.id);
        if (!transaction) return res.status(404).json({ msg: 'Transacción no encontrada' });

        if (transaction.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'No autorizado' });
        }

        // Construir el objeto de actualización
        const transactionFields = {
            description,
            category,
            originalAmount: totalAmount, // El monto que llega es siempre el total
        };

        if (transaction.type === 'egreso') {
            transactionFields.divisionFactor = divisionFactor || 1;
            transactionFields.amount = totalAmount / transactionFields.divisionFactor; // Recalcular el monto de la cuota/división
            
            transactionFields.isInstallment = isInstallment || false;
            if (isInstallment) {
                transactionFields.totalInstallments = totalInstallments;
                transactionFields.paidInstallments = paidInstallments;
            } else {
                // Si se desmarca la opción de cuotas, eliminamos los campos
                transactionFields.totalInstallments = undefined;
                transactionFields.paidInstallments = undefined;
            }
        } else {
            // Si es un ingreso, el monto es directo
            transactionFields.amount = totalAmount;
        }

        const updatedTransaction = await Transaction.findByIdAndUpdate(
            req.params.id,
            { $set: transactionFields },
            { new: true }
        );

        res.json(updatedTransaction);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del Servidor');
    }
});


// @route   DELETE api/transactions/:id
// @desc    Eliminar una transacción
// @access  Private
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


module.exports = router;
