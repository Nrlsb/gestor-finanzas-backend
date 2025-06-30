const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Ledger = require('../models/Ledger');

// @route   GET api/ledgers
// @desc    Obtener todos los grupos del usuario logueado
router.get('/', auth, async (req, res) => {
    try {
        const ledgers = await Ledger.find({ user: req.user.id }).sort({ createdAt: 'asc' });
        res.json(ledgers);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del Servidor');
    }
});

// @route   POST api/ledgers
// @desc    Crear un nuevo grupo contable
router.post('/', auth, async (req, res) => {
    const { name } = req.body;
    try {
        let existingLedger = await Ledger.findOne({ name, user: req.user.id });
        if (existingLedger) {
            return res.status(400).json({ msg: 'Ya existe un grupo con ese nombre' });
        }

        const newLedger = new Ledger({
            name,
            user: req.user.id
        });

        const ledger = await newLedger.save();
        res.json(ledger);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error del Servidor');
    }
});

module.exports = router;
