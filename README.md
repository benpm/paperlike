# Paperlike

## About
A small roguelike made for the kindle experimental browser. Should also work on most devices, including phones, tablets and PCs.

## Systems
Paperlike is built with the following schemes in mind:
- Hierarchy of containers. Example: `Stage -> Room -> Actor -> Stash -> Item -> Property`
- Game objects inherit their properties from their types. This means all properties of an item, prop or actor are modifiable.
- Every significant action requires stamina, which is regenerated at the end of your turn.

## Resources
Paperlike makes use of the following resources:
- [Material Icons](https://material.io/icons/)
- [chance.js](http://chancejs.com/)
- [sprintf.js](https://www.npmjs.com/package/sprintf-js)
