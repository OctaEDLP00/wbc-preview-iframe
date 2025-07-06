/**
 * 
 * @class PreviewIframe
 * @extends HTMLElement
 * @example A simple usage
 * ```html
 * <preview-iframe
 *   src="https://ejemplo.com",
 *   width="100%"
 *   height="800"
 *   style="--background-color: #1e1e1e;"
 * ></preview-iframe>
 * ```
 */
export class PreviewIframe extends HTMLElement {
  /** @type {HTMLIFrameElement | null} */
  #iframe
  /** @type {HTMLButtonElement | null} */
  #zoomInBtn
  /** @type {HTMLButtonElement | null} */
  #zoomOutBtn
  /** @type {HTMLButtonElement | null} */
  #fullscreenBtn
  /** @type {HTMLDivElement | null} */
  #container
  /** @type {HTMLDivElement | null} */
  #controls
  /** @type {IntersectionObserver | null} */
  #observer = null;
  /** @type {boolean} */
  #isContentLoaded = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.#render();
  }

  /**
   * @return {Array<string>}
   */
  static get observedAttributes() {
    return ['src', 'width', 'height', 'sandbox', 'allow', 'loading', 'show-controls'];
  }

  /**
   * @return {string}
   */
  static get styles() {
    return `
      :host {
        --background-color: var(--bg-color);
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
        background: var(--background-color, white);
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

        &.zoom-it, .zoom-out, .fullscreen {
          display: flex;
          align-items: center;
          justify-content: center;
        }
      }

      :host(:hover) .controls:hover {
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

      @media (width < 300px) {
        .controls {
          flex-direction: column;
        }
      }
    `;
  }

  /**
   * @return {void}
   */
  connectedCallback() {
    this.#setupElements();
    this.#setupEvents();
    this.#setupIntersectionObserver();
    this.#setSandboxAttributes();
  }

  /**
   * @return {void}
   */
  disconnectedCallback() {
    this.observer?.disconnect();
    this.iframe.removeEventListener('load', this.#onIframeLoad);
    this.iframe.removeEventListener('error', this.#onIframeError);
  }

  /**
   * @return {void}
   */
  #setupElements() {
    /**
     * @type {HTMLIFrameElement}
     */
    this.iframe = this.shadowRoot?.querySelector('iframe');
    /**
     * @type {HTMLButtonElement}
     */
    this.zoomInBtn = this.shadowRoot?.querySelector('.zoom-in');
    /**
     * @type {HTMLButtonElement}
     */
    this.zoomOutBtn = this.shadowRoot?.querySelector('.zoom-out');
    /**
     * @type {HTMLButtonElement}
     */
    this.fullscreenBtn = this.shadowRoot?.querySelector('.fullscreen');
    /**
     * @type {HTMLDivElement}
     */
    this.container = this.shadowRoot?.querySelector('.container');
    /**
     * @type {HTMLDivElement}
     */
    this.controls = this.shadowRoot?.querySelector('.controls');

    // Configuración inicial
    if (this.hasAttribute('show-controls')) {
      this.controls.style.opacity = this.getAttribute('show-controls') === 'true' ? '1' : '0';
    }
  }

  /**
   * @return {void}
   */
  #setupEvents() {
    this.zoomInBtn.addEventListener('click', () => this.#zoom(1.1));
    this.zoomOutBtn.addEventListener('click', () => this.#zoom(0.9));
    this.fullscreenBtn.addEventListener('click', () => this.#toggleFullscreen());

    this.iframe.addEventListener('load', this.#onIframeLoad.bind(this));
    this.iframe.addEventListener('error', this.#onIframeError.bind(this));
  }

  /**
   * @return {void}
   */
  #onIframeLoad() {
    this.isContentLoaded = true;
    this.#hideLoader();
    this.dispatchEvent(new CustomEvent('preview-loaded', { bubbles: true, composed: true }));
  }

  /**
   * @return {void}
   */
  #onIframeError() {
    /**
     * @type {HTMLDivElement}
     */
    const errorMessage = this.shadowRoot.querySelector('.error-message');
    errorMessage.textContent = 'Error loading content';
    errorMessage.style.display = 'block';
    this.#hideLoader();
    this.dispatchEvent(new CustomEvent('preview-error', { bubbles: true, composed: true }));
  }

  /**
   * @return {void}
   */
  #setupIntersectionObserver() {
    if (this.getAttribute('loading') !== 'lazy') return;

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.isContentLoaded) {
          const src = this.getAttribute('src');
          if (src) {
            this.#showLoader();
            this.iframe.src = this.#sanitizeSrc(src);
          }
          this.observer?.disconnect();
        }
      });
    });

    this.observer.observe(this);
  }

  /**
   * @param {string}
   * @param {string | null}
   * @param {string | null}
   * @return {void}
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'src':
        if (newValue && this.getAttribute('loading') !== 'lazy') {
          this.showLoader();
          this.iframe.src = this.#sanitizeSrc(newValue);
        }
        break;
      case 'width':
      case 'height':
        this.style[name] = newValue?.endsWith('px') ? newValue : `${newValue}px`;
        break;
      case 'sandbox':
      case 'allow':
        this.#setSandboxAttributes();
        break;
      case 'show-controls':
        if (this.controls) {
          this.controls.style.opacity = newValue === 'true' ? '1' : '0';
        }
        break;
    }
  }

  /**
   * @param {number} factor
   * @return {void}
   */
  #zoom(factor) {
    const currentZoom = parseFloat(this.iframe.style.zoom) || 1;
    this.iframe.style.zoom = `${currentZoom * factor}`;
  }

  /**
   * @return {Promise<void>}
   */
  async #toggleFullscreen()  {
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

  /**
   * @param {string} src
   * @return {string}
   */
  #sanitizeSrc(src) {
    // Implementación básica de sanitización
    // En producción, usa una librería como DOMPurify
    try {
      new URL(src);
      return src;
    } catch {
      return '';
    }
  }

  /**
   * @return {void}
   */
  #showLoader() {
    /**
     * @type {HTMLDivElement}
     */
    const loader = this.shadowRoot?.querySelector('.loader');
    loader.style.display = 'block';
  }

  /**
   * @return {void}
   */
  #hideLoader() {
    /**
     * @type {HTMLDivElement}
     */
    const loader = this.shadowRoot?.querySelector('.loader');
    loader.style.display = 'none';
  }

  /**
   * @param {string} content
   * @return {void}
   */
  setContent(content) {
    this.#showLoader();
    this.iframe.srcdoc = content;
  }

  /**
   * @return {void}
   */
  #setSandboxAttributes() {
    const sandbox = this.getAttribute('sandbox');
    const allow = this.getAttribute('allow');

    if (sandbox) {
      this.iframe.sandbox.value = sandbox;
    }

    if (allow) {
      this.iframe.allow = allow;
    }
  }

  /**
   * @return {void}
   */
  #render() {
    this.shadowRoot.innerHTML = `
      <style>${PreviewIframe.styles}</style>
      <div class="container">
        <div class="loader" style="display: none;"></div>
        <div class="error-message" style="display: none;"></div>
        <iframe loading="${this.getAttribute('loading') || 'lazy'}"></iframe>
        <div class="controls">
          <button class="zoom-in">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0-14 0m4 0h6m-3-3v6m11 8l-6-6"/></svg>
      
            <!-- 
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14m-7-7v14"/></svg>
            -->
          </button>
          <button class="zoom-out">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 10a7 7 0 1 0 14 0a7 7 0 1 0-14 0m4 0h6m8 11l-6-6"/></svg>  

            <!-- 
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 12h14"/></svg>
            -->
          </button>
          <button class="fullscreen">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2m8-16h2a2 2 0 0 1 2 2v2m-4 12h2a2 2 0 0 0 2-2v-2"/></svg>

            <!-- 
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3"/></svg>
            -->
          </button>
        </div>
      </div>
    `;
  }
}

customElements.define('preview-iframe', PreviewIframe);
