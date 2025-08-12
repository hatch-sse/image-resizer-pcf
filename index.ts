import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class ImageResizerPCF implements ComponentFramework.StandardControl<IInputs, IOutputs> {

  // Canvas + DOM
  private container!: HTMLDivElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private img!: HTMLImageElement;
  private fileInput!: HTMLInputElement;
  private presetSelect!: HTMLSelectElement;
  private customW!: HTMLInputElement;
  private customH!: HTMLInputElement;
  private exportBtn!: HTMLButtonElement;

  // State
  private imgLoaded: boolean = false;
  private targetW: number = 1400;
  private targetH: number = 700;
  private scale: number = 1;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private dragging: boolean = false;
  private lastX: number = 0;
  private lastY: number = 0;

  // Outputs
  private outDataUri: string = "";
  private outWidth: number = 0;
  private outHeight: number = 0;
  private outFileName: string = "";

  // Framework callback
  private notifyOutputChanged!: () => void;

  constructor() {}

  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    state: ComponentFramework.Dictionary,
    container: HTMLDivElement
  ): void {
    this.notifyOutputChanged = notifyOutputChanged;
    this.container = container;

    // --- Controls ---
    this.fileInput = document.createElement("input");
    this.fileInput.type = "file";
    this.fileInput.accept = "image/*";
    this.fileInput.addEventListener("change", (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        this.img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

    this.presetSelect = document.createElement("select");
    [
      "Listing Content (250x400)",
      "Header (1400x700)",
      "Custom"
    ].forEach(label => {
      const opt = document.createElement("option");
      opt.textContent = label;
      this.presetSelect.appendChild(opt);
    });

    this.customW = document.createElement("input");
    this.customW.type = "number";
    this.customW.placeholder = "Width";

    this.customH = document.createElement("input");
    this.customH.type = "number";
    this.customH.placeholder = "Height";

    this.canvas = document.createElement("canvas");
    this.canvas.width = 500;
    this.canvas.height = 300;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    this.ctx = ctx;

    this.exportBtn = document.createElement("button");
    this.exportBtn.textContent = "Export to App";
    this.exportBtn.addEventListener("click", () => this.exportImage());

    // Layout
    this.container.appendChild(this.fileInput);
    this.container.appendChild(document.createElement("br"));
    this.container.appendChild(this.presetSelect);
    this.container.appendChild(this.customW);
    this.container.appendChild(this.customH);
    this.container.appendChild(this.canvas);
    this.container.appendChild(this.exportBtn);

    // Image
    this.img = new Image();
    this.img.onload = () => {
      this.imgLoaded = true;
      this.scale = Math.min(this.canvas.width / this.img.width, this.canvas.height / this.img.height);
      this.offsetX = 0;
      this.offsetY = 0;
      this.draw();
    };

    // Preset handlers
    this.presetSelect.onchange = () => {
      const v = this.presetSelect.value;
      if (v.startsWith("Listing")) { this.targetW = 250; this.targetH = 400; }
      else if (v.startsWith("Header")) { this.targetW = 1400; this.targetH = 700; }
      else {
        this.targetW = parseInt(this.customW.value || "800", 10);
        this.targetH = parseInt(this.customH.value || "600", 10);
      }
      this.draw();
    };
    this.customW.oninput = () => {
      if (this.presetSelect.value === "Custom") {
        this.targetW = parseInt(this.customW.value || "800", 10);
        this.draw();
      }
    };
    this.customH.oninput = () => {
      if (this.presetSelect.value === "Custom") {
        this.targetH = parseInt(this.customH.value || "600", 10);
        this.draw();
      }
    };

    // Canvas interactions
    this.canvas.addEventListener("mousedown", (e) => {
      this.dragging = true;
      this.lastX = e.offsetX;
      this.lastY = e.offsetY;
    });
    const endDrag = () => { this.dragging = false; };
    this.canvas.addEventListener("mouseup", endDrag);
    this.canvas.addEventListener("mouseleave", endDrag);
    this.canvas.addEventListener("mousemove", (e) => {
      if (!this.dragging) return;
      this.offsetX += e.offsetX - this.lastX;
      this.offsetY += e.offsetY - this.lastY;
      this.lastX = e.offsetX;
      this.lastY = e.offsetY;
      this.draw();
    });
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const scaleAmount = e.deltaY < 0 ? 1.05 : 0.95;
      this.scale *= scaleAmount;
      this.draw();
    }, { passive: false });
  }

  private draw(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.imgLoaded) return;

    this.ctx.save();
    this.ctx.translate(this.canvas.width / 2 + this.offsetX, this.canvas.height / 2 + this.offsetY);
    this.ctx.scale(this.scale, this.scale);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    this.ctx.drawImage(this.img, -this.img.width / 2, -this.img.height / 2);
    this.ctx.restore();

    // Draw an outline to indicate the target aspect ratio (optional)
    this.ctx.save();
    this.ctx.strokeStyle = "#888";
    this.ctx.lineWidth = 1;
    // Fit a rectangle with the target aspect into the preview canvas to show crop bounds
    const r = this.fitRect(this.canvas.width, this.canvas.height, this.targetW, this.targetH);
    this.ctx.strokeRect((this.canvas.width - r.w) / 2, (this.canvas.height - r.h) / 2, r.w, r.h);
    this.ctx.restore();
  }

  private fitRect(containerW: number, containerH: number, targetW: number, targetH: number) {
    const targetAR = targetW / targetH;
    const containerAR = containerW / containerH;
    let w: number, h: number;
    if (containerAR > targetAR) { // limited by height
      h = containerH;
      w = h * targetAR;
    } else {
      w = containerW;
      h = w / targetAR;
    }
    return { w, h };
  }

  private exportImage(): void {
    if (!this.imgLoaded) return;

    // Render to export-size offscreen canvas, respecting current pan/zoom
    const off = document.createElement("canvas");
    off.width = this.targetW;
    off.height = this.targetH;
    const octx = off.getContext("2d")!;
    octx.fillStyle = "#ffffff"; // white background for JPEG
    octx.fillRect(0, 0, off.width, off.height);

    // Map preview transform → export size
    const scaleRatio = off.width / this.canvas.width;
    octx.save();
    octx.translate(off.width / 2 + this.offsetX * scaleRatio, off.height / 2 + this.offsetY * scaleRatio);
    octx.scale(this.scale * scaleRatio, this.scale * scaleRatio);
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = "high";
    octx.drawImage(this.img, -this.img.width / 2, -this.img.height / 2);
    octx.restore();

    // JPEG export
    this.outDataUri = off.toDataURL("image/jpeg", 0.92);
    this.outWidth = this.targetW;
    this.outHeight = this.targetH;
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    this.outFileName = `resized-${this.outWidth}x${this.outHeight}-${ts}.jpg`;
    this.notifyOutputChanged();
  }

  public updateView(context: ComponentFramework.Context<IInputs>): void {
    // No bound inputs to react to; rendering is user-driven
  }

  public getOutputs(): IOutputs {
    return {
      DataUri: this.outDataUri,
      OutWidth: this.outWidth,
      OutHeight: this.outHeight,
      FileName: this.outFileName,
    };
  }

  public destroy(): void {
    // Cleanup if needed
  }
}
