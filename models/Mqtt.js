const mongoose = require('mongoose');

const mqttServerSchema = new mongoose.Schema(
    {
     mqtt_server:{
       type: String,
       required: true,
     },
     mqtt_username: {
       type: String,
     },
     mqtt_password: {
       type: String
     },
     position_topic: {
       type: String,
       default: "silabs/aoa/position/#"
     },
     angle_topic:{
       type: String,
       default: "silabs/aoa/angle/#"
     },
     manuf_topic:{
       type: String,
       default: "fam/manuf_data/#"
     },
     zone: {
       type: mongoose.Schema.Types.ObjectId, ref: "Zone",
       default: null,
     },
    } ,
    { timestamps: true }
   )

module.exports = mongoose.model('mqttServer', mqttServerSchema);