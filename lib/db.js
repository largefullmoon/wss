const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://185.61.139.44:27777/dash';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });
