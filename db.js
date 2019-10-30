const { Pool } = require('pg');
let pool;

module.exports = {
  connect: (connectionInfos) => {
  	pool = new Pool(connectionInfos);
  	return pool.query("select now()");
  },
  query: (text, params, cb) => { console.log(text); return pool.query(text, params, cb)}
};
			