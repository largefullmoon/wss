const mongoose = require('mongoose');
const { Schema, Types, model, models } = mongoose;

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    company_id: {
      type: String,
    },
    type: {
      type: String,
    },
  },
  { timestamps: true }
);

const Category = models?.Category || model('Category', categorySchema);

module.exports = { Category };
