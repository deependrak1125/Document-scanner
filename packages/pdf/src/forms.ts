import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  StandardFonts,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
export type FormField = {
  name: string;
  kind: "text" | "checkbox" | "choice" | "unsupported";
  value: string | boolean | string[];
  options?: string[];
  multiple?: boolean;
  readOnly: boolean;
  maxLength?: number;
};
export async function inspectForm(bytes: Uint8Array): Promise<FormField[]> {
  const pdf = await PDFDocument.load(bytes);
  return pdf
    .getForm()
    .getFields()
    .map((field) => {
      const base = { name: field.getName(), readOnly: field.isReadOnly() };
      if (field instanceof PDFTextField)
        return {
          ...base,
          kind: "text",
          value: field.getText() ?? "",
          maxLength: field.getMaxLength(),
        };
      if (field instanceof PDFCheckBox)
        return { ...base, kind: "checkbox", value: field.isChecked() };
      if (field instanceof PDFDropdown || field instanceof PDFOptionList)
        return {
          ...base,
          kind: "choice",
          value: field.getSelected(),
          options: field.getOptions(),
          multiple: field.isMultiselect(),
        };
      if (field instanceof PDFRadioGroup)
        return {
          ...base,
          kind: "choice",
          value: field.getSelected() ? [field.getSelected()!] : [],
          options: field.getOptions(),
          multiple: false,
        };
      return { ...base, kind: "unsupported", value: "" };
    });
}
export async function fillForm(
  bytes: Uint8Array,
  values: Record<string, string | boolean | string[]>,
  fontBytes?: Uint8Array,
) {
  const pdf = await PDFDocument.load(bytes),
    form = pdf.getForm();
  for (const [name, value] of Object.entries(values)) {
    const field = form.getField(name);
    if (field.isReadOnly()) throw new Error(`“${name}” is read-only.`);
    if (field instanceof PDFTextField && typeof value === "string")
      field.setText(value);
    else if (field instanceof PDFCheckBox && typeof value === "boolean") {
      if (value) field.check();
      else field.uncheck();
    } else if (
      (field instanceof PDFDropdown || field instanceof PDFOptionList) &&
      Array.isArray(value)
    ) {
      if (value.some((v) => !field.getOptions().includes(v)))
        throw new Error(`Invalid choice for “${name}”.`);
      if (!field.isMultiselect() && value.length > 1)
        throw new Error(`Choose one option for “${name}”.`);
      field.clear();
      if (value.length) field.select(value);
    } else if (field instanceof PDFRadioGroup && Array.isArray(value)) {
      if (
        value.length > 1 ||
        value.some((v) => !field.getOptions().includes(v))
      )
        throw new Error(`Invalid choice for “${name}”.`);
      field.clear();
      if (value.length) field.select(value[0]);
    } else throw new Error(`This field type cannot be filled: ${name}`);
  }
  pdf.registerFontkit(fontkit);
  const font = fontBytes
    ? await pdf.embedFont(fontBytes, { subset: true })
    : await pdf.embedFont(StandardFonts.Helvetica);
  form.updateFieldAppearances(font);
  return pdf.save();
}
