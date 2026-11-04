import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import mongoose from "mongoose";
import { registration } from "@folio/validation";
import { config } from "./config.js";
import { User } from "./models.js";

const input = registration.parse({
  email: process.argv[2] ?? process.env.ADMIN_EMAIL ?? "admin@folio.local",
  name: process.env.ADMIN_NAME ?? "Folio Admin",
  password: process.env.ADMIN_PASSWORD ?? randomBytes(18).toString("base64url"),
});

try {
  await mongoose.connect(config.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  await User.init();
  const existing = await User.findOne({ email: input.email }).select(
    "+passwordHash",
  );
  if (existing) {
    if (existing.accountStatus !== "active" || !existing.passwordHash)
      throw new Error(
        "Existing account must be active and have password login enabled.",
      );
    existing.role = "admin";
    await existing.save();
    console.log(`Admin ready: ${input.email}. Existing password preserved.`);
  } else {
    const passwordHash = await argon2.hash(input.password);
    const user = await User.create({
      email: input.email,
      name: input.name,
      passwordHash,
      role: "admin",
      accountStatus: "active",
    });
    const saved = await User.findById(user.id).select("+passwordHash");
    if (
      !saved?.passwordHash ||
      !(await argon2.verify(saved.passwordHash, input.password))
    )
      throw new Error("Seeded credential verification failed.");
    console.log(
      `Admin created and password verified.\nEmail: ${input.email}\nPassword: ${input.password}`,
    );
  }
} finally {
  await mongoose.disconnect();
}
