import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const exec = promisify(execFile);
export const officeExtensions = ["docx", "xlsx", "pptx"] as const;
export type OfficeExtension = (typeof officeExtensions)[number];
export async function officeToPdf(bytes: Buffer, extension: OfficeExtension) {
  if (
    !officeExtensions.includes(extension) ||
    bytes.length > 30 * 1048576 ||
    bytes.subarray(0, 2).toString() !== "PK"
  )
    throw new Error("Choose a DOCX, XLSX or PPTX file under 30 MB.");
  const dir = await mkdtemp(join(tmpdir(), "folio-office-"));
  try {
    const source = join(dir, `input.${extension}`),
      out = join(dir, "output"),
      profile = join(dir, "profile");
    await mkdir(out);
    await mkdir(join(profile, "user"), { recursive: true });
    // Use a fresh profile with macros disabled and external document links never updated.
    await writeFile(
      join(profile, "user", "registrymodifications.xcu"),
      `<?xml version="1.0"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item><item oor:path="/org.openoffice.Office.Writer/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>0</value></prop></item><item oor:path="/org.openoffice.Office.Calc/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>0</value></prop></item></oor:items>`,
    );
    await writeFile(source, bytes, { mode: 0o600 });
    const filter =
      extension === "docx"
        ? "writer_pdf_Export"
        : extension === "xlsx"
          ? "calc_pdf_Export"
          : "impress_pdf_Export";
    await exec(
      process.env.LIBREOFFICE_BIN || "soffice",
      [
        `-env:UserInstallation=${pathToFileURL(profile).href}`,
        "--headless",
        "--nologo",
        "--nodefault",
        "--norestore",
        "--convert-to",
        `pdf:${filter}`,
        "--outdir",
        out,
        source,
      ],
      { timeout: 90000, maxBuffer: 1048576 },
    );
    const result = await readFile(join(out, "input.pdf"));
    if (
      result.subarray(0, 5).toString() !== "%PDF-" ||
      result.length > 60 * 1048576
    )
      throw new Error("Conversion did not produce a supported PDF.");
    return result;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
