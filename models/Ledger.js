const mongoose = require('mongoose');

const LedgerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'El nombre del grupo es obligatorio'],
        trim: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
}, {
    timestamps: true
});

module.exports = mongoose.model('Ledger', LedgerSchema);
