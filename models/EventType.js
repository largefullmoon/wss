const mongoose = require('mongoose');

const eventTypeSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
          },
          params: [{
            number: {
              type: String
            },
            operator: {
              type: String
            },
            category_id: {
              type: mongoose.Schema.Types.ObjectId, ref: 'Category',
            },
            condition_id: {
              type: mongoose.Schema.Types.ObjectId, ref: 'Condition'
            }
          }],
          standard_middle_value: {
            type: String,
          },
          standard_low_value: {
            type: String,
          },
          company_id: {
            type: String,
          },
          type: {
            type: String,
          }
    },
    { timestamps: true }
);

module.exports = mongoose.model('EventType', eventTypeSchema);
