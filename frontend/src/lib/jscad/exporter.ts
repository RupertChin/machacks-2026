import type { JscadEngine } from "./engine";

export async function exportSTL(engine: JscadEngine): Promise<void> {
  const data = await engine.exportAll();
  const blob = new Blob([data], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gesturecad-export-${Date.now()}.stl`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
