import { describe, it, expect } from 'vitest';
import {
  DomStdlibProvider,
  DOM_STDLIB_CLASSES,
  DOM_STDLIB_FUNCTIONS,
} from './dom-stdlib.js';

describe('DomStdlibProvider', () => {
  const provider = new DomStdlibProvider();

  describe('languages', () => {
    it('should support typescript and javascript', () => {
      expect(provider.languages).toContain('typescript');
      expect(provider.languages).toContain('javascript');
    });
  });

  describe('defaultWildcardImports', () => {
    it('should have no default wildcard imports', () => {
      expect(provider.defaultWildcardImports).toEqual([]);
    });
  });

  describe('lookupFunction', () => {
    it('should find fetch function', () => {
      const fn = provider.lookupFunction('fetch');
      expect(fn).toBeDefined();
      expect(fn?.name).toBe('fetch');
      expect(fn?.returnType).toBe('Promise<Response>');
    });

    it('should find alert function', () => {
      const fn = provider.lookupFunction('alert');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('void');
    });

    it('should find setTimeout function', () => {
      const fn = provider.lookupFunction('setTimeout');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('number');
    });

    it('should find requestAnimationFrame function', () => {
      const fn = provider.lookupFunction('requestAnimationFrame');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('number');
    });

    it('should return undefined for unknown functions', () => {
      const fn = provider.lookupFunction('unknownFunction');
      expect(fn).toBeUndefined();
    });
  });

  describe('lookupClass', () => {
    it('should find window object', () => {
      const cls = provider.lookupClass('window');
      expect(cls).toBeDefined();
      expect(cls?.kind).toBe('object');
    });

    it('should find document object', () => {
      const cls = provider.lookupClass('document');
      expect(cls).toBeDefined();
      expect(cls?.kind).toBe('object');
    });

    it('should find HTMLElement class', () => {
      const cls = provider.lookupClass('HTMLElement');
      expect(cls).toBeDefined();
      expect(cls?.kind).toBe('class');
      expect(cls?.superClass).toBe('Element');
    });

    it('should find DOM element classes with inheritance', () => {
      const div = provider.lookupClass('HTMLDivElement');
      expect(div).toBeDefined();
      expect(div?.superClass).toBe('HTMLElement');

      const input = provider.lookupClass('HTMLInputElement');
      expect(input?.superClass).toBe('HTMLElement');
    });

    it('should find Event classes', () => {
      expect(provider.lookupClass('Event')).toBeDefined();
      expect(provider.lookupClass('MouseEvent')).toBeDefined();
      expect(provider.lookupClass('KeyboardEvent')).toBeDefined();
      expect(provider.lookupClass('CustomEvent')).toBeDefined();
    });

    it('should find Fetch API classes', () => {
      expect(provider.lookupClass('Request')).toBeDefined();
      expect(provider.lookupClass('Response')).toBeDefined();
      expect(provider.lookupClass('Headers')).toBeDefined();
      expect(provider.lookupClass('FormData')).toBeDefined();
    });

    it('should return undefined for unknown classes', () => {
      const cls = provider.lookupClass('UnknownClass');
      expect(cls).toBeUndefined();
    });
  });

  describe('lookupStaticMethod', () => {
    it('should find document.getElementById', () => {
      const fn = provider.lookupStaticMethod('document.getElementById');
      expect(fn).toBeDefined();
      expect(fn?.name).toBe('getElementById');
      expect(fn?.declaringTypeFqn).toBe('Document');
      expect(fn?.returnType).toBe('HTMLElement | null');
    });

    it('should find document.querySelector', () => {
      const fn = provider.lookupStaticMethod('document.querySelector');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('Element | null');
    });

    it('should find document.createElement', () => {
      const fn = provider.lookupStaticMethod('document.createElement');
      expect(fn).toBeDefined();
      expect(fn?.returnType).toBe('HTMLElement');
    });

    it('should find Element methods', () => {
      expect(provider.lookupStaticMethod('Element.querySelector')).toBeDefined();
      expect(provider.lookupStaticMethod('Element.getAttribute')).toBeDefined();
      expect(provider.lookupStaticMethod('Element.setAttribute')).toBeDefined();
    });

    it('should find Node methods', () => {
      expect(provider.lookupStaticMethod('Node.appendChild')).toBeDefined();
      expect(provider.lookupStaticMethod('Node.removeChild')).toBeDefined();
      expect(provider.lookupStaticMethod('Node.cloneNode')).toBeDefined();
    });

    it('should find EventTarget methods', () => {
      expect(provider.lookupStaticMethod('EventTarget.addEventListener')).toBeDefined();
      expect(provider.lookupStaticMethod('EventTarget.removeEventListener')).toBeDefined();
      expect(provider.lookupStaticMethod('EventTarget.dispatchEvent')).toBeDefined();
    });

    it('should find Storage methods', () => {
      expect(provider.lookupStaticMethod('Storage.getItem')).toBeDefined();
      expect(provider.lookupStaticMethod('Storage.setItem')).toBeDefined();
      expect(provider.lookupStaticMethod('Storage.removeItem')).toBeDefined();
      expect(provider.lookupStaticMethod('Storage.clear')).toBeDefined();
    });

    it('should find History methods', () => {
      expect(provider.lookupStaticMethod('History.back')).toBeDefined();
      expect(provider.lookupStaticMethod('History.forward')).toBeDefined();
      expect(provider.lookupStaticMethod('History.pushState')).toBeDefined();
    });

    it('should find Response methods', () => {
      expect(provider.lookupStaticMethod('Response.json')).toBeDefined();
      expect(provider.lookupStaticMethod('Response.text')).toBeDefined();
      expect(provider.lookupStaticMethod('Response.blob')).toBeDefined();
    });

    it('should return undefined for unknown static methods', () => {
      const fn = provider.lookupStaticMethod('unknown.method');
      expect(fn).toBeUndefined();
    });
  });

  describe('isKnownSymbol', () => {
    it('should return true for DOM classes', () => {
      expect(provider.isKnownSymbol('window')).toBe(true);
      expect(provider.isKnownSymbol('document')).toBe(true);
      expect(provider.isKnownSymbol('HTMLElement')).toBe(true);
      expect(provider.isKnownSymbol('Event')).toBe(true);
    });

    it('should return true for DOM functions', () => {
      expect(provider.isKnownSymbol('fetch')).toBe(true);
      expect(provider.isKnownSymbol('alert')).toBe(true);
      expect(provider.isKnownSymbol('setTimeout')).toBe(true);
    });

    it('should return false for unknown symbols', () => {
      expect(provider.isKnownSymbol('MyClass')).toBe(false);
      expect(provider.isKnownSymbol('unknownFunction')).toBe(false);
    });
  });

  describe('isBuiltinType', () => {
    it('should return false (DOM does not define primitive types)', () => {
      expect(provider.isBuiltinType('string')).toBe(false);
      expect(provider.isBuiltinType('HTMLElement')).toBe(false);
    });
  });

  describe('getAllSymbols', () => {
    it('should return a map with all symbols', () => {
      const symbols = provider.getAllSymbols();
      expect(symbols).toBeInstanceOf(Map);
      expect(symbols.size).toBeGreaterThan(0);
    });

    it('should include classes', () => {
      const symbols = provider.getAllSymbols();
      expect(symbols.get('window')).toBeDefined();
      expect(symbols.get('HTMLElement')).toBeDefined();
    });

    it('should include functions', () => {
      const symbols = provider.getAllSymbols();
      expect(symbols.get('fetch')).toBeDefined();
      expect(symbols.get('alert')).toBeDefined();
    });
  });
});

describe('DOM_STDLIB_CLASSES', () => {
  it('should have global objects', () => {
    expect(DOM_STDLIB_CLASSES.get('window')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('document')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('navigator')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('location')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('history')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('localStorage')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('sessionStorage')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('console')).toBeDefined();
  });

  it('should have interface types', () => {
    expect(DOM_STDLIB_CLASSES.get('Window')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('Document')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('Navigator')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('Storage')).toBeDefined();
  });

  it('should have DOM element classes', () => {
    expect(DOM_STDLIB_CLASSES.get('Element')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('Node')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('HTMLElement')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('HTMLDivElement')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('HTMLSpanElement')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('HTMLInputElement')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('HTMLButtonElement')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('HTMLFormElement')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('HTMLCanvasElement')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('SVGElement')).toBeDefined();
  });

  it('should have collection classes', () => {
    expect(DOM_STDLIB_CLASSES.get('NodeList')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('HTMLCollection')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('DOMTokenList')).toBeDefined();
  });

  it('should have Event classes with inheritance', () => {
    const mouseEvent = DOM_STDLIB_CLASSES.get('MouseEvent');
    expect(mouseEvent).toBeDefined();
    expect(mouseEvent?.superClass).toBe('UIEvent');

    const keyboardEvent = DOM_STDLIB_CLASSES.get('KeyboardEvent');
    expect(keyboardEvent?.superClass).toBe('UIEvent');

    const uiEvent = DOM_STDLIB_CLASSES.get('UIEvent');
    expect(uiEvent?.superClass).toBe('Event');

    const customEvent = DOM_STDLIB_CLASSES.get('CustomEvent');
    expect(customEvent?.superClass).toBe('Event');
  });

  it('should have Fetch API classes', () => {
    expect(DOM_STDLIB_CLASSES.get('Request')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('Response')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('Headers')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('FormData')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('Blob')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('File')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('AbortController')).toBeDefined();
  });

  it('should have Web API classes', () => {
    expect(DOM_STDLIB_CLASSES.get('WebSocket')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('Worker')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('IntersectionObserver')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('MutationObserver')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('ResizeObserver')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('XMLHttpRequest')).toBeDefined();
  });

  it('should have Graphics classes', () => {
    expect(DOM_STDLIB_CLASSES.get('CanvasRenderingContext2D')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('WebGLRenderingContext')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('ImageData')).toBeDefined();
  });

  it('should have Audio classes', () => {
    expect(DOM_STDLIB_CLASSES.get('AudioContext')).toBeDefined();
    expect(DOM_STDLIB_CLASSES.get('AudioNode')).toBeDefined();
  });
});

describe('DOM_STDLIB_FUNCTIONS', () => {
  it('should have global functions', () => {
    expect(DOM_STDLIB_FUNCTIONS.get('fetch')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('alert')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('confirm')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('prompt')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('setTimeout')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('clearTimeout')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('setInterval')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('clearInterval')).toBeDefined();
  });

  it('should have animation functions', () => {
    expect(DOM_STDLIB_FUNCTIONS.get('requestAnimationFrame')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('cancelAnimationFrame')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('requestIdleCallback')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('cancelIdleCallback')).toBeDefined();
  });

  it('should have encoding functions', () => {
    expect(DOM_STDLIB_FUNCTIONS.get('atob')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('btoa')).toBeDefined();
  });

  it('should have window functions', () => {
    expect(DOM_STDLIB_FUNCTIONS.get('getComputedStyle')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('matchMedia')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('scroll')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('scrollTo')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('open')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('close')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('print')).toBeDefined();
  });

  it('should have document methods', () => {
    expect(DOM_STDLIB_FUNCTIONS.get('document.getElementById')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('document.getElementsByClassName')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('document.getElementsByTagName')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('document.querySelector')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('document.querySelectorAll')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('document.createElement')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('document.createTextNode')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('document.createDocumentFragment')).toBeDefined();
  });

  it('should have Element methods', () => {
    expect(DOM_STDLIB_FUNCTIONS.get('Element.querySelector')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Element.querySelectorAll')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Element.getAttribute')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Element.setAttribute')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Element.removeAttribute')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Element.hasAttribute')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Element.closest')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Element.matches')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Element.append')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Element.remove')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Element.getBoundingClientRect')).toBeDefined();
  });

  it('should have Node methods', () => {
    expect(DOM_STDLIB_FUNCTIONS.get('Node.appendChild')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Node.removeChild')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Node.replaceChild')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Node.insertBefore')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Node.cloneNode')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Node.contains')).toBeDefined();
  });

  it('should have EventTarget methods', () => {
    expect(DOM_STDLIB_FUNCTIONS.get('EventTarget.addEventListener')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('EventTarget.removeEventListener')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('EventTarget.dispatchEvent')).toBeDefined();
  });

  it('should have Storage methods', () => {
    expect(DOM_STDLIB_FUNCTIONS.get('Storage.getItem')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Storage.setItem')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Storage.removeItem')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Storage.clear')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Storage.key')).toBeDefined();
  });

  it('should have History methods', () => {
    expect(DOM_STDLIB_FUNCTIONS.get('History.back')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('History.forward')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('History.go')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('History.pushState')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('History.replaceState')).toBeDefined();
  });

  it('should have Response methods', () => {
    expect(DOM_STDLIB_FUNCTIONS.get('Response.json')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Response.text')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Response.blob')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Response.arrayBuffer')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Response.formData')).toBeDefined();
    expect(DOM_STDLIB_FUNCTIONS.get('Response.clone')).toBeDefined();
  });

  it('should have correct return types', () => {
    const fetch = DOM_STDLIB_FUNCTIONS.get('fetch');
    expect(fetch?.returnType).toBe('Promise<Response>');

    const getElementById = DOM_STDLIB_FUNCTIONS.get('document.getElementById');
    expect(getElementById?.returnType).toBe('HTMLElement | null');

    const querySelector = DOM_STDLIB_FUNCTIONS.get('document.querySelector');
    expect(querySelector?.returnType).toBe('Element | null');

    const createElement = DOM_STDLIB_FUNCTIONS.get('document.createElement');
    expect(createElement?.returnType).toBe('HTMLElement');

    const responseJson = DOM_STDLIB_FUNCTIONS.get('Response.json');
    expect(responseJson?.returnType).toBe('Promise<any>');
  });
});
