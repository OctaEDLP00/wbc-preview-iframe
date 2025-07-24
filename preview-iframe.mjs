/**
 * Web Component for displaying content previews with zoom controls
 * @class PreviewIframe
 * @extends {HTMLElement}
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
  #iframe;
  /** @type {HTMLButtonElement | null} */
  #zoomInBtn;
  /** @type {HTMLButtonElement | null} */
  #zoomOutBtn;
  /** @type {HTMLButtonElement | null} */
  #fullscreenBtn;
  /** @type {HTMLDivElement | null} */
  #container;
  /** @type {HTMLDivElement | null} */
  #controls;
  /** @type {HTMLDivElement | null} */
  #zoomDisplay;
  /** @type {IntersectionObserver | null} */
  #observer = null;
  /** @type {boolean} */
  #isContentLoaded = false;
  /** @type {number} */
  #currentZoom = 1.0;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  /**
   * @return {Array<string>}
   */
  static get observedAttributes() {
    return [
      'allow',
      'height',
      'initial-zoom',
      'loading',
      'sandbox',
      'show-controls',
      'show-zoom-level',
      'src',
      'width'
    ];
  }

  /**
   * @return {string}
   */
  static get styles() {
    return /* css */`
      :host {
        color-scheme: light dark;
        --bg-color-light: #f8f9fa;
        --bg-color-dark: #131313;
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
        background: light-dark(var(--bg-color-light), var(--bg-color-dark));
      }

      .controls {
        position: absolute;
        bottom: 10px;
        right: 10px;
        display: flex;
        gap: 5px;
        z-index: 10;

        &.zoom-it, .zoom-out, .fullscreen {
          display: flex;
          align-items: center;
          justify-content: center;
        }
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

      button:hover {
        background: rgba(0, 0, 0, 0.2);
      }

      .zoom-display {
        color: white;
        padding: 0 8px;
        font-size: 12px;
        min-width: 40px;
        text-align: center;
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
        color: #e80e0e;
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
    this.setSandboxAttributes();
    this.#setInitialZoom();
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
     * @type {HTMLIFrameElement | null}
     */
    this.#iframe = this.shadowRoot?.querySelector('iframe');
    /**
     * @type {HTMLButtonElement | null}
     */
    this.#zoomInBtn = this.shadowRoot?.querySelector('.zoom-in');
    /**
     * @type {HTMLButtonElement | null}
     */
    this.#zoomOutBtn = this.shadowRoot?.querySelector('.zoom-out');
    /**
     * @type {HTMLButtonElement | null}
     */
    this.#fullscreenBtn = this.shadowRoot?.querySelector('.fullscreen');
    /**
     * @type {HTMLDivElement | null}
     */
    this.#container = this.shadowRoot?.querySelector('.container');
    /**
     * @type {HTMLDivElement | null}
     */
    this.#controls = this.shadowRoot?.querySelector('.controls');
    /**
     * @type {HTMLDivElement | null}
     */
    this.#zoomDisplay = this.shadowRoot?.querySelector('.zoom-display');

    // Configuración inicial
    if (this.hasAttribute('show-controls')) {
      this.#controls.style.opacity = this.getAttribute('show-controls') === 'true' ? '1' : '0';
    }

    if (this.hasAttribute('show-zoom-level')) {
      this.#zoomDisplay.style.display = this.getAttribute('show-zoom-level') === 'true' ? 'block' : 'none';
    }
  }

  /**
   * @return {void}
   */
  #setupEvents() {
    this.#zoomInBtn.addEventListener('click', () => this.#zoom(1.1));
    this.#zoomOutBtn.addEventListener('click', () => this.#zoom(0.9));
    this.#fullscreenBtn.addEventListener('click', () => this.#toggleFullscreen());

    this.#controls.addEventListener('mouseenter', () => {
      this.#controls.style.opacity = '1';
    });

    this.#controls.addEventListener('mouseleave', () => {
      if (this.getAttribute('show-controls') !== 'true') {
        this.#controls.style.opacity = '0';
      }
    });

    this.#iframe.addEventListener('load', this.#onIframeLoad.bind(this));
    this.#iframe.addEventListener('error', this.#onIframeError.bind(this));
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
            this.#iframe.src = this.#sanitizeSrc(src);
          }
          this.observer?.disconnect();
        }
      });
    });

    this.observer.observe(this);
  }

  /**
   * @param {string} name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   * @return {void}
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'src':
        if (newValue && this.getAttribute('loading') !== 'lazy') {
          this.#showLoader();
          this.#iframe.src = this.#sanitizeSrc(newValue);
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
        if (this.#controls) {
          this.#controls.style.opacity = newValue === 'true' ? '1' : '0';
        }
        break;
      case 'initial-zoom':
        this.#setInitialZoom();
        break;
      case 'show-zoom-level':
        if (this.#zoomDisplay) {
          this.#zoomDisplay.style.display = newValue === 'true' ? 'block' : 'none';
        }
        break;
    }
  }

  /**
   * Set initial zoom level from attribute
   * @return {void}
   */
  #setInitialZoom() {
    const initialZoom = parseFloat(this.getAttribute('initial-zoom')) || 1.0;
    this.#currentZoom = initialZoom;
    this.#applyZoom();
  }

  /**
   * Apply zoom transformation to iframe
   * @return {void}
   */
  #applyZoom() {
    console.log(this.#currentZoom)
    this.#iframe.style.transform = `scale(${this.#currentZoom})`;
    this.#updateZoomDisplay();
  }

  /**
   * Update the zoom level display
   * @return {void}
   */
  #updateZoomDisplay() {
    if (this.#zoomDisplay) {
      this.#zoomDisplay.textContent = `${Math.round(this.#currentZoom * 100)}%`;
    }
  }

  /**
   * Zoom in/out by specified factor
   * @param {number} factor - Zoom factor (e.g., 1.1 for zoom in, 0.9 for zoom out)
   * @return {void}
   */
  #zoom(factor) {
    this.#currentZoom *= factor;
    this.#currentZoom = Math.max(0.1, Math.min(5.0, this.#currentZoom));
    this.#applyZoom();
    this.dispatchEvent(new CustomEvent('zoom-changed', {
      detail: { zoomLevel: this.#currentZoom },
      bubbles: true,
      composed: true
    }));
  }

  /**
   * Toggle fullscreen mode
   * @return {Promise<void>}
   */
  async #toggleFullscreen() {
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
   * Basic URL sanitization
   * @param {string} src
   * @return {string}
   */
  #sanitizeSrc(src) {
    try {
      new URL(src);
      return src;
    } catch {
      return 'about:blank';
    }
  }

  /**
   * Show loading spinner
   * @return {void}
   */
  #showLoader() {
    const loader = this.shadowRoot.querySelector('.loader');
    if (loader) loader.style.display = 'block';
  }

  /**
   * Hide loading spinner
   * @return {void}
   */
  #hideLoader() {
    const loader = this.shadowRoot.querySelector('.loader');
    if (loader) loader.style.display = 'none';
  }

  /**
   * Set iframe content directly
   * @param {string} content
   * @return {void}
   */
  setContent(content) {
    this.#showLoader();
    if (this.#iframe == null) return
    this.#iframe.srcdoc = content;
  }

  /**
   * Set sandbox attributes from element attributes
   * @return {void}
   */
  setSandboxAttributes() {
    const sandbox = this.getAttribute('sandbox');
    const allow = this.getAttribute('allow');

    if (sandbox && this.#iframe) {
      this.#iframe.sandbox.value = sandbox;
    }

    if (allow && this.#iframe) {
      this.#iframe.allow = allow;
    }
  }

  /**
   * Render component HTML
   * @return {void}
   */
  render() {
    if (this.shadowRoot == null) return
    this.shadowRoot.innerHTML = `
      <style>${PreviewIframe.styles}</style>
      <div class="container">
        <div class="loader" style="display: none;"></div>
        <div class="error-message" style="display: none;"></div>
        <iframe loading="${this.getAttribute('loading') || 'lazy'}"></iframe>
        <div class="controls">
          <div class="zoom-display" style="display: ${this.hasAttribute('show-zoom-level') ? 'block' : 'none'}">100%</div>
          <button class='zoom-in' title="Zoom In">
            <svg width='32' height='32'>
              <use href='#maximize'></use>
            </svg>
          </button>
          <button class='zoom-out' title="Zoom Out">
            <svg width='32' height='32' viewBox='0 0 24 24'>
              <use href='#minimize'></use>
            </svg>
          </button>
          <button class='fullscreen' title="Fullscreen">
            <svg width='32' height='32' viewBox='0 0 24 24'>
              <use href='#fullscreen'></use>
            </svg>
          </button>
        </div>
      </div>
      <div hidden class='svg-sprite-container'>
        <svg xmlns='http://www.w3.org/2000/svg'>
          <!-- Maximize -->
          <symbol
            id='maximize'
            viewBox='0 0 24 24'
          >
            <path
              fill='none'
              stroke='currentColor'
              stroke-linecap='round'
              stroke-linejoin='round'
              stroke-width='1.5'
              d='M3 10a7 7 0 1 0 14 0a7 7 0 1 0-14 0m4 0h6m-3-3v6m11 8l-6-6'
            />
          </symbol>
          <symbol
            id='maximize-2'
            viewBox='0 0 24 24'
          >
            <path
              fill='none'
              stroke='currentColor'
              stroke-linecap='round'
              stroke-linejoin='round'
              stroke-width='1.5'
              d='M5 12h14m-7-7v14'
            />
          </symbol>
          <!-- Minimize -->
          <symbol
            id='minimize'
            viewBox='0 0 24 24'
          >
            <path
              fill='none'
              stroke='currentColor'
              stroke-linecap='round'
              stroke-linejoin='round'
              stroke-width='1.5'
              d='M3 10a7 7 0 1 0 14 0a7 7 0 1 0-14 0m4 0h6m8 11l-6-6'
            />
          </symbol>
          <symbol
            id='minimize-2'
            viewBox='0 0 24 24'
          >
            <path
              fill='none'
              stroke='currentColor'
              stroke-linecap='round'
              stroke-linejoin='round'
              stroke-width='1.5'
              d='M5 12h14'
            />
          </symbol>
          <!-- Fullscreen -->
          <symbol
            id='fullscreen'
            viewBox='0 0 24 24'
          >
            <path

              fill='none'
              stroke='currentColor'
              stroke-linecap='round'
              stroke-linejoin='round'
              stroke-width='1.5'
              d='M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2m8-16h2a2 2 0 0 1 2 2v2m-4 12h2a2 2 0 0 0 2-2v-2'
            />
          </symbol>
          <symbol
            id='fullscreen-2'
            viewBox='0 0 24 24'
          >
            <path
              fill='none'
              stroke='currentColor'
              stroke-linecap='round'
              stroke-linejoin='round'
              stroke-width='1.5'
              d='M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3'
            />
          </symbol>
        </svg>
      </div>
    `;
  }
}

customElements.define('preview-iframe', PreviewIframe)
