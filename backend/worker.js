const { Queue, Worker } = require('bullmq');
require('dotenv').config();

const { getAllLeaveTypes } = require('./models/leaveTypeModel');
const {
  getAllUsersForLeaveProcessing,
  updateLeaveBalanceAccrual,
  resetLeaveBalance,
  getLeaveBalancesForUser,
} = require('./models/leaveBalanceModel');
const {
  getLastProcessedDate,
  updateLastProcessedDate,
  initializeJobStatus
} = require('./models/systemJobStatusModel');

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

const leaveProcessingQueue = new Queue('leaveProcessingQueueNew', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 5000,
  },
});

const monthlyAccrualWorker = new Worker('leaveProcessingQueueNew', async (job) => {
  if (job.name === 'monthlyAccrual') {
    console.log(`[Leave Worker] Starting monthly leave accrual process for ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);

    try {
      const users = await getAllUsersForLeaveProcessing();
      const leaveTypes = await getAllLeaveTypes();

      for (const user of users) {
        for (const type of leaveTypes) {
          if (type.monthly_accrual && parseFloat(type.monthly_accrual) > 0) {
            const accrualAmount = parseFloat(type.monthly_accrual);
            const success = await updateLeaveBalanceAccrual(
              user.id,
              type.id,
              accrualAmount
            );
            if (!success) {
              console.warn(`[Leave Worker] Could not update leave balance for user ${user.id} on ${type.name}. It might not exist.`);
            }
          }
        }
      }
      console.log('[Leave Worker] Monthly leave accrual process completed.');
      await updateLastProcessedDate('monthlyAccrual', new Date());
    } catch (error) {
      console.error('[Leave Worker] Error during monthly leave accrual:', error);
      throw error;
    }
  }
}, { connection: redisConnection });

const yearlyResetWorker = new Worker('leaveProcessingQueueNew', async (job) => {
  if (job.name === 'yearlyReset') {
    console.log(`[Leave Worker] Starting yearly leave reset/carry-forward process for ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);

    try {
      const users = await getAllUsersForLeaveProcessing();

      for (const user of users) {
        const userLeaveBalances = await getLeaveBalancesForUser(user.id);

        for (const balanceRecord of userLeaveBalances) {
          if (balanceRecord.carry_forward) {
            const carryAmount = balanceRecord.balance;
            await resetLeaveBalance(user.id, balanceRecord.leave_type_id, carryAmount);
          } else {
            const resetValue = balanceRecord.monthly_accrual;
            await resetLeaveBalance(user.id, balanceRecord.leave_type_id, resetValue);
          }
        }
      }
      console.log('[Leave Worker] Yearly leave reset/carry-forward process completed.');
      await updateLastProcessedDate('yearlyReset', new Date());
    } catch (error) {
      console.error('[Leave Worker] Error during yearly leave reset:', error);
      throw error;
    }
  }
}, { connection: redisConnection });

leaveProcessingQueue.on('completed', job => {
  console.log(`[Leave Worker] Job ${job.id} (${job.name}) completed.`);
});

leaveProcessingQueue.on('failed', (job, err) => {
  console.error(`[Leave Worker] Job ${job.id} (${job.name}) failed with error: ${err.message}`);
});

leaveProcessingQueue.on('error', err => {
  console.error(`[Leave Worker] Worker experienced a general error: ${err.message}`);
});

console.log('[Leave Queue] Leave processing queue and workers initialized.');

const scheduleMonthlyAccrualJob = async () => {
  const jobName = 'monthlyAccrual';
  const monthlyCronPattern = '0 0 1 * *';

  const existingJobs = await leaveProcessingQueue.getRepeatableJobs();
  const jobExists = existingJobs.some(job => job.name === jobName && job.pattern === monthlyCronPattern);

  if (!jobExists) {
    await leaveProcessingQueue.add(jobName, {}, {
      repeat: { cron: monthlyCronPattern },
      jobId: jobName,
      removeOnComplete: true,
      removeOnFail: 5000,
    });
    console.log(`[Leave Scheduler] Scheduled recurring job: ${jobName}`);
  } else {
    console.log(`[Leave Scheduler] Recurring job already exists: ${jobName}`);
  }
};

const scheduleYearlyResetJob = async () => {
  const jobName = 'yearlyReset';
  const yearlyCronPattern = '0 0 1 1 *';

  const existingJobs = await leaveProcessingQueue.getRepeatableJobs();
  const jobExists = existingJobs.some(job => job.name === jobName && job.pattern === yearlyCronPattern);

  if (!jobExists) {
    await leaveProcessingQueue.add(jobName, {}, {
      repeat: { cron: yearlyCronPattern },
      jobId: jobName,
      removeOnComplete: true,
      removeOnFail: 5000,
    });
    console.log(`[Leave Scheduler] Scheduled recurring job: ${jobName}`);
  } else {
    console.log(`[Leave Scheduler] Recurring job already exists: ${jobName}`);
  }
};

const normalizeDateToMonthStart = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
};

const normalizeDateToYearStart = (date) => {
    return new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
};

const processMissedMonthlyAccruals = async () => {
    console.log('[Catch-Up] Starting check for missed monthly accruals...');
    const jobName = 'monthlyAccrual';
    let lastAccrualDate = await getLastProcessedDate(jobName);
    const users = await getAllUsersForLeaveProcessing();
    const leaveTypes = await getAllLeaveTypes();

    const now = new Date();
    const currentMonthStart = normalizeDateToMonthStart(now);

    let checkDate = normalizeDateToMonthStart(lastAccrualDate);
    checkDate.setMonth(checkDate.getMonth() + 1);

    let processedAnyMissed = false;

    while (checkDate <= currentMonthStart) {
        console.log(`[Catch-Up] Processing accrual for month: ${checkDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`);
        processedAnyMissed = true;

        try {
            for (const user of users) {
                for (const type of leaveTypes) {
                    if (type.monthly_accrual && parseFloat(type.monthly_accrual) > 0) {
                        const accrualAmount = parseFloat(type.monthly_accrual);
                        await updateLeaveBalanceAccrual(user.id, type.id, accrualAmount);
                    }
                }
            }
            checkDate.setMonth(checkDate.getMonth() + 1);
            
        } catch (error) {
            console.error(`[Catch-Up] Error processing accrual for month ${checkDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}:`, error);
            throw error; 
        }
    }

    if (processedAnyMissed) {
        await updateLastProcessedDate(jobName, now);
        console.log(`[Catch-Up] Finished processing missed monthly accruals. Last processed date updated to now.`);
    } else {
        console.log('[Catch-Up] No missed monthly accruals to process.');
    }
};

const processMissedYearlyResets = async () => {
    console.log('[Catch-Up] Starting check for missed yearly resets...');
    const jobName = 'yearlyReset';
    let lastResetDate = await getLastProcessedDate(jobName);
    const users = await getAllUsersForLeaveProcessing();

    const now = new Date();
    const currentYearStart = normalizeDateToYearStart(now);

    let checkDate = normalizeDateToYearStart(lastResetDate);
    checkDate.setFullYear(checkDate.getFullYear() + 1);

    let processedAnyMissed = false;

    while (checkDate <= currentYearStart) {
        console.log(`[Catch-Up] Processing reset for year: ${checkDate.getFullYear()}`);
        processedAnyMissed = true;

        try {
            for (const user of users) {
                const userLeaveBalances = await getLeaveBalancesForUser(user.id);
                for (const balanceRecord of userLeaveBalances) {
                    if (balanceRecord.carry_forward) {
                        const carryAmount = balanceRecord.balance;
                        await resetLeaveBalance(user.id, balanceRecord.leave_type_id, carryAmount);
                    } else {
                        const resetValue = balanceRecord.monthly_accrual;
                        await resetLeaveBalance(user.id, balanceRecord.leave_type_id, resetValue);
                    }
                }
            }
            checkDate.setFullYear(checkDate.getFullYear() + 1);

        } catch (error) {
            console.error(`[Catch-Up] Error processing reset for year ${checkDate.getFullYear()}:`, error);
            throw error;
        }
    }

    if (processedAnyMissed) {
        await updateLastProcessedDate(jobName, now);
        console.log(`[Catch-Up] Finished processing missed yearly resets. Last processed date updated to now.`);
    } else {
        console.log('[Catch-Up] No missed yearly resets to process.');
    }
};

(async () => {
    try {
        console.log('[Leave Queue] Starting BullMQ and Catch-Up Initialization Sequence...');

        await processMissedMonthlyAccruals();
        await processMissedYearlyResets();

        await scheduleMonthlyAccrualJob();
        await scheduleYearlyResetJob();
    } catch (error) {
        console.error('[Leave Queue] FATAL ERROR during queue initialization or catch-up:', error);
    }
})();

module.exports = { leaveProcessingQueue };