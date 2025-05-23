const db = require('./db');

const HolidayModel = {
  add: (date, name) => {
    const query = `INSERT INTO holidays (date, name) VALUES (?, ?)`;
    return db.query(query, [date, name]);
  },

  getAll: () => {
    const query = `
      SELECT * FROM holidays
      WHERE 
        name IS NOT NULL AND name NOT IN ('name', 'id', '')
        AND date IS NOT NULL AND date NOT IN ('date', '') 
      ORDER BY date ASC
    `;
    return db.query(query);
  },  

  deleteById: (id) => {
    const query = `DELETE FROM holidays WHERE id = ?`;
    return db.query(query, [id]);
  }
};

module.exports = HolidayModel;
