/**
 * Web Component for displaying content previews with zoom controls
 * @class PreviewIframe
 * @extends {HTMLElement}
 * @example A simple usage
 * ```html
 * <preview-iframe
 *   src="https://github.com/OctaEDLP00/wbc-preview-iframe",
 *   width="100%"
 *   height="800"
 *   style="--bg-color-dark: #1e1e1e;"
 * ></preview-iframe>
 * ```
 */
export class PreviewIframe extends HTMLElement {
  private iframe: HTMLIFrameElement | null | undefined;
  private zoomInBtn: HTMLButtonElement | null | undefined;
  private zoomOutBtn: HTMLButtonElement | null | undefined;
  private fullscreenBtn: HTMLButtonElement | null | undefined;
  private container: HTMLDivElement | null | undefined;
  private controls: HTMLDivElement | null | undefined;
  private observer: IntersectionObserver | null = null;
  private isContentLoaded = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  static get observedAttributes(): string[] {
    return [
      'src',
      'width',
      'height',
      'sandbox',
      'allow',
      'loading',
      'show-controls'
    ];
  }

  static get styles(): string {
    return /* css */`
      :host {
        display: block;
        border: 1px solid #ddd;
        border-radius: 4px;
        overflow: hidden;
        position: relative;
      }
      .container {
        position: relative;
        width: 100%;
        height: 100%;
      }
      iframe {
        width: 100%;
        height: 100%;
        border: none;
        background: white;
      }
      .controls {
        position: absolute;
        bottom: 10px;
        right: 10px;
        display: flex;
        gap: 5px;
        opacity: 0;
        transition: opacity 0.3s;
        z-index: 10;
      }
      :host(:hover) .controls {
        opacity: 1;
      }
      button {
        background: rgba(0,0,0,0.7);
        color: white;
        border: none;
        border-radius: 3px;
        padding: 5px 10px;
        cursor: pointer;
        font-size: 14px;
      }
      .loader {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        animation: spin 2s linear infinite;
        z-index: 5;
      }
      @keyframes spin {
        0% { transform: translate(-50%, -50%) rotate(0deg); }
        100% { transform: translate(-50%, -50%) rotate(360deg); }
      }
      .error-message {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #d9534f;
        text-align: center;
        z-index: 5;
      }
    `;
  }

  connectedCallback(): void {
    this.setupElements();
    this.setupEvents();
    this.setupIntersectionObserver();
    this.setSandboxAttributes();
  }

  disconnectedCallback(): void {
    if (this.observer == null) return
    this.observer.disconnect();
    if (this.iframe == null) return
    this.iframe.removeEventListener('load', this.onIframeLoad);
    this.iframe.removeEventListener('error', this.onIframeError);
  }

  private setupElements(): void {
    this.iframe = this.shadowRoot?.querySelector('iframe') as HTMLIFrameElement;
    this.zoomInBtn = this.shadowRoot?.querySelector('.zoom-in') as HTMLButtonElement;
    this.zoomOutBtn = this.shadowRoot?.querySelector('.zoom-out') as HTMLButtonElement;
    this.fullscreenBtn = this.shadowRoot?.querySelector('.fullscreen') as HTMLButtonElement;
    this.container = this.shadowRoot?.querySelector('.container') as HTMLDivElement;
    this.controls = this.shadowRoot?.querySelector('.controls') as HTMLDivElement;

    // Configuración inicial
    if (this.hasAttribute('show-controls')) {
      this.controls.style.opacity = this.getAttribute('show-controls') === 'true' ? '1' : '0';
    }
  }

  render(): void {
    if (this.shadowRoot == null) return
    this.shadowRoot.innerHTML = `
      <style>${PreviewIframe.styles}</style>
      <div class="container">
        <div class="loader" style="display: none;"></div>
        <div class="error-message" style="display: none;"></div>
        <iframe loading="${this.getAttribute('loading') || 'lazy'}"></iframe>
        <div class="controls">
          <button class="zoom-in">+</button>
          <button class="zoom-out">-</button>
          <button class="fullscreen">⛶</button>
        </div>
      </div>
    `;
  }

  private setupEvents(): void {
    if (this.zoomInBtn == null) return
    this.zoomInBtn.addEventListener('click', () => this.zoom(1.1));
    if (this.zoomOutBtn == null) return
    this.zoomOutBtn.addEventListener('click', () => this.zoom(0.9));
    if (this.fullscreenBtn == null) return
    this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

    if (this.iframe == null) return
    this.iframe.addEventListener('load', this.onIframeLoad.bind(this));
    this.iframe.addEventListener('error', this.onIframeError.bind(this));
  }

  private onIframeLoad(): void {
    this.isContentLoaded = true;
    this.hideLoader();
    this.dispatchEvent(new CustomEvent('preview-loaded', { bubbles: true, composed: true }));
  }

  private onIframeError(): void {
    const errorMessage = this.shadowRoot?.querySelector('.error-message') as HTMLDivElement;
    errorMessage.textContent = 'Error loading content';
    errorMessage.style.display = 'block';
    this.hideLoader();
    this.dispatchEvent(new CustomEvent('preview-error', { bubbles: true, composed: true }));
  }

  private setupIntersectionObserver(): void {
    if (this.getAttribute('loading') !== 'lazy') return;

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.isContentLoaded) {
          const src = this.getAttribute('src');
          if (src) {
            this.showLoader();
            if (this.iframe == null) return
            this.iframe.src = this.sanitizeSrc(src);
          }
          this.observer?.disconnect();
        }
      });
    });

    this.observer.observe(this);
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;

    switch (name) {
      case 'src':
        if (newValue && this.getAttribute('loading') !== 'lazy') {
          this.showLoader();
          if (this.iframe == null) return
          this.iframe.src = this.sanitizeSrc(newValue);
        }
        break;
      case 'width':
      case 'height':
        this.style[name] = newValue?.endsWith('px') ? newValue : `${newValue}px`;
        break;
      case 'sandbox':
      case 'allow':
        this.setSandboxAttributes();
        break;
      case 'show-controls':
        if (this.controls) {
          this.controls.style.opacity = newValue === 'true' ? '1' : '0';
        }
        break;
    }
  }

  private zoom(factor: number): void {
    if (this.iframe == null) return
    const currentZoom = parseFloat(this.iframe.style.zoom) || 1;
    this.iframe.style.zoom = `${currentZoom * factor}`;
  }

  private async toggleFullscreen(): Promise<void> {
    try {
      if (!document.fullscreenElement) {
        await this.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }

  private sanitizeSrc(src: string): string {
    // Implementación básica de sanitización
    // En producción, usa una librería como DOMPurify
    try {
      new URL(src);
      return src;
    } catch {
      return '';
    }
  }

  private showLoader(): void {
    const loader = this.shadowRoot?.querySelector('.loader') as HTMLDivElement;
    loader.style.display = 'block';
  }

  private hideLoader(): void {
    const loader = this.shadowRoot?.querySelector('.loader') as HTMLDivElement;
    loader.style.display = 'none';
  }

  public setContent(content: string): void {
    this.showLoader();
    if (this.iframe == null) return
    this.iframe.srcdoc = content;
  }

  private setSandboxAttributes(): void {
    const sandbox = this.getAttribute('sandbox');
    const allow = this.getAttribute('allow');

    if (this.iframe == null) return

    if (sandbox) {
      this.iframe.sandbox.value = sandbox;
    }

    if (allow) {
      this.iframe.allow = allow;
    }
  }
}

customElements.define('preview-iframe', PreviewIframe);
