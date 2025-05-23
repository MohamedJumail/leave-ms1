const HolidayModel = require('../models/holidayModel'); // ⬅️ Import model directly

const HolidayController = {
  add: async (request, h) => {
    try {
      const { date, name } = request.payload;
      const result = await HolidayModel.add(date, name); // ⬅️ Direct model call
      return h.response({ success: true, result }).code(201);
    } catch (err) {
      return h.response({ error: err.message }).code(500);
    }
  },

  list: async (request, h) => {
    try {
      const holidays = await HolidayModel.getAll(); // ⬅️ Direct model call
      return h.response({ success: true, holidays }).code(200);
    } catch (err) {
      return h.response({ error: err.message }).code(500);
    }
  },

  delete: async (request, h) => {
    try {
      const id = request.params.id;
      const result = await HolidayModel.deleteById(id); // ⬅️ Direct model call
      return h.response({ success: true, result }).code(200);
    } catch (err) {
      return h.response({ error: err.message }).code(500);
    }
  }
};

module.exports = HolidayController;
