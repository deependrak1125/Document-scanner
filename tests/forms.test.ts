import { expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { fillForm, inspectForm } from "../packages/pdf/src/forms";
async function fixture() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const form = doc.getForm();
  form
    .createTextField("Name")
    .addToPage(page, { x: 50, y: 700, width: 250, height: 30 });
  form
    .createCheckBox("Approved")
    .addToPage(page, { x: 50, y: 640, width: 20, height: 20 });
  const dropdown = form.createDropdown("Language");
  dropdown.addOptions(["English", "Hindi"]);
  dropdown.addToPage(page, { x: 50, y: 580, width: 150, height: 30 });
  const locked = form.createTextField("Reference");
  locked.setText("123");
  locked.enableReadOnly();
  locked.addToPage(page, { x: 50, y: 520, width: 150, height: 30 });
  return doc.save();
}
it("fills text, checkbox and choices while preserving interactive fields", async () => {
  const input = await fixture();
  const output = await fillForm(input, {
    Name: "Folio reader",
    Approved: true,
    Language: ["Hindi"],
  });
  const fields = await inspectForm(output);
  expect(fields.find((f) => f.name === "Name")?.value).toBe("Folio reader");
  expect(fields.find((f) => f.name === "Approved")?.value).toBe(true);
  expect(fields.find((f) => f.name === "Language")?.value).toEqual(["Hindi"]);
  expect(fields.find((f) => f.name === "Reference")?.readOnly).toBe(true);
  expect((await inspectForm(input)).find((f) => f.name === "Name")?.value).toBe(
    "",
  );
});
it("rejects modifications to read-only fields and unknown choices", async () => {
  const input = await fixture();
  await expect(fillForm(input, { Reference: "changed" })).rejects.toThrow(
    "read-only",
  );
  await expect(fillForm(input, { Language: ["invalid"] })).rejects.toThrow(
    "Invalid choice",
  );
});
it("reports PDFs without interactive fields accurately", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  expect(await inspectForm(await pdf.save())).toEqual([]);
});
