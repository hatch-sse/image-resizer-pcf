import {IInputs, IOutputs} from "./generated/ManifestTypes";

export class ImageResizerPCF implements ComponentFramework.StandardControl<IInputs, IOutputs> {

  private container: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private img: HTMLImageElement;
  private imgLoaded: boolean = false;
  private targetW: number = 1400;
  private targetH: number = 700;
  private scale: number = 1;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private dragging: boolean = false;
  private lastX: number = 0;
  private lastY: number = 0;

  private outDataUri: string = "";
  private outWidth: number = 0;
  private outHeight: number = 0;
  private outFileName: string = "";

  private notifyOutputChanged: () => void;

  constructor() {}

  public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement) {
    this.notifyOutputChanged = notifyOutputChanged;
    this.container = container;

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = ev => {
          this.img.src = ev.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
    };
    container.appendChild(fileInput);

    const presetSelect = document.createElement("select");
    ["Listing Content (250x400)", "Header (1400x700)", "Custom"].forEach(p => {
      const opt = document.createElement("option");
      opt.textContent = p;
      presetSelect.appendChild(opt);
    });
    container.appendChild(presetSelect);

    const customW = document.createElement("input");
    customW.type = "number";
    customW.placeholder = "Width";
    const customH = document.createElement("input");
    customH.type = "number";
    customH.placeholder = "Height";
    container.appendChild(customW);
    container.appendChild(customH);

    presetSelect.onchange = () => {
      if (presetSelect.value.startsWith("Listing")) {
        this.targetW = 250; this.targetH = 400;
      } else if (presetSelect.value.startsWith("Header")) {
        this.targetW = 1400; this.targetH = 700;
      } else {
        this.targetW = parseInt(customW.value) || 800;
        this.targetH = parseInt(customH.value) || 600;
      }
    };

    customW.oninput = () => {
      if (presetSelect.value === "Custom") {
        this.targetW = parseInt(customW.value) || 800;
      }
    };
    customH.oninput = () => {
      if (presetSelect.value === "Custom") {
        this.targetH = parseInt(customH.value) || 600;
      }
    };

    this.canvas = document.createElement("canvas");
    this.canvas.width = 500; this.canvas.height = 300;
    this.ctx = this.canvas.getContext("2d")!;
    container.appendChild(this.canvas);

    this.img = new Image();
    this.img.onload = () => {
      this.imgLoaded = true;
      this.scale = Math.min(this.canvas.width / this.img.width, this.canvas.height / this.img.height);
      this.offsetX = 0; this.offsetY = 0;
      this.draw();
    };

    this.canvas.addEventListener("mousedown", e => {
      this.dragging = true;
      this.lastX = e.offsetX; this.lastY = e.offsetY;
    });
    this.canvas.addEventListener("mouseup", () => this.dragging = false);
    this.canvas.addEventListener("mouseleave", () => this.dragging = false);
    this.canvas.addEventListener("mousemove", e => {
      if (this.dragging) {
        this.offsetX += e.offsetX - this.lastX;
        this.offsetY += e.offsetY - this.lastY;
        this.lastX = e.offsetX; this.lastY = e.offsetY;
        this.draw();
      }
    });

    this.canvas.addEventListener("wheel", e => {
      e.preventDefault();
      const scaleAmount = e.deltaY < 0 ? 1.05 : 0.95;
      this.scale *= scaleAmount;
      this.draw();
    });

    const exportBtn = document.createElement("button");
    exportBtn.textContent = "Export to App";
    exportBtn.onclick = () => this.exportImage();
    container.appendChild(exportBtn);
  }

  private draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.imgLoaded) return;
    this.ctx.save();
    this.ctx.translate(this.canvas.width / 2 + this.offsetX, this.canvas.height / 2 + this.offsetY);
    this.ctx.scale(this.scale, this.scale);
    this.ctx.drawImage(this.img, -this.img.width / 2, -this.img.height / 2);
    this.ctx.restore();
  }

  private exportImage() {
    if (!this.imgLoaded) return;

    const off = document.createElement("canvas");
    off.width = this.targetW;
    off.height = this.targetH;
    const octx = off.getContext("2d")!;
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, off.width, off.height);

    const scaleRatio = off.width / this.canvas.width;
    octx.save();
    octx.translate(off.width/2 + this.offsetX * scaleRatio, off.height/2 + this.offsetY * scaleRatio);
    octx.scale(this.scale * scaleRatio, this.scale * scaleRatio);
    octx.drawImage(this.img, -this.img.width/2, -this.img.height/2);
    octx.restore();

    this.outDataUri = off.toDataURL("image/jpeg", 0.92);
    this.outWidth = this.targetW;
    this.outHeight = this.targetH;
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    this.outFileName = `resized-${this.outWidth}x${this.outHeight}-${ts}.jpg`;
    this.notifyOutputChanged();
  }

  public updateView() {}
  public getOutputs(): IOutputs {
    return {
      DataUri: this.outDataUri,
      OutWidth: this.outWidth,
      OutHeight: this.outHeight,
      FileName: this.outFileName
    };
  }
  public destroy() {}
}
