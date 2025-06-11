const db = require("./db");

const getAllTeamEvents = async (userIds, month, year) => {
  if (!userIds.length) return [];

  const placeholders = userIds.map(() => "?").join(",");
  const [rows] = await db.query(
    `
        SELECT
            lr.id,
            lr.user_id,
            u.name AS user_name,
            lt.name AS leave_type_name,
            lr.start_date,
            lr.end_date,
            lr.reason,
            lr.status,
            lr.user_status
        FROM leave_requests lr
        JOIN users u ON lr.user_id = u.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE lr.user_id IN (${placeholders})
          AND lr.status = 'Approved'
          AND lr.user_status != 'Cancelled'
          AND (
            lr.start_date <= LAST_DAY(STR_TO_DATE(CONCAT(?, '-', ?, '-01'), '%Y-%m-%d'))
            AND lr.end_date >= STR_TO_DATE(CONCAT(?, '-', ?, '-01'), '%Y-%m-%d')
          )
        `,
    [...userIds, year, month, year, month]
  );

  return rows;
};

const getHolidays = async (month, year) => {
  const [rows] = await db.query(
    `
    SELECT id, name, date
    FROM holidays
    WHERE MONTH(date) = ? AND YEAR(date) = ?
    `,
    [month, year]
  );
  return rows;
};

module.exports = {
  getHolidays,
  getAllTeamEvents,
};