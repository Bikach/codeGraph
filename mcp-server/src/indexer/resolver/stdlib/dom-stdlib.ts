/**
 * DOM (Browser) Standard Library symbols for resolution.
 *
 * These are the built-in browser APIs and global objects available
 * in browser environments without explicit imports.
 *
 * Reference: https://developer.mozilla.org/en-US/docs/Web/API
 */

import type { FunctionSymbol, ClassSymbol, Symbol } from '../types.js';
import type { StdlibProvider } from './stdlib-provider.js';
import type { SupportedLanguage } from '../../types.js';

// Stdlib location placeholder
const STDLIB_LOC = {
  filePath: '<dom-stdlib>',
  startLine: 0,
  startColumn: 0,
  endLine: 0,
  endColumn: 0,
};

// Helper to create a function symbol
function fn(
  name: string,
  fqn: string,
  opts: {
    parameterTypes?: string[];
    returnType?: string;
    declaringTypeFqn?: string;
  } = {}
): FunctionSymbol {
  return {
    name,
    fqn,
    kind: 'function',
    filePath: '<dom-stdlib>',
    location: STDLIB_LOC,
    packageName: 'dom',
    parameterTypes: opts.parameterTypes || [],
    returnType: opts.returnType,
    declaringTypeFqn: opts.declaringTypeFqn,
    isExtension: false,
  };
}

// Helper to create a class symbol
function cls(
  name: string,
  fqn: string,
  kind: 'class' | 'interface' | 'object' | 'enum' = 'class',
  opts: {
    superClass?: string;
    interfaces?: string[];
    isAbstract?: boolean;
  } = {}
): ClassSymbol {
  return {
    name,
    fqn,
    kind,
    filePath: '<dom-stdlib>',
    location: STDLIB_LOC,
    packageName: 'dom',
    superClass: opts.superClass,
    interfaces: opts.interfaces || [],
    isAbstract: opts.isAbstract,
  };
}

// =============================================================================
// DOM Global Objects and Classes
// =============================================================================

export const DOM_STDLIB_CLASSES: ReadonlyMap<string, ClassSymbol> = new Map([
  // Global objects
  ['window', cls('window', 'Window', 'object')],
  ['document', cls('document', 'Document', 'object')],
  ['navigator', cls('navigator', 'Navigator', 'object')],
  ['location', cls('location', 'Location', 'object')],
  ['history', cls('history', 'History', 'object')],
  ['screen', cls('screen', 'Screen', 'object')],
  ['localStorage', cls('localStorage', 'Storage', 'object')],
  ['sessionStorage', cls('sessionStorage', 'Storage', 'object')],
  ['console', cls('console', 'Console', 'object')],
  ['performance', cls('performance', 'Performance', 'object')],
  ['crypto', cls('crypto', 'Crypto', 'object')],

  // Window interface
  ['Window', cls('Window', 'Window', 'interface')],
  ['Document', cls('Document', 'Document', 'interface')],
  ['Navigator', cls('Navigator', 'Navigator', 'interface')],
  ['Location', cls('Location', 'Location', 'interface')],
  ['History', cls('History', 'History', 'interface')],
  ['Storage', cls('Storage', 'Storage', 'interface')],
  ['Performance', cls('Performance', 'Performance', 'interface')],
  ['Crypto', cls('Crypto', 'Crypto', 'interface')],
  ['SubtleCrypto', cls('SubtleCrypto', 'SubtleCrypto', 'interface')],

  // DOM Elements
  ['Element', cls('Element', 'Element', 'class')],
  ['Node', cls('Node', 'Node', 'class')],
  ['HTMLElement', cls('HTMLElement', 'HTMLElement', 'class', { superClass: 'Element' })],
  ['HTMLDivElement', cls('HTMLDivElement', 'HTMLDivElement', 'class', { superClass: 'HTMLElement' })],
  ['HTMLSpanElement', cls('HTMLSpanElement', 'HTMLSpanElement', 'class', { superClass: 'HTMLElement' })],
  ['HTMLParagraphElement', cls('HTMLParagraphElement', 'HTMLParagraphElement', 'class', { superClass: 'HTMLElement' })],
  ['HTMLHeadingElement', cls('HTMLHeadingElement', 'HTMLHeadingElement', 'class', { superClass: 'HTMLElement' })],
  ['HTMLAnchorElement', cls('HTMLAnchorElement', 'HTMLAnchorElement', 'class', { superClass: 'HTMLElement' })],
  ['HTMLImageElement', cls('HTMLImageElement', 'HTMLImageElement', 'class', { superClass: 'HTMLElement' })],
  ['HTMLInputElement', cls('HTMLInputElement', 'HTMLInputElement', 'class', { superClass: 'HTMLElement' })],
  ['HTMLButtonElement', cls('HTMLButtonElement', 'HTMLButtonElement', 'class', { superClass: 'HTMLElement' })],
  ['HTMLFormElement', cls('HTMLFormElement', 'HTMLFormElement', 'class', { superClass: 'HTMLElement' })],
  ['HTMLSelectElement', cls('HTMLSelectElement', 'HTMLSelectElement', 'class', { superClass: 'HTMLElement' })],
  ['HTMLTextAreaElement', cls('HTMLTextAreaElement', 'HTMLTextAreaElement', 'class', { superClass: 'HTMLElement' })],
  ['HTMLTableElement', cls('HTMLTableElement', 'HTMLTableElement', 'class', { superClass: 'HTMLElement' })],
  ['HTMLCanvasElement', cls('HTMLCanvasElement', 'HTMLCanvasElement', 'class', { superClass: 'HTMLElement' })],
  ['HTMLVideoElement', cls('HTMLVideoElement', 'HTMLVideoElement', 'class', { superClass: 'HTMLMediaElement' })],
  ['HTMLAudioElement', cls('HTMLAudioElement', 'HTMLAudioElement', 'class', { superClass: 'HTMLMediaElement' })],
  ['HTMLMediaElement', cls('HTMLMediaElement', 'HTMLMediaElement', 'class', { superClass: 'HTMLElement' })],
  ['SVGElement', cls('SVGElement', 'SVGElement', 'class', { superClass: 'Element' })],

  // Collections
  ['NodeList', cls('NodeList', 'NodeList', 'class')],
  ['HTMLCollection', cls('HTMLCollection', 'HTMLCollection', 'class')],
  ['DOMTokenList', cls('DOMTokenList', 'DOMTokenList', 'class')],
  ['NamedNodeMap', cls('NamedNodeMap', 'NamedNodeMap', 'class')],

  // Events
  ['Event', cls('Event', 'Event', 'class')],
  ['MouseEvent', cls('MouseEvent', 'MouseEvent', 'class', { superClass: 'UIEvent' })],
  ['KeyboardEvent', cls('KeyboardEvent', 'KeyboardEvent', 'class', { superClass: 'UIEvent' })],
  ['UIEvent', cls('UIEvent', 'UIEvent', 'class', { superClass: 'Event' })],
  ['FocusEvent', cls('FocusEvent', 'FocusEvent', 'class', { superClass: 'UIEvent' })],
  ['InputEvent', cls('InputEvent', 'InputEvent', 'class', { superClass: 'UIEvent' })],
  ['TouchEvent', cls('TouchEvent', 'TouchEvent', 'class', { superClass: 'UIEvent' })],
  ['PointerEvent', cls('PointerEvent', 'PointerEvent', 'class', { superClass: 'MouseEvent' })],
  ['WheelEvent', cls('WheelEvent', 'WheelEvent', 'class', { superClass: 'MouseEvent' })],
  ['DragEvent', cls('DragEvent', 'DragEvent', 'class', { superClass: 'MouseEvent' })],
  ['ClipboardEvent', cls('ClipboardEvent', 'ClipboardEvent', 'class', { superClass: 'Event' })],
  ['CustomEvent', cls('CustomEvent', 'CustomEvent', 'class', { superClass: 'Event' })],
  ['MessageEvent', cls('MessageEvent', 'MessageEvent', 'class', { superClass: 'Event' })],
  ['ErrorEvent', cls('ErrorEvent', 'ErrorEvent', 'class', { superClass: 'Event' })],
  ['ProgressEvent', cls('ProgressEvent', 'ProgressEvent', 'class', { superClass: 'Event' })],
  ['AnimationEvent', cls('AnimationEvent', 'AnimationEvent', 'class', { superClass: 'Event' })],
  ['TransitionEvent', cls('TransitionEvent', 'TransitionEvent', 'class', { superClass: 'Event' })],
  ['EventTarget', cls('EventTarget', 'EventTarget', 'class')],

  // Fetch API
  ['Request', cls('Request', 'Request', 'class')],
  ['Response', cls('Response', 'Response', 'class')],
  ['Headers', cls('Headers', 'Headers', 'class')],
  ['FormData', cls('FormData', 'FormData', 'class')],
  ['URLSearchParams', cls('URLSearchParams', 'URLSearchParams', 'class')],
  ['URL', cls('URL', 'URL', 'class')],
  ['Blob', cls('Blob', 'Blob', 'class')],
  ['File', cls('File', 'File', 'class', { superClass: 'Blob' })],
  ['FileReader', cls('FileReader', 'FileReader', 'class')],
  ['FileList', cls('FileList', 'FileList', 'class')],
  ['AbortController', cls('AbortController', 'AbortController', 'class')],
  ['AbortSignal', cls('AbortSignal', 'AbortSignal', 'class', { superClass: 'EventTarget' })],

  // Web APIs
  ['WebSocket', cls('WebSocket', 'WebSocket', 'class', { superClass: 'EventTarget' })],
  ['Worker', cls('Worker', 'Worker', 'class', { superClass: 'EventTarget' })],
  ['SharedWorker', cls('SharedWorker', 'SharedWorker', 'class', { superClass: 'EventTarget' })],
  ['ServiceWorker', cls('ServiceWorker', 'ServiceWorker', 'class', { superClass: 'EventTarget' })],
  ['IntersectionObserver', cls('IntersectionObserver', 'IntersectionObserver', 'class')],
  ['MutationObserver', cls('MutationObserver', 'MutationObserver', 'class')],
  ['ResizeObserver', cls('ResizeObserver', 'ResizeObserver', 'class')],
  ['XMLHttpRequest', cls('XMLHttpRequest', 'XMLHttpRequest', 'class', { superClass: 'EventTarget' })],

  // Graphics
  ['CanvasRenderingContext2D', cls('CanvasRenderingContext2D', 'CanvasRenderingContext2D', 'class')],
  ['WebGLRenderingContext', cls('WebGLRenderingContext', 'WebGLRenderingContext', 'class')],
  ['WebGL2RenderingContext', cls('WebGL2RenderingContext', 'WebGL2RenderingContext', 'class')],
  ['ImageData', cls('ImageData', 'ImageData', 'class')],

  // Audio
  ['AudioContext', cls('AudioContext', 'AudioContext', 'class', { superClass: 'BaseAudioContext' })],
  ['BaseAudioContext', cls('BaseAudioContext', 'BaseAudioContext', 'class')],
  ['AudioNode', cls('AudioNode', 'AudioNode', 'class')],

  // Geolocation
  ['Geolocation', cls('Geolocation', 'Geolocation', 'interface')],
  ['GeolocationPosition', cls('GeolocationPosition', 'GeolocationPosition', 'interface')],
  ['GeolocationCoordinates', cls('GeolocationCoordinates', 'GeolocationCoordinates', 'interface')],
]);

// =============================================================================
// DOM Global Functions
// =============================================================================

export const DOM_STDLIB_FUNCTIONS: ReadonlyMap<string, FunctionSymbol> = new Map([
  // Global functions
  ['fetch', fn('fetch', 'fetch', { parameterTypes: ['RequestInfo | URL', 'RequestInit?'], returnType: 'Promise<Response>' })],
  ['alert', fn('alert', 'alert', { parameterTypes: ['any?'], returnType: 'void' })],
  ['confirm', fn('confirm', 'confirm', { parameterTypes: ['string?'], returnType: 'boolean' })],
  ['prompt', fn('prompt', 'prompt', { parameterTypes: ['string?', 'string?'], returnType: 'string | null' })],
  ['setTimeout', fn('setTimeout', 'setTimeout', { parameterTypes: ['TimerHandler', 'number?', '...any[]'], returnType: 'number' })],
  ['clearTimeout', fn('clearTimeout', 'clearTimeout', { parameterTypes: ['number?'], returnType: 'void' })],
  ['setInterval', fn('setInterval', 'setInterval', { parameterTypes: ['TimerHandler', 'number?', '...any[]'], returnType: 'number' })],
  ['clearInterval', fn('clearInterval', 'clearInterval', { parameterTypes: ['number?'], returnType: 'void' })],
  ['requestAnimationFrame', fn('requestAnimationFrame', 'requestAnimationFrame', { parameterTypes: ['FrameRequestCallback'], returnType: 'number' })],
  ['cancelAnimationFrame', fn('cancelAnimationFrame', 'cancelAnimationFrame', { parameterTypes: ['number'], returnType: 'void' })],
  ['requestIdleCallback', fn('requestIdleCallback', 'requestIdleCallback', { parameterTypes: ['IdleRequestCallback', 'IdleRequestOptions?'], returnType: 'number' })],
  ['cancelIdleCallback', fn('cancelIdleCallback', 'cancelIdleCallback', { parameterTypes: ['number'], returnType: 'void' })],
  ['atob', fn('atob', 'atob', { parameterTypes: ['string'], returnType: 'string' })],
  ['btoa', fn('btoa', 'btoa', { parameterTypes: ['string'], returnType: 'string' })],
  ['getComputedStyle', fn('getComputedStyle', 'getComputedStyle', { parameterTypes: ['Element', 'string?'], returnType: 'CSSStyleDeclaration' })],
  ['matchMedia', fn('matchMedia', 'matchMedia', { parameterTypes: ['string'], returnType: 'MediaQueryList' })],
  ['scroll', fn('scroll', 'scroll', { parameterTypes: ['ScrollToOptions | number?', 'number?'], returnType: 'void' })],
  ['scrollTo', fn('scrollTo', 'scrollTo', { parameterTypes: ['ScrollToOptions | number?', 'number?'], returnType: 'void' })],
  ['scrollBy', fn('scrollBy', 'scrollBy', { parameterTypes: ['ScrollToOptions | number?', 'number?'], returnType: 'void' })],
  ['open', fn('open', 'open', { parameterTypes: ['string?', 'string?', 'string?'], returnType: 'Window | null' })],
  ['close', fn('close', 'close', { parameterTypes: [], returnType: 'void' })],
  ['print', fn('print', 'print', { parameterTypes: [], returnType: 'void' })],
  ['focus', fn('focus', 'focus', { parameterTypes: [], returnType: 'void' })],
  ['blur', fn('blur', 'blur', { parameterTypes: [], returnType: 'void' })],

  // Document methods
  ['document.getElementById', fn('getElementById', 'document.getElementById', { declaringTypeFqn: 'Document', parameterTypes: ['string'], returnType: 'HTMLElement | null' })],
  ['document.getElementsByClassName', fn('getElementsByClassName', 'document.getElementsByClassName', { declaringTypeFqn: 'Document', parameterTypes: ['string'], returnType: 'HTMLCollectionOf<Element>' })],
  ['document.getElementsByTagName', fn('getElementsByTagName', 'document.getElementsByTagName', { declaringTypeFqn: 'Document', parameterTypes: ['string'], returnType: 'HTMLCollectionOf<Element>' })],
  ['document.getElementsByName', fn('getElementsByName', 'document.getElementsByName', { declaringTypeFqn: 'Document', parameterTypes: ['string'], returnType: 'NodeListOf<HTMLElement>' })],
  ['document.querySelector', fn('querySelector', 'document.querySelector', { declaringTypeFqn: 'Document', parameterTypes: ['string'], returnType: 'Element | null' })],
  ['document.querySelectorAll', fn('querySelectorAll', 'document.querySelectorAll', { declaringTypeFqn: 'Document', parameterTypes: ['string'], returnType: 'NodeListOf<Element>' })],
  ['document.createElement', fn('createElement', 'document.createElement', { declaringTypeFqn: 'Document', parameterTypes: ['string', 'ElementCreationOptions?'], returnType: 'HTMLElement' })],
  ['document.createTextNode', fn('createTextNode', 'document.createTextNode', { declaringTypeFqn: 'Document', parameterTypes: ['string'], returnType: 'Text' })],
  ['document.createDocumentFragment', fn('createDocumentFragment', 'document.createDocumentFragment', { declaringTypeFqn: 'Document', parameterTypes: [], returnType: 'DocumentFragment' })],
  ['document.createComment', fn('createComment', 'document.createComment', { declaringTypeFqn: 'Document', parameterTypes: ['string'], returnType: 'Comment' })],
  ['document.createAttribute', fn('createAttribute', 'document.createAttribute', { declaringTypeFqn: 'Document', parameterTypes: ['string'], returnType: 'Attr' })],
  ['document.adoptNode', fn('adoptNode', 'document.adoptNode', { declaringTypeFqn: 'Document', parameterTypes: ['Node'], returnType: 'Node' })],
  ['document.importNode', fn('importNode', 'document.importNode', { declaringTypeFqn: 'Document', parameterTypes: ['Node', 'boolean?'], returnType: 'Node' })],
  ['document.write', fn('write', 'document.write', { declaringTypeFqn: 'Document', parameterTypes: ['...string[]'], returnType: 'void' })],
  ['document.writeln', fn('writeln', 'document.writeln', { declaringTypeFqn: 'Document', parameterTypes: ['...string[]'], returnType: 'void' })],
  ['document.open', fn('open', 'document.open', { declaringTypeFqn: 'Document', parameterTypes: ['string?', 'string?'], returnType: 'Document' })],
  ['document.close', fn('close', 'document.close', { declaringTypeFqn: 'Document', parameterTypes: [], returnType: 'void' })],
  ['document.hasFocus', fn('hasFocus', 'document.hasFocus', { declaringTypeFqn: 'Document', parameterTypes: [], returnType: 'boolean' })],
  ['document.execCommand', fn('execCommand', 'document.execCommand', { declaringTypeFqn: 'Document', parameterTypes: ['string', 'boolean?', 'string?'], returnType: 'boolean' })],

  // Element methods
  ['Element.querySelector', fn('querySelector', 'Element.prototype.querySelector', { declaringTypeFqn: 'Element', parameterTypes: ['string'], returnType: 'Element | null' })],
  ['Element.querySelectorAll', fn('querySelectorAll', 'Element.prototype.querySelectorAll', { declaringTypeFqn: 'Element', parameterTypes: ['string'], returnType: 'NodeListOf<Element>' })],
  ['Element.getAttribute', fn('getAttribute', 'Element.prototype.getAttribute', { declaringTypeFqn: 'Element', parameterTypes: ['string'], returnType: 'string | null' })],
  ['Element.setAttribute', fn('setAttribute', 'Element.prototype.setAttribute', { declaringTypeFqn: 'Element', parameterTypes: ['string', 'string'], returnType: 'void' })],
  ['Element.removeAttribute', fn('removeAttribute', 'Element.prototype.removeAttribute', { declaringTypeFqn: 'Element', parameterTypes: ['string'], returnType: 'void' })],
  ['Element.hasAttribute', fn('hasAttribute', 'Element.prototype.hasAttribute', { declaringTypeFqn: 'Element', parameterTypes: ['string'], returnType: 'boolean' })],
  ['Element.toggleAttribute', fn('toggleAttribute', 'Element.prototype.toggleAttribute', { declaringTypeFqn: 'Element', parameterTypes: ['string', 'boolean?'], returnType: 'boolean' })],
  ['Element.closest', fn('closest', 'Element.prototype.closest', { declaringTypeFqn: 'Element', parameterTypes: ['string'], returnType: 'Element | null' })],
  ['Element.matches', fn('matches', 'Element.prototype.matches', { declaringTypeFqn: 'Element', parameterTypes: ['string'], returnType: 'boolean' })],
  ['Element.append', fn('append', 'Element.prototype.append', { declaringTypeFqn: 'Element', parameterTypes: ['...(Node | string)[]'], returnType: 'void' })],
  ['Element.prepend', fn('prepend', 'Element.prototype.prepend', { declaringTypeFqn: 'Element', parameterTypes: ['...(Node | string)[]'], returnType: 'void' })],
  ['Element.before', fn('before', 'Element.prototype.before', { declaringTypeFqn: 'Element', parameterTypes: ['...(Node | string)[]'], returnType: 'void' })],
  ['Element.after', fn('after', 'Element.prototype.after', { declaringTypeFqn: 'Element', parameterTypes: ['...(Node | string)[]'], returnType: 'void' })],
  ['Element.replaceWith', fn('replaceWith', 'Element.prototype.replaceWith', { declaringTypeFqn: 'Element', parameterTypes: ['...(Node | string)[]'], returnType: 'void' })],
  ['Element.remove', fn('remove', 'Element.prototype.remove', { declaringTypeFqn: 'Element', parameterTypes: [], returnType: 'void' })],
  ['Element.insertAdjacentHTML', fn('insertAdjacentHTML', 'Element.prototype.insertAdjacentHTML', { declaringTypeFqn: 'Element', parameterTypes: ['InsertPosition', 'string'], returnType: 'void' })],
  ['Element.insertAdjacentText', fn('insertAdjacentText', 'Element.prototype.insertAdjacentText', { declaringTypeFqn: 'Element', parameterTypes: ['InsertPosition', 'string'], returnType: 'void' })],
  ['Element.insertAdjacentElement', fn('insertAdjacentElement', 'Element.prototype.insertAdjacentElement', { declaringTypeFqn: 'Element', parameterTypes: ['InsertPosition', 'Element'], returnType: 'Element | null' })],
  ['Element.scrollIntoView', fn('scrollIntoView', 'Element.prototype.scrollIntoView', { declaringTypeFqn: 'Element', parameterTypes: ['boolean | ScrollIntoViewOptions?'], returnType: 'void' })],
  ['Element.getBoundingClientRect', fn('getBoundingClientRect', 'Element.prototype.getBoundingClientRect', { declaringTypeFqn: 'Element', parameterTypes: [], returnType: 'DOMRect' })],
  ['Element.getClientRects', fn('getClientRects', 'Element.prototype.getClientRects', { declaringTypeFqn: 'Element', parameterTypes: [], returnType: 'DOMRectList' })],

  // Node methods
  ['Node.appendChild', fn('appendChild', 'Node.prototype.appendChild', { declaringTypeFqn: 'Node', parameterTypes: ['Node'], returnType: 'Node' })],
  ['Node.removeChild', fn('removeChild', 'Node.prototype.removeChild', { declaringTypeFqn: 'Node', parameterTypes: ['Node'], returnType: 'Node' })],
  ['Node.replaceChild', fn('replaceChild', 'Node.prototype.replaceChild', { declaringTypeFqn: 'Node', parameterTypes: ['Node', 'Node'], returnType: 'Node' })],
  ['Node.insertBefore', fn('insertBefore', 'Node.prototype.insertBefore', { declaringTypeFqn: 'Node', parameterTypes: ['Node', 'Node | null'], returnType: 'Node' })],
  ['Node.cloneNode', fn('cloneNode', 'Node.prototype.cloneNode', { declaringTypeFqn: 'Node', parameterTypes: ['boolean?'], returnType: 'Node' })],
  ['Node.contains', fn('contains', 'Node.prototype.contains', { declaringTypeFqn: 'Node', parameterTypes: ['Node | null'], returnType: 'boolean' })],
  ['Node.hasChildNodes', fn('hasChildNodes', 'Node.prototype.hasChildNodes', { declaringTypeFqn: 'Node', parameterTypes: [], returnType: 'boolean' })],
  ['Node.normalize', fn('normalize', 'Node.prototype.normalize', { declaringTypeFqn: 'Node', parameterTypes: [], returnType: 'void' })],
  ['Node.compareDocumentPosition', fn('compareDocumentPosition', 'Node.prototype.compareDocumentPosition', { declaringTypeFqn: 'Node', parameterTypes: ['Node'], returnType: 'number' })],
  ['Node.isEqualNode', fn('isEqualNode', 'Node.prototype.isEqualNode', { declaringTypeFqn: 'Node', parameterTypes: ['Node | null'], returnType: 'boolean' })],
  ['Node.isSameNode', fn('isSameNode', 'Node.prototype.isSameNode', { declaringTypeFqn: 'Node', parameterTypes: ['Node | null'], returnType: 'boolean' })],

  // EventTarget methods
  ['EventTarget.addEventListener', fn('addEventListener', 'EventTarget.prototype.addEventListener', { declaringTypeFqn: 'EventTarget', parameterTypes: ['string', 'EventListenerOrEventListenerObject | null', 'AddEventListenerOptions | boolean?'], returnType: 'void' })],
  ['EventTarget.removeEventListener', fn('removeEventListener', 'EventTarget.prototype.removeEventListener', { declaringTypeFqn: 'EventTarget', parameterTypes: ['string', 'EventListenerOrEventListenerObject | null', 'EventListenerOptions | boolean?'], returnType: 'void' })],
  ['EventTarget.dispatchEvent', fn('dispatchEvent', 'EventTarget.prototype.dispatchEvent', { declaringTypeFqn: 'EventTarget', parameterTypes: ['Event'], returnType: 'boolean' })],

  // Storage methods
  ['Storage.getItem', fn('getItem', 'Storage.prototype.getItem', { declaringTypeFqn: 'Storage', parameterTypes: ['string'], returnType: 'string | null' })],
  ['Storage.setItem', fn('setItem', 'Storage.prototype.setItem', { declaringTypeFqn: 'Storage', parameterTypes: ['string', 'string'], returnType: 'void' })],
  ['Storage.removeItem', fn('removeItem', 'Storage.prototype.removeItem', { declaringTypeFqn: 'Storage', parameterTypes: ['string'], returnType: 'void' })],
  ['Storage.clear', fn('clear', 'Storage.prototype.clear', { declaringTypeFqn: 'Storage', parameterTypes: [], returnType: 'void' })],
  ['Storage.key', fn('key', 'Storage.prototype.key', { declaringTypeFqn: 'Storage', parameterTypes: ['number'], returnType: 'string | null' })],

  // History methods
  ['History.back', fn('back', 'History.prototype.back', { declaringTypeFqn: 'History', parameterTypes: [], returnType: 'void' })],
  ['History.forward', fn('forward', 'History.prototype.forward', { declaringTypeFqn: 'History', parameterTypes: [], returnType: 'void' })],
  ['History.go', fn('go', 'History.prototype.go', { declaringTypeFqn: 'History', parameterTypes: ['number?'], returnType: 'void' })],
  ['History.pushState', fn('pushState', 'History.prototype.pushState', { declaringTypeFqn: 'History', parameterTypes: ['any', 'string', 'string | URL | null?'], returnType: 'void' })],
  ['History.replaceState', fn('replaceState', 'History.prototype.replaceState', { declaringTypeFqn: 'History', parameterTypes: ['any', 'string', 'string | URL | null?'], returnType: 'void' })],

  // Fetch/Response methods
  ['Response.json', fn('json', 'Response.prototype.json', { declaringTypeFqn: 'Response', parameterTypes: [], returnType: 'Promise<any>' })],
  ['Response.text', fn('text', 'Response.prototype.text', { declaringTypeFqn: 'Response', parameterTypes: [], returnType: 'Promise<string>' })],
  ['Response.blob', fn('blob', 'Response.prototype.blob', { declaringTypeFqn: 'Response', parameterTypes: [], returnType: 'Promise<Blob>' })],
  ['Response.arrayBuffer', fn('arrayBuffer', 'Response.prototype.arrayBuffer', { declaringTypeFqn: 'Response', parameterTypes: [], returnType: 'Promise<ArrayBuffer>' })],
  ['Response.formData', fn('formData', 'Response.prototype.formData', { declaringTypeFqn: 'Response', parameterTypes: [], returnType: 'Promise<FormData>' })],
  ['Response.clone', fn('clone', 'Response.prototype.clone', { declaringTypeFqn: 'Response', parameterTypes: [], returnType: 'Response' })],
]);

// =============================================================================
// DOM Stdlib Provider
// =============================================================================

/**
 * StdlibProvider implementation for DOM (Browser) APIs.
 * Provides access to browser APIs for symbol resolution.
 */
export class DomStdlibProvider implements StdlibProvider {
  readonly languages: readonly SupportedLanguage[] = ['typescript', 'javascript'];

  // DOM globals (available without import)
  readonly defaultWildcardImports: readonly string[] = [];

  lookupFunction(name: string): FunctionSymbol | undefined {
    return DOM_STDLIB_FUNCTIONS.get(name);
  }

  lookupClass(name: string): ClassSymbol | undefined {
    return DOM_STDLIB_CLASSES.get(name);
  }

  lookupStaticMethod(qualifiedName: string): FunctionSymbol | undefined {
    return DOM_STDLIB_FUNCTIONS.get(qualifiedName);
  }

  isKnownSymbol(name: string): boolean {
    return DOM_STDLIB_CLASSES.has(name) || DOM_STDLIB_FUNCTIONS.has(name);
  }

  getAllSymbols(): Map<string, Symbol> {
    const result = new Map<string, Symbol>();

    for (const [name, func] of DOM_STDLIB_FUNCTIONS) {
      result.set(name, func);
    }

    for (const [name, clsSymbol] of DOM_STDLIB_CLASSES) {
      result.set(name, clsSymbol);
    }

    return result;
  }

  isBuiltinType(_typeName: string): boolean {
    // DOM doesn't add primitive types, defer to TypeScript
    return false;
  }
}
