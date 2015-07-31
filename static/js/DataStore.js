var mmData = require('../../data/mm.js');
var pbData = require('../../data/pb.js');

module.exports = {
  mm: {
    info: {
      'number-count': 5,
      'bonus-count': 1,
      'number-range': [1, 75],
      'bonus-range': [1, 15]
    },
    data: mmData
  },
  pb: {
    info: {
      'number-count': 5,
      'bonus-count': 1,
      'number-range': [1, 59],
      'bonus-range': [1, 35]
    },
    data: pbData
  }
};