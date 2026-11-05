import { Router, raw } from "express";
import {
  officeToPdf,
  officeExtensions,
  type OfficeExtension,
} from "./office-conversion.js";
import { HttpError } from "./security.js";
export const officeTools = Router();
let active = false;
officeTools.post(
  "/convert",
  raw({ type: "application/octet-stream", limit: "30mb" }),
  async (req, res) => {
    if (process.env.OFFICE_CONVERSION_ENABLED !== "true")
      throw new HttpError(
        503,
        "Office conversion is not enabled on this server.",
      );
    if (req.headers["x-folio-consent"] !== "upload-for-processing")
      throw new HttpError(400, "Explicit processing consent is required.");
    const extension = String(
      req.headers["x-folio-format"] ?? "",
    ) as OfficeExtension;
    if (!officeExtensions.includes(extension) || !Buffer.isBuffer(req.body))
      throw new HttpError(400, "Choose a DOCX, XLSX or PPTX file.");
    if (active)
      throw new HttpError(
        429,
        "The conversion worker is busy. Try again shortly.",
      );
    active = true;
    try {
      res.type("application/pdf").send(await officeToPdf(req.body, extension));
    } catch {
      throw new HttpError(
        422,
        "Conversion failed. Check that the file is a valid, unencrypted Office document and LibreOffice is installed on the server.",
      );
    } finally {
      active = false;
    }
  },
);
