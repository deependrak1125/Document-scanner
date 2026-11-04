import { Router, raw } from "express";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { HttpError } from "./security.js";
const exec = promisify(execFile);
const options = z.object({
  operation: z.enum(["compress", "encrypt", "decrypt", "text", "image"]),
  password: z.string().min(1).max(128).optional(),
  page: z.number().int().min(1).max(500).default(1),
});
export const pdfTools = Router();
let active = 0;
pdfTools.post(
  "/process",
  raw({ type: "application/pdf", limit: "30mb" }),
  async (req, res) => {
    if (req.headers["x-folio-consent"] !== "upload-for-processing")
      throw new HttpError(400, "Explicit processing consent is required.");
    const parsed = options.safeParse(
      JSON.parse(String(req.headers["x-folio-options"] ?? "{}")),
    );
    if (!parsed.success) throw new HttpError(400, "Invalid PDF operation.");
    const input = parsed.data;
    if (
      !Buffer.isBuffer(req.body) ||
      req.body.subarray(0, 5).toString() !== "%PDF-"
    )
      throw new HttpError(422, "A PDF file is required.");
    if (active >= 2)
      throw new HttpError(429, "PDF workers are busy. Try again shortly.");
    active++;
    let dir: string | undefined;
    try {
      dir = await mkdtemp(join(tmpdir(), "folio-"));
      const source = join(dir, "input.pdf"),
        output = join(dir, "output.pdf");
      await writeFile(source, req.body, { mode: 0o600 });
      if (input.operation === "text") {
        const text = join(dir, "output.txt");
        await exec("pdftotext", ["-layout", source, text], {
          timeout: 60000,
          maxBuffer: 1048576,
        });
        res.type("text/plain").send(await readFile(text));
        return;
      }
      if (input.operation === "image") {
        const image = join(dir, "page");
        await exec(
          "pdftoppm",
          [
            "-f",
            String(input.page),
            "-l",
            String(input.page),
            "-scale-to",
            "2400",
            "-singlefile",
            "-png",
            source,
            image,
          ],
          { timeout: 60000, maxBuffer: 1048576 },
        );
        res.type("image/png").send(await readFile(`${image}.png`));
        return;
      }
      const job: Record<string, unknown> = {
        inputFile: source,
        outputFile: output,
      };
      if (input.operation === "compress")
        Object.assign(job, {
          compressStreams: "y",
          recompressFlate: "",
          compressionLevel: "9",
          objectStreams: "generate",
        });
      if (input.operation === "encrypt") {
        if (!input.password) throw new HttpError(400, "Enter a password.");
        job.encrypt = {
          userPassword: input.password,
          ownerPassword: input.password,
          bits: 256,
        };
      }
      if (input.operation === "decrypt") {
        if (!input.password)
          throw new HttpError(400, "Enter the existing password.");
        job.password = input.password;
        job.decrypt = "";
      }
      const jobFile = join(dir, "job.json");
      await writeFile(jobFile, JSON.stringify(job), { mode: 0o600 });
      await exec("qpdf", [`--job-json-file=${jobFile}`], {
        timeout: 60000,
        maxBuffer: 1048576,
      });
      res.type("application/pdf").send(await readFile(output));
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(
        422,
        "PDF processing failed. Check the file, password, and server tool installation.",
      );
    } finally {
      active--;
      if (dir) await rm(dir, { recursive: true, force: true });
    }
  },
);
