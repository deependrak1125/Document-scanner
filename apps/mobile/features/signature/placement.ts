export type Placement = {
  left: number;
  top: number;
  width: number;
  height: number;
};
/** Map a top-left visual rectangle into the PDF crop box, including page rotation. */
export function pdfPlacement(
  rect: Placement,
  box: { x: number; y: number; width: number; height: number },
  angle: number,
) {
  const rotation = ((angle % 360) + 360) % 360;
  if (![0, 90, 180, 270].includes(rotation))
    throw new Error("Unsupported page rotation.");
  const vw = rotation % 180 ? box.height : box.width;
  const vh = rotation % 180 ? box.width : box.height;
  const l = rect.left * vw,
    top = rect.top * vh,
    width = rect.width * vw,
    height = rect.height * vh;
  const [x, y] =
    rotation === 0
      ? [l, box.height - top - height]
      : rotation === 90
        ? [top + height, l]
        : rotation === 180
          ? [box.width - l, top + height]
          : [box.width - top - height, box.height - l];
  return { x: box.x + x, y: box.y + y, width, height, rotation };
}
