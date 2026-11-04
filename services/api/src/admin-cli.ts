import mongoose from "mongoose";
import { config } from "./config.js";
import { User } from "./models.js";
const email = process.argv[2]?.toLowerCase();
if (!email)
  throw new Error(
    "Usage: npm run admin -w @folio/api -- registered-admin@example.com",
  );
await mongoose.connect(config.MONGODB_URI);
const user = await User.findOneAndUpdate(
  { email, accountStatus: "active" },
  { role: "admin" },
);
if (!user) throw new Error("Register the account before promoting it.");
process.stdout.write("Administrator role granted.\n");
await mongoose.disconnect();
