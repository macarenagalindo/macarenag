const cron = require("node-cron");
import shell = require("shelljs");
import { sendEmailJob } from "./mailer";

export const startCron = () => {
  console.log("Cron job running...");
  cron.schedule("10 10 * * mon", async function () {
    console.log("Sending email");
    await sendEmailJob();
  });
};
