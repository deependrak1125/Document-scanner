import mongoose from "mongoose";
import { config } from "./config.js";
import { createApp, logger } from "./app.js";
import { enqueueDeletion, startJobs, worker, queue } from "./jobs.js";
await mongoose.connect(config.MONGODB_URI);
await startJobs();
const server = createApp({ enqueueDeletion }).listen(config.PORT, () =>
  logger.info({ port: config.PORT }, "Folio API listening"),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close(() => {
      void Promise.all([
        worker.close(),
        queue.close(),
        mongoose.disconnect(),
      ]).then(() => process.exit(0));
    });
  });
