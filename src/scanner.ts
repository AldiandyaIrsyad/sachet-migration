import type { IScannerControls } from '@zxing/browser';

// ZXing is loaded on first use so the main bundle stays small.
async function reader() {
  const { BrowserMultiFormatReader } = await import('@zxing/browser');
  return new BrowserMultiFormatReader();
}

/** Starts the rear camera and calls onCode once with the first barcode it reads. */
export async function scanFromCamera(
  video: HTMLVideoElement,
  onCode: (code: string) => void,
): Promise<IScannerControls> {
  const r = await reader();
  let done = false;
  const controls = await r.decodeFromConstraints(
    { video: { facingMode: 'environment' } },
    video,
    (result, _err, ctl) => {
      if (result && !done) {
        done = true;
        ctl.stop();
        onCode(result.getText());
      }
    },
  );
  return controls;
}

export async function scanFromImage(file: File): Promise<string> {
  const r = await reader();
  const url = URL.createObjectURL(file);
  try {
    const result = await r.decodeFromImageUrl(url);
    return result.getText();
  } finally {
    URL.revokeObjectURL(url);
  }
}
