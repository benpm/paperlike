# Loot and Loot Phrases
Loot is generated prodecurally in chests, monster carcasses, graves, etc. The number, type, rarity, value, and other properties of these items can be specified using "loot phrases".

## Examples
- `num=1-3` : 1 to 3 common generic items
- `num=2,rare,food` : 2 rare food items
- `num=4-10,food,generic` : 4-10 common food or generic items
- `num=1,rare,any` : 1 rare item from any category
- `num=3,val=1-5` : 3 common generic items ranging from 1 to 5 gold in base value
- `num=1,mythical,weapon` : 1 mythical unique weapon

## Tags
Tags are the elements of a loot phrase that have specific values or ranges.
- Number of items: `num=a-b, num=n` where the value is either a range between a and b, or an exact value of n.
- Value in gold: `val=a-b` specifies a range of exact base price the items must hold

## Flags
Flags are the single-word elements of loot phrases. The types of flags are as follows:
- Rarity (essentially a rough value index): `common, rare, vrare, mythical`
- Category: `generic, food, weapon, armor, potion, charm`
