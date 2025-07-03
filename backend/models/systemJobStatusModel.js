const db = require('./db');

const getLastProcessedDate = async (jobName) => {
    try {
        const [rows] = await db.query(
            'SELECT last_processed_at FROM system_job_status WHERE job_name = ?',
            [jobName]
        );
        if (rows.length > 0) {
            return rows[0].last_processed_at;
        }
        console.warn(`[SystemJobStatusModel] Job '${jobName}' not found in system_job_status. Returning default old date (2000-01-01).`);
        return new Date('2000-01-01T00:00:00.000Z');
    } catch (error) {
        console.error(`[SystemJobStatusModel] Error fetching last processed date for '${jobName}':`, error);
        throw error;
    }
};

const updateLastProcessedDate = async (jobName, date = new Date()) => {
    try {
        const [result] = await db.query(
            `INSERT INTO system_job_status (job_name, last_processed_at)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE
             last_processed_at = GREATEST(last_processed_at, VALUES(last_processed_at))`,
            [jobName, date]
        );
        return result.affectedRows > 0 || result.insertId !== 0;
    } catch (error) {
        console.error(`[SystemJobStatusModel] Error updating last processed date for '${jobName}':`, error);
        throw error;
    }
};

const initializeJobStatus = async (jobName, initialDate = new Date()) => {
    try {
        await updateLastProcessedDate(jobName, initialDate);
        console.log(`[SystemJobStatusModel] Initialized/checked status for job: ${jobName}`);
    } catch (error) {
        console.error(`[SystemJobStatusModel] Error initializing job status for '${jobName}':`, error);
        throw error;
    }
};

module.exports = {
    getLastProcessedDate,
    updateLastProcessedDate,
    initializeJobStatus
};