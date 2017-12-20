# Properties
Every item, prop, actor and tile in Paperlike has a set of properties. Every property can be modified for every instance of an object. Every type of object also has a set of default properties and property ranges.

## Resource Files
Resource files (like items.yml, actors.yml, etc.) are simply YAML files used to define types of objects. No entry is required to specify a property besides its own name, which is the "key". Here's an example taken from items.yml:
```YAML
_defaults:
  category: misc
  slot: ""
  damage: 0
  _damage_weapon_range: [1, 99]
  weight: 0
  durability: 0
  armor: 0
  heal: 0
  rarity: common

knife:
  category: weapon
  slot: hand
  damage: 1
  weight: 1
  durability: 1
```
`_defaults` is the object that specifies the default property values for items. If you need a property to exist in every instance of this class, you must specify it in the defaults.

The defaults object also specifies property ranges.

## Ranges
Property range specification makes it easy to set bounds for some properties depending on their context. Every part of the range must begin with an underscore. For example:
```
_weight_armor_range: [1, 10]
```
This statement has a few important bits.

- `weight` - This is the property that the range effects.
- `armor` - This is the category that the range effects. (Can also be a rarity)
- `range` - The type of boundary. Valid values are `range, min, max`
- `[1, 10]` - The actual boundary values.

In summary, this statement bounds all weight properties of armor-type items between 1 and 10 inclusively.

## Application
A question you might have right now is "wait, when are these bounds actually checked and applied?"
Any time an object's properties are changed or assigned, the bounds are applied for every property. For the moment, this only means when the object is created. In the future this could also include when an actor's properties are modified by some item or other.