const Utils = require('../utils');
const RuleUtils = require('./RuleUtils');

/**
 * A hand-coded <select>-like element which allows the selection of one of a
 * thing's properties. In a perfect world this would be a styled select, but
 * this is not a perfect world.
 * @constructor
 * @param {DevicePropertyBlock} devicePropertyBlock
 * @param {Element} parent
 * @param {ThingDescription} thing
 */
function PropertySelect(devicePropertyBlock, parent, thing) {
  this.devicePropertyBlock = devicePropertyBlock;
  this.thing = thing;
  this.role = '';

  this.elt = document.createElement('div');
  this.elt.classList.add('property-select');

  this.onClick = this.onClick.bind(this);
  this.elt.addEventListener('click', this.onClick);

  this.clearOptions();

  // Disable dragging started by clicking property select
  this.elt.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
  this.elt.addEventListener('touchstart', (e) => {
    e.stopPropagation();
  });

  parent.appendChild(this.elt);
}

/**
 * Reset the options list to only include the placeholder Select Property
 */
PropertySelect.prototype.clearOptions = function() {
  this.elt.innerHTML = '';
  this.addOption('Select Property', null, true);
};

/**
 * Add an option to the options list
 * @param {String} name - text content of option
 * @param {Object} ruleFragment - associated rule fragment with either trigger
 * or property defined
 * @param {boolean} selected - if the option is selected
 */
PropertySelect.prototype.addOption = function(name, ruleFragment, selected) {
  const elt = document.createElement('div');
  elt.classList.add('property-select-option');
  if (selected) {
    elt.classList.add('selected');
  }
  elt.dataset.ruleFragment = JSON.stringify(ruleFragment);
  const nameElt = document.createElement('span');
  nameElt.classList.add('property-select-name');
  nameElt.textContent = name;
  nameElt.title = name;
  elt.appendChild(nameElt);

  if (!ruleFragment) {
    this.elt.appendChild(elt);
    return;
  }

  const property = getProperty(ruleFragment);
  if (!property) {
    this.updateOption(elt);
    this.elt.appendChild(elt);
    return;
  }

  const stopPropagation = (e) => {
    e.stopPropagation();
  };

  if (property.type === 'number' || property.type === 'integer') {
    let ltOption, gtOption, eqOption;
    if (ruleFragment.trigger) {
      ltOption = document.createElement('option');
      ltOption.textContent = '<';
      ltOption.classList.add('lt-option');

      if (property.type === 'integer') {
        eqOption = document.createElement('option');
        eqOption.textContent = '=';
        eqOption.classList.add('eq-option');
      }

      gtOption = document.createElement('option');
      gtOption.textContent = '>';
      gtOption.classList.add('gt-option');

      const select = document.createElement('select');
      select.appendChild(ltOption);
      if (property.type === 'integer') {
        select.appendChild(eqOption);
      }
      select.appendChild(gtOption);
      select.addEventListener('click', stopPropagation);
      elt.appendChild(select);
    }

    let valueInput, valueSelect;
    if (property.hasOwnProperty('enum') && property.enum.length > 0) {
      valueSelect = document.createElement('select');
      valueSelect.classList.add('value-select');

      for (const choice of property.enum) {
        const option = document.createElement('option');
        option.value = choice;
        option.innerText = choice;
        valueSelect.appendChild(option);
      }

      valueSelect.addEventListener('click', stopPropagation);
      elt.appendChild(valueSelect);
    } else {
      valueInput = document.createElement('input');
      valueInput.classList.add('value-input');
      valueInput.type = 'number';
      if (property.hasOwnProperty('multipleOf')) {
        valueInput.step = `${property.multipleOf}`;
      } else if (property.type === 'number') {
        valueInput.step = 'any';
      } else {
        valueInput.step = '1';
      }
      if (property.hasOwnProperty('minimum')) {
        valueInput.min = `${property.minimum}`;
      }
      if (property.hasOwnProperty('maximum')) {
        valueInput.max = `${property.maximum}`;
      }
      valueInput.addEventListener('click', stopPropagation);
      elt.appendChild(valueInput);
    }

    elt.addEventListener('change', () => {
      let value;
      if (valueInput) {
        value = parseFloat(valueInput.value);
      } else {
        value =
          parseFloat(valueSelect.options[valueSelect.selectedIndex].value);
      }

      if (property.hasOwnProperty('multipleOf')) {
        value = Math.round(value / property.multipleOf) * property.multipleOf;
      }
      if (property.type === 'integer') {
        value = parseInt(value);
      }
      if (property.hasOwnProperty('minimum')) {
        value = Math.max(value, property.minimum);
      }
      if (property.hasOwnProperty('maximum')) {
        value = Math.min(value, property.maximum);
      }

      if (valueInput) {
        valueInput.value = value;
      }

      if (ruleFragment.trigger) {
        if (ltOption.selected) {
          ruleFragment.trigger.levelType = 'LESS';
        } else if (gtOption.selected) {
          ruleFragment.trigger.levelType = 'GREATER';
        } else if (property.type === 'integer' && eqOption.selected) {
          ruleFragment.trigger.levelType = 'EQUAL';
        }
        ruleFragment.trigger.value = value;
      } else {
        ruleFragment.effect.value = value;
      }
      this.devicePropertyBlock.rulePart = ruleFragment;
      this.devicePropertyBlock.onRuleChange();
      elt.dataset.ruleFragment = JSON.stringify(ruleFragment);
    });
  } else if (property.type === 'string') {
    let valueInput, valueSelect;
    if (property.hasOwnProperty('enum') && property.enum.length > 0) {
      valueSelect = document.createElement('select');
      valueSelect.classList.add('value-select');

      for (const choice of property.enum) {
        const option = document.createElement('option');
        option.value = choice;
        option.innerText = choice;
        valueSelect.appendChild(option);
      }

      valueSelect.addEventListener('click', stopPropagation);
      elt.appendChild(valueSelect);
    } else {
      valueInput = document.createElement('input');
      valueInput.classList.add('value-input');
      if (property.name === 'color') {
        valueInput.type = 'color';
      } else {
        valueInput.type = 'text';
      }
      valueInput.addEventListener('click', stopPropagation);
      elt.appendChild(valueInput);
    }

    elt.addEventListener('change', () => {
      let value;
      if (valueInput) {
        value = valueInput.value;
      } else {
        value = valueSelect.options[valueSelect.selectedIndex].value;
      }

      const dpbRulePart = this.devicePropertyBlock.rulePart;
      let selected = !dpbRulePart;
      if (ruleFragment.trigger) {
        ruleFragment.trigger.value = value;
        selected = selected || (dpbRulePart.trigger &&
          dpbRulePart.trigger.type === ruleFragment.trigger.type);
      } else {
        ruleFragment.effect.value = value;
        selected = selected || (dpbRulePart.effect &&
          (dpbRulePart.effect.property.id ===
           ruleFragment.effect.property.id) &&
          (dpbRulePart.effect.property.thing ===
           ruleFragment.effect.property.thing));
      }
      elt.dataset.ruleFragment = JSON.stringify(ruleFragment);

      if (selected) {
        this.devicePropertyBlock.rulePart = ruleFragment;
        this.devicePropertyBlock.onRuleChange();
      }
    });
  }

  this.updateOption(elt);

  this.elt.appendChild(elt);
};

PropertySelect.prototype.updateOption = function(optionElt) {
  const ruleFragment = JSON.parse(optionElt.dataset.ruleFragment);

  if (!ruleFragment) {
    return;
  }

  const property = getProperty(ruleFragment);
  if (!property) {
    return;
  }

  const fragmentValue = ruleFragment.trigger ?
    ruleFragment.trigger.value :
    ruleFragment.effect.value;

  const input = optionElt.querySelector('.value-input') ||
    optionElt.querySelector('.value-select');

  if (property.type === 'number' || property.type === 'integer') {
    if (ruleFragment.trigger) {
      if (ruleFragment.trigger.levelType === 'GREATER') {
        optionElt.querySelector('.gt-option').setAttribute('selected', '');
      } else if (property.type === 'integer' &&
                 ruleFragment.trigger.levelType === 'EQUAL') {
        optionElt.querySelector('.eq-option').setAttribute('selected', '');
      } else {
        optionElt.querySelector('.lt-option').setAttribute('selected', '');
      }
    }
    input.value = fragmentValue;
  } else if (property.name === 'color' || property.type === 'string') {
    input.value = fragmentValue;
  }
};

/**
 * Updates available options based on the PropertySelector's
 * DevicePropertyBlock's role.
 * @param {'trigger'|'effect'} role
 */
PropertySelect.prototype.updateOptionsForRole = function(role) {
  if (this.role === role) {
    return;
  }
  this.role = role;

  this.clearOptions();

  for (const propName of Object.keys(this.thing.properties)) {
    const property =
      JSON.parse(JSON.stringify(this.thing.properties[propName]));

    if (!property.name) {
      property.name = propName;
    }

    const links = property.links.filter((l) => !l.rel || l.rel === 'property');
    if (links.length === 0) {
      continue;
    }

    property.id = RuleUtils.extractProperty(links[0].href);
    property.thing = RuleUtils.extractThing(links[0].href);
    delete property.links;

    const name = property.title || Utils.capitalize(property.name);
    if (role === 'trigger') {
      if (property.type === 'boolean') {
        const triggerOn = {
          type: 'BooleanTrigger',
          property: property,
          onValue: true,
          label: name,
        };
        const triggerOff = Object.assign({}, triggerOn, {
          onValue: false,
        });
        let onName = name;
        let offName = `Not ${onName}`;
        if (property.name === 'on') {
          onName = 'On';
          offName = 'Off';
        }
        this.addOption(onName, {
          trigger: triggerOn,
        });
        this.addOption(offName, {
          trigger: triggerOff,
        });
      } else if (property.type === 'string') {
        let value = '';
        if (property.name === 'color') {
          value = '#ffffff';
        }
        this.addOption(name, {
          trigger: {
            type: 'EqualityTrigger',
            property: property,
            value: value,
            label: name,
          },
        });
      } else if (property.type === 'number' || property.type === 'integer') {
        const max = property.maximum || 0;
        const min = property.minimum || 0;
        const value = Math.round((max + min) / 2);

        this.addOption(name, {
          trigger: {
            type: 'LevelTrigger',
            property: property,
            levelType: 'LESS',
            value: value,
            label: name,
          },
        });
      }
    } else if (role === 'effect') {
      if (property.readOnly) {
        continue;
      }

      if (property.type === 'boolean') {
        const effectOn = {
          type: 'PulseEffect',
          property: property,
          value: true,
          label: name,
        };
        const effectOff = Object.assign({}, effectOn, {
          value: false,
        });
        let onName = name;
        let offName = `Not ${onName}`;
        if (property.name === 'on') {
          onName = 'On';
          offName = 'Off';
        }
        this.addOption(onName, {
          effect: effectOn,
        });
        this.addOption(offName, {
          effect: effectOff,
        });
      } else if (property.name === 'color') {
        this.addOption(name, {
          effect: {
            type: 'PulseEffect',
            property: property,
            value: '#ffffff',
            label: name,
          },
        });
      } else if (property.type === 'string') {
        this.addOption(name, {
          effect: {
            type: 'PulseEffect',
            property: property,
            value: 'text',
            label: name,
          },
        });
      } else if (property.type === 'number' || property.type === 'integer') {
        const max = property.maximum || 0;
        const min = property.minimum || 0;
        const value = (max + min) / 2;
        this.addOption(name, {
          effect: {
            type: 'PulseEffect',
            property: property,
            value: value,
            label: name,
          },
        });
      }
    }
  }
  if (role === 'trigger') {
    this.addEventOptions();
  } else if (role === 'effect') {
    this.addActionOptions();
  }
};

PropertySelect.prototype.addEventOptions = function() {
  for (const name of Object.keys(this.thing.events)) {
    const label =
      this.thing.events[name].title || this.thing.events[name].label || name;
    const eventTrigger = {
      type: 'EventTrigger',
      thing: RuleUtils.extractThing(this.thing.href),
      event: name,
      label,
    };
    this.addOption(`Event "${eventTrigger.label}"`, {
      trigger: eventTrigger,
    });
  }
};

PropertySelect.prototype.addActionOptions = function() {
  for (const name of Object.keys(this.thing.actions)) {
    if (this.thing.actions[name].input) {
      continue;
    }
    const label =
      this.thing.actions[name].title || this.thing.actions[name].label || name;
    const actionEffect = {
      type: 'ActionEffect',
      thing: RuleUtils.extractThing(this.thing.href),
      action: name,
      label,
      parameters: {},
    };
    this.addOption(`Action "${actionEffect.label}"`, {
      effect: actionEffect,
    });
  }
};

/**
 * Select an option when the user clicks it
 * @param {Event} e
 */
PropertySelect.prototype.onClick = function(e) {
  this.elt.classList.toggle('open');
  if (!this.elt.classList.contains('open')) {
    let target = e.target;
    if (!target.classList.contains('property-select-option')) {
      target = target.parentNode;
    }

    // We were open, so that was a click to select
    this.select(target);

    const rulePart = JSON.parse(target.dataset.ruleFragment);
    if (!rulePart) {
      return;
    }

    this.devicePropertyBlock.rulePart = rulePart;
    this.devicePropertyBlock.elt.classList.remove('open');
    this.devicePropertyBlock.onRuleChange();
  } else {
    this.devicePropertyBlock.elt.classList.add('open');
  }
};

function propertyEqual(a, b) {
  if ((!a) && (!b)) {
    return true;
  }

  return a && b &&
    a.type === b.type &&
    a.id === b.id &&
    a.thing === b.thing;
}

function getProperty(ruleFragment) {
  return ruleFragment.trigger ?
    ruleFragment.trigger.property :
    ruleFragment.effect.property;
}

function ruleFragmentEqual(a, b) {
  if ((!!a) !== (!!b)) {
    return false;
  }
  if (a.trigger && !b.trigger) {
    return false;
  }
  if (a.effect && !b.effect) {
    return false;
  }

  const aPart = a.trigger || a.effect;
  const bPart = b.trigger || b.effect;

  const aProperty = getProperty(a);
  const bProperty = getProperty(b);

  if (!propertyEqual(aProperty, bProperty)) {
    return false;
  }

  if (aPart.type.match(/(Set|Pulse)Effect/)) {
    if (!bPart.type.match(/(Set|Pulse)Effect/)) {
      return false;
    }
  } else if (aPart.type !== bPart.type) {
    return false;
  }

  if (aProperty && aProperty.type === 'boolean') {
    if (a.trigger) {
      return aPart.onValue === bPart.onValue;
    } else {
      return aPart.value === bPart.value;
    }
  }
  if (aPart.type === 'EventTrigger') {
    return aPart.event === bPart.event;
  }
  if (aPart.type === 'ActionEffect') {
    return aPart.action === bPart.action;
  }
  return true;
}

/**
 * Select an option by value
 * @param {Object} ruleFragment
 */
PropertySelect.prototype.selectByRuleFragment = function(ruleFragment) {
  const elements = this.elt.querySelectorAll('.property-select-option');
  for (const optionElt of elements) {
    const optionRuleFragment = JSON.parse(optionElt.dataset.ruleFragment);
    if (ruleFragmentEqual(optionRuleFragment, ruleFragment)) {
      optionElt.dataset.ruleFragment = JSON.stringify(ruleFragment);
      this.updateOption(optionElt);
      this.select(optionElt);
      return;
    }
  }
};

/**
 * Select a specific option
 * @param {Element} option - option's corresponding element
 */
PropertySelect.prototype.select = function(optionElt) {
  const selected = this.elt.querySelector('.selected');
  if (selected) {
    if (!JSON.parse(selected.dataset.ruleFragment)) {
      if (selected === optionElt) {
        return;
      }
      this.elt.removeChild(selected);
    } else {
      selected.classList.remove('selected');
    }
  }
  optionElt.classList.add('selected');
};

module.exports = PropertySelect;
