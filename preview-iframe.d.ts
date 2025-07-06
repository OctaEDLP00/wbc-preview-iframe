export interface PreviewIframeOptions {
  sandbox?: string;
  allow?: string;
  loading?: 'eager' | 'lazy';
  showControls?: boolean;
}

export declare class PreviewIframe extends HTMLElement {
  static get observedAttributes(): string[];
  private iframe: HTMLIFrameElement;
  private zoomInBtn: HTMLButtonElement;
  private zoomOutBtn: HTMLButtonElement;
  private fullscreenBtn: HTMLButtonElement;
  private container: HTMLDivElement;
  private controls: HTMLDivElement;
  private observer: IntersectionObserver | null;
  
  constructor();
  connectedCallback(): void;
  disconnectedCallback(): void;
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void;
  private render(): void;
  private setupIntersectionObserver(): void;
  private setupEvents(): void;
  private zoom(factor: number): void;
  private toggleFullscreen(): Promise<void>;
  private sanitizeSrc(src: string): string;
  private showLoader(): void;
  private hideLoader(): void;
  private setContent(content: string): void;
  private setSandboxAttributes(): void;
}