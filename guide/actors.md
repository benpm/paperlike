# Actors
"Actor" is the generic name for any dynamic entity. This includes monsters, NPCs and the player. Actors have a certain set of properties, which will be explained in great detail here. The actors for the game are defined in the actors.yml file in the resources directory. This page also covers the difference between explicit and implicit properties.

## Properties
Explicit properties are those defined directly in actors.yml. They may or may not be used directly in-game.
Implicit properties are either stored in-game by each actor are calculated on-demand from other properties. Attack damage, for example, is an implicit property that references strength, equipped weapon, etc.

## Combat
Explicit:
- `hp`: The base max health this actor begins with. Like all other properties, this can be changed by modifiers.
- `stamina`: The energy level of the actor. A low stamina usually means you can't fight. Heavier weapons take more stamina to use.
- `strength`: This property determines the amount of stamina you gain back every turn, and the base damage the actor can inflict.
- `armor`: The base amount of damage that can be deflected. Default is zero.

Implicit:
- `damage`: The amount of damage the actor can inflict. This is a sum of damage modifiers (TBD), weapons and base damage.
- `attack`: This is the amount of damage *actually* inflicted upon another. It takes damage (see above) and subtracts or adds a random amount depending on (TBD).
- `defense`: The total armor value counting all equipped items. Used by `Actor.prototype.defend()` to calculate inflicted damage upon attack.

## Other Properties
- `symbol`: What is actually drawn to the game. Remember that different characters map to different images in the icon font.
- `category`: The "type" of actor. Usually set to "monster".
- `stash`: A [loot sentence](./loot.md). (An empty stash would just be "max=#")
- `behaviour`: The type of behaviour this actor will have. Valid values include follow, wander, ... (WIP)
