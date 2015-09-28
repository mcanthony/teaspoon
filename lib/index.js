'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var React = require('react');
var ReactDOM = require('react-dom');
var ReactInstanceMap = require('react/lib/ReactInstanceMap');
var utils = require('react-addons-test-utils');
var findAll = require('./utils');
var hasClass = require('dom-helpers/class/hasClass');

var $r = module.exports = rtq;

var isRtq = function isRtq(item) {
  return item && item.__isRTQ;
};
rtq.react = React;

function rtq(element, mount) {
  var renderIntoDocument = arguments.length <= 2 || arguments[2] === undefined ? mount === true : arguments[2];
  return (function () {
    var context;

    if (!mount || mount === true) {
      mount = document.createElement('div');
    }

    if (utils.isElement(element)) {
      context = mount;
      element = render(element, mount, renderIntoDocument);
    } else if (utils.isDOMComponent(element) || utils.isCompositeComponent(element)) context = element;else if (isRtq(element)) {
      context = element.context;
      element = element.get();
    } else throw new TypeError('Wrong type: must either be ReactElement or a Component Instance');

    return new ComponentCollection(element, context);
  })();
}

function render(element, mountPoint) {
  var renderIntoDocument = arguments.length <= 2 || arguments[2] === undefined ? false : arguments[2];

  var mount = mountPoint;

  if (renderIntoDocument) document.body.appendChild(mount);

  var instance = ReactDOM.render(element, mount);

  if (instance === null) {
    instance = ReactDOM.render(wrapStateless(element), mount);
  }

  if (!instance.renderWithProps) {
    instance.renderWithProps = function (newProps) {
      return render(React.cloneElement(element, newProps), mount, renderIntoDocument);
    };
  }

  return instance;
}

function ComponentCollection(_components, context, selector) {
  var components = _components == null ? [] : [].concat(_components),
      idx = -1,
      len = components.length;

  this._privateInstances = Object.create(null);

  while (++idx < len) {
    var component = components[idx];

    // if this is a private instance, get the public one
    if (component.getPublicInstance) {
      this._privateInstances[idx] = component;
      component = component.getPublicInstance();

      //stateless
      if (component === null) component = ReactDOM.findDOMNode(this._privateInstances[idx]._instance);
    }
    // if this a root Stateless component
    else if (component && component.__isRTQstatelessWrapper) {
        var wrapperInstance = ReactInstanceMap.get(component);
        this._privateInstances[idx] = wrapperInstance._renderedComponent;
        component = ReactDOM.findDOMNode(component);
      } else {
        this._privateInstances[idx] = ReactInstanceMap.get(component) || component._reactInternalComponent;
      }

    this[idx] = component;
  }

  this.length = len;
  this.context = context;
  this.selector = selector;
  this.__isRTQ = true;
}

rtq.dom = function (component) {
  return component instanceof HTMLElement ? component : ReactDOM.findDOMNode(component);
};

ComponentCollection.prototype = {

  constructor: ComponentCollection,

  unmount: function unmount() {
    var inBody = !!this.context.parentNode;

    ReactDOM.unmountComponentAtNode(this.context);
    if (inBody) document.body.removeChild(this.context);
    this.context = null;
  },

  setProps: function setProps(newProps) {
    return this.mapInPlace(function (element) {
      return element.renderWithProps(newProps);
    });
  },

  each: function each(cb, thisArg) {
    var idx = -1,
        len = this.length;
    while (++idx < len) cb.call(thisArg, this[idx], idx, this);
    return this;
  },

  mapInPlace: function mapInPlace(cb, thisArg) {
    var _this = this;

    return this.each(function (el, idx, list) {
      return _this[idx] = cb(el, idx, list);
    });
  },

  map: function map(cb, thisArg) {
    var idx = -1,
        len = this.length,
        result = [];
    while (++idx < len) result.push(cb.call(thisArg, this[idx], idx, this));
    return result;
  },

  _getInstances: function _getInstances() {
    var _this2 = this;

    return this.map(function (component, idx) {
      return _this2._privateInstances[idx];
    });
  },

  get: function get() {
    return unwrap(this.map(function (component) {
      return component;
    }));
  },

  dom: function dom() {
    return unwrap(this.map(rtq.dom));
  },

  find: function find(selector) {
    var _this3 = this;

    var result = [];

    this.each(function (component, idx) {
      component = component !== null ? _this3._privateInstances[idx] || component : component;

      result = result.concat(_find(component, selector));
    });

    return new ComponentCollection(result, this.context, selector);
  },

  only: function only() {
    if (this.length !== 1) throw Error('`' + this.selector + '` found: ' + this.length + ' not 1 ');
    return this.first();
  },

  single: function single(selector) {
    return selector ? this.find(selector).only() : this.only();
  },

  first: function first(selector) {
    return selector ? this.find(selector).first() : new ComponentCollection(this[0], this.context, this.selector);
  },

  last: function last(selector) {
    return selector ? this.find(selector).last() : new ComponentCollection(this[this.length - 1], this.context, this.selector);
  },

  is: function is(selector) {
    var instances = this._getInstances();
    var getPublicInst = function getPublicInst(inst) {
      return inst.getPublicInstance ? inst.getPublicInstance() : inst;
    };

    if (typeof selector === 'function') {
      return instances.every(function (inst) {
        var publicInst = getPublicInst(inst);
        return findAll.isCompositeComponent(publicInst) && inst._currentElement.type === selector;
      });
    } else if (selector === ':dom') return instances.every(function (inst) {
      return utils.isDOMComponent(getPublicInst(inst));
    });else if (selector === ':composite') return instances.every(function (inst) {
      return findAll.isCompositeComponent(getPublicInst(inst));
    });else if (selector[0] === '.') return instances.every(function (inst) {
      return hasClass(rtq.dom(getPublicInst(inst)), selector.substr(1));
    });else return instances.every(function (inst) {
      return rtq.dom(getPublicInst(inst)).tagName.toUpperCase() === selector.toUpperCase();
    });
  },

  trigger: function trigger(event, data) {
    data = data || {};

    if (event.substr(0, 2) === 'on') event = event.substr(2, 1).toLowerCase() + event.substr(3);

    if (!(event in utils.Simulate)) throw new TypeError('"' + event + '" is not a supported DOM event');

    return this.each(function (component) {
      return utils.Simulate[event]($r.dom(component), data);
    });
  }
};

function _find(context, selector) {
  var components;

  if (typeof selector === 'function') {
    components = findAll.componentsByType(context, selector);
    selector = selector.name || '<<anonymous component>>';
  } else if (!selector) components = findAll.findAllInRenderedTree(context, function () {
    return true;
  });else if (selector === ':dom') components = findAll.findAllInRenderedTree(context, function (item) {
    return utils.isDOMComponent(item);
  });else if (selector === ':composite') components = findAll.findAllInRenderedTree(context, function (item) {
    return !utils.isDOMComponent(item);
  });else if (selector[0] === '.') components = findAll.componentsByClassName(context, selector.substr(1));else components = findAll.componentsByTagName(context, selector);

  return components || [];
}

function unwrap(arr) {
  return arr && arr.length === 1 ? arr[0] : arr;
}

function wrapStateless(Element) {
  var StatelessWrapper = (function (_React$Component) {
    _inherits(StatelessWrapper, _React$Component);

    function StatelessWrapper() {
      _classCallCheck(this, StatelessWrapper);

      _React$Component.call(this);
      this.__isRTQstatelessWrapper = true;
    }

    StatelessWrapper.prototype.render = function render() {
      return Element;
    };

    return StatelessWrapper;
  })(React.Component);

  return React.createElement(StatelessWrapper, null);
}