const mongoose = require('mongoose');
const { Schema, Types, model, models } = mongoose;

const category_conditionSchema = new mongoose.Schema(
  {
    condition_id: {
      type: Schema.Types.ObjectId, ref: 'Condition',
    },
    company_id: {
      type: String,
    },
    category_id: {
      type: Schema.Types.ObjectId, ref: 'Category',
    },
    type: {
      type: String,
    },
  },
  { timestamps: true }
);

const CategoryCondition = models?.CategoryCondition || model('CategoryCondition', category_conditionSchema);

module.exports = { CategoryCondition };
