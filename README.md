# Paperlike

![](https://i.imgur.com/xQscIK4.gif)

## About
A small roguelike made for the kindle experimental browser. Should also work on most devices, including phones, tablets and PCs. You can find the [trello here](https://trello.com/b/D1EUAPSu/paperlike).

## Systems
Paperlike is built with the following schemes in mind:
- Modularity / hierarchy of containers. Example: `Stage -> Room -> Actor -> Stash -> Item -> Property`
- Game objects inherit their properties from their types. This means all properties of an item, prop or actor are modifiable.
- Every significant action requires stamina, which is regenerated at the end of your turn.
- Robust [loot generation system](https://github.com/Lemoncreme/paperlike/blob/master/guide/loot.md) based on phrases
- Every room of the dungeon is simulated "at once" (more about how this is done later). If your character leaves a room, you can come back and it will have experienced the same amount of time you have.

## Resources
Paperlike makes use of the following resources:
- [Material Icons](https://material.io/icons/)
- [chance.js](http://chancejs.com/)
- [sprintf.js](https://www.npmjs.com/package/sprintf-js)
- [js-yaml](https://github.com/nodeca/js-yaml)
