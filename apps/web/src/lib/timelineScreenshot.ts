import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/** Renders a DOM element to a PNG data URL — the shared capture step behind both the PDF export and the XLSX export's embedded timeline images. */
export async function captureElementAsPng(element: HTMLElement): Promise<{ dataUrl: string; width: number; height: number }> {
  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
    // Interactive-only chrome (zoom +/- buttons) has no place in a static export.
    ignoreElements: (el) => el.classList.contains('no-export'),
  });
  return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
}

/** Builds a single-page, visualization-focused PDF sized to fit the captured image and triggers a download. */
export async function exportElementAsPdf(element: HTMLElement, filename: string, title: string) {
  const { dataUrl, width, height } = await captureElementAsPng(element);

  const marginPt = 24;
  const titleHeightPt = 28;
  const pxToPt = 0.75; // 96 CSS px/in -> 72 pt/in, i.e. * 0.75
  const contentWidthPt = width * pxToPt;
  const contentHeightPt = height * pxToPt;

  const doc = new jsPDF({
    orientation: contentWidthPt > contentHeightPt ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [contentWidthPt + marginPt * 2, contentHeightPt + marginPt * 2 + titleHeightPt],
  });

  doc.setFontSize(14);
  doc.text(title, marginPt, marginPt + 10);
  doc.addImage(dataUrl, 'PNG', marginPt, marginPt + titleHeightPt, contentWidthPt, contentHeightPt);
  doc.save(filename);
}
