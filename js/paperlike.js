"use strict";

/* global sprintf, YAML, chance */

//Error messages for Kindle Paperwhite
window.addEventListener("error", function (e) { alert(e.message + ":" + e.lineno); }, true);


////Globals

//Sprintf.js
var s = sprintf;

//DOM Elements
var $room, $inv, $bInv, $islots,
	$iname, $idesc, $iequip, $acts,
	$hp, $st, $ar, $dmg, $turns,
	$exit, $msg, $itrash, $iuse;
//Misc. globals
var width, height, xcol,
	xrow, player, controls, room, actions, turns = 0;
//Types of tiles
var t = {};
//Types of actors
var actorTypes = {};
var actorCategories = {};
//Types of props
var propTypes = {};
var propCategories = {};
//Types of items
var itemTypes = {};
var itemCategories = {};
//Simplifying things
var int = parseInt;


//// Game Functions

//Simplify strings
function strimplify(str) {
	return str.replace(/[aeiou]/g, "").replace(/[^A-z \d.,:]/g, "").replace(/,/g, ", ");
}
//Redraw inventory boxes
function invdraw() {
	var i = 0;
	for (i = 0; i < 20; i++) {
		$islots[i].innerText = "/";
		$islots[i].className = "invalid";
	}
	for (i = 0; i < player.stash.max; i++) {
		$islots[i].innerText = ".";
		$islots[i].className = "";
	}

	i = 0;
	player.stash.items.forEach(function(item) {
		$islots[i].innerText = strimplify(item.name);
		if (item.equipped)
			$islots[i].className = "equip";
		else
			$islots[i].className = "";
		i ++;
	}, this);
}
//Set manual styles
function updateStyle() {
	var bevel = document.getElementById("bevel");
	bevel.style.width = (window.innerWidth - 32) + "px";
	bevel.style.height = (window.innerHeight - 48) + "px";
}
//Find possible actions
function getActions() {
	actions = [];

	//Actors
	room.actors.forEach(function(actor) {
		if (objdist(actor, player) == 1) {
			actions.push(actor);
		}
	}, this);

	//Props
	room.props.forEach(function(prop) {
		if (objdist(prop, player) <= 1) {
			actions.push(prop);
		}
	}, this);

	//Update actions list in DOM
	var extras = "", type;
	$acts.innerHTML = "";
	actions.forEach(function(action) {
		//Assign extra info string
		type = action.constructor.name;
		extras = "";
		if (type == "Prop")
			extras += " [" + action.stash.items.length + "] items";
		if (action.hp)
			extras += " (" + action.hp + " HP)";

		//Write in DOM
		$acts.innerHTML += s("<p class='%s'> %s %s %s %s </p>",
			type == "Prop" || player.stamina > 1 ? "" : "invalid",
			type == "Prop" || player.stamina > 1 ? "->" : "X",
			type == "Actor" ? "attack " :
			type == "Prop" ? "loot " : "interact ",
			action.name, extras);
	}, this);
	for (var i = 0; i < $acts.children.length; i++) {
		var action = actions[i];
		//Assign interact function
		if ($acts.children[i].className != "invalid")
		$acts.children[i].onmousedown = function () {
			if (action.interact) {
				if (type == "Actor") player.interact(action);
				action.interact(player);
				turn();
			} else
				console.warn("Missing interact for: ", action);
		};
	}
}
//After player taken turn
function turn() {
	room.update();
	getActions();
	$turns.innerText = s("turns: %d", turns);
	$hp.innerText = s("HP: %d/%d", player.hp, player.maxhp);
	$st.innerText = s("ST: %d/%d", player.stamina, player.maxstamina);
	$ar.innerText = s("AR: %d", player.armor());
	$dmg.innerText = s("DMG: %d", player.damage());
	turns++;
}
//Click on inventory DOM
function invent(dom) {
	//Reset other selected
	for (var i = 0; i < $islots.length; i++) {
		$islots[i].id = "";
	}

	//Select
	dom.id = dom.id ? "" : "select";

	//Set inspector
	var item = player.stash.items[parseInt(dom.getAttribute("index"))];
	$iname.innerHTML = item ? item.name : "";
	$idesc.innerHTML = item ? strimplify(JSON.stringify(item)) : "";
	$iequip.src = "img/unchecked.svg";
	$iequip.className = "invalid";
	$itrash.className = "invalid";
	$iuse.className = "invalid";
	if (item && item.equippable) {
		$iequip.src = item.equipped ? "img/checked.svg" : "img/unchecked.svg";
		$iequip.className = "";
	}
	if (item) {
		$itrash.className = "";
	}
	if (item && item.use()) {
		$iuse.className = "";
	}
}
//Equip button is pressed
function invEquip() {
	//Select and equip if equippable
	var item = invSelected();
	if (!item.equippable)
		return;
	else {
		if (player.stash.equip(item))
			turn();
	}

	//Redraw / reinspect item
	invdraw();
	invent(document.getElementById("select"));
}
//Equip button is pressed
function invDelete() {
	//Select and equip if equippable
	var item = invSelected();
	if (item.equipped)
		player.stash.equip(item);
	player.stash.remove(item);

	//Redraw / reinspect item
	invdraw();
	invent(document.getElementById("select"));
}
//Equip button is pressed
function invUse() {
	//Select and equip if equippable
	var item = invSelected();
	if (!item)
		return;
	if (item.use(player))
		player.stash.remove(item);

	//Redraw / reinspect item
	invdraw();
	invent(document.getElementById("select"));
}
//Returns selected item
function invSelected() {
	return player.stash.items[parseInt(document.getElementById("select").getAttribute("index"))];
}
//Returns random integer
function randint(a, b) {
	return chance.integer({min: a, max: b});
}
//Splits and parses string
function nint(string, n, sep) {
	return int(string.split(sep)[n]);
}
//Caps a number
function cap(n, max) {
	return Math.min(n, max);
}
//Returns chess distance
function dist(x1, y1, x2, y2) {
	return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
}
function objdist(a, b) {
	return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
//Handles keyboard input
function keyinput(event) {
	var key = "";

	if (event.key)
		key = event.key;
	else if (event.which)
		key = String.fromCharCode(event.which);
	else
		key = event;

	switch(key) {
		case "&":
		case "up":
		case "ArrowUp":
			if (player.move(0, -1))
				turn();
			break;
		case "(":
		case "down":
		case "ArrowDown":
			if (player.move(0, 1))
				turn();
			break;
		case "%":
		case "left":
		case "ArrowLeft":
			if (player.move(-1, 0))
				turn();
			break;
		case "'":
		case "right":
		case "ArrowRight":
			if (player.move(1, 0))
				turn();
			break;
	}
}
//Parses requested YAML file
function reqYaml(path, Type, decrement) {
	var req = new XMLHttpRequest();
	req.open("GET", path, true);
	req.send();
	req.onload = function() {
		console.debug("loaded " + path);
		var objects = YAML.parse(req.responseText);
		Object.entries(objects).forEach(function(obj) {
			new Type(obj[0],
				obj[1].sym || obj[1],
				obj[1]);
		}, this);
		decrement();
	};
}
//Finds element in array that matches position
function matchPos(array, x, y) {
	return array.find(function (n) {
		if (n.x == x && n.y == y)
			return true;
		else
			return false;
	});
}
//Loads several files
function multireq(paths, handlers) {
	var toload = paths.length;
	var end = function () { toload--; };
	var checker = function () {
		if (toload > 0)
			setTimeout(checker, 150);
		else
			begin();
	}
	for (var i = 0; i < paths.length; i++) {
		reqYaml(paths[i], handlers[i], end);
	}
	checker();
}
//Journals a message
function log(msg) {
	$msg.innerText = s("%s, then %s",
		$msg.innerText.split(", then ")[1] || $msg.innerText, msg);
	console.debug(msg);
}
//Run some compatiblity tests
function runtests() {
	alert(s("[RUNTESTS]\n\
		room.checksolid is % s\n\
		array.find is % s\n\
		matchPos is % s",
		typeof room.checksolid,
		typeof Array.prototype.find,
		typeof matchPos));
}
//Begin
function begin() {

	//DOM Association
	$room = document.getElementById("room");
	$inv = document.getElementById("inv");
	$bInv = document.getElementById("invbutton");
	$iname = document.getElementById("iname");
	$idesc = document.getElementById("idesc");
	$islots = document.getElementsByTagName("td");
	$iequip = document.getElementById("iequip");
	$itrash = document.getElementById("itrash");
	$iuse = document.getElementById("iuse");
	$acts = document.getElementById("actions");
	$hp = document.getElementById("hp");
	$st = document.getElementById("st");
	$ar = document.getElementById("ar");
	$dmg = document.getElementById("dmg");
	$turns = document.getElementById("turns");
	$exit = document.getElementById("exit");
	$msg = document.getElementById("msg");

	//Style setup
	window.addEventListener("resize", updateStyle);
	updateStyle();

	//Stage setup
	width = 31;
	height = 11;
	xcol = width - 1;
	xrow = height - 1;

	//Player setup
	player = new Actor("player",
		Math.floor(width / 2), Math.floor(height / 2), {name: "u"});
	player.stash.add(new Item("sword"));
	player.stash.equip(player.stash.items[0]);

	//Controls
	document.addEventListener("keydown", keyinput);

	//Generate room
	room = new Room();
	room.actors.push(player);

	//First update
	turn();
}


//// Global Game Objects

//Entire display
var Stage = {
	scene: "game",
	setscene: function (scene) {
		switch (this.scene) {
			case "game":
				$room.style.display = "none";
				$acts.style.display = "none";
				break;
			case "inv":
				$inv.style.display = "none";
				$bInv.className = "";
				$exit.style.display = "none";
				$bInv.style.display = "";
				break;
		}
		this.scene = scene;
		switch (scene) {
			case "game":
				$room.style.display = "";
				$acts.style.display = "";
				break;
			case "inv":
				invdraw();
				$inv.style.display = "";
				$bInv.style.display = "none";
				$exit.style.display = "";
				break;
		}
	}
};


//// Game Classes

//Type of tile
function Tile(name, symbol, props) {
	this.name = name;
	this.symbol = symbol;
	this.solid = props.solid || false;
	t[symbol] = t[name] = this;
}
//Type of actor
function Actype(name, symbol, props) {
	this.name = name;
	this.symbol = symbol;
	this.hp = props.hp || 10;
	this.stamina = props.stamina || 3;
	this.strength = props.strength || 1;
	this.armor = props.armor || 0;
	this.movet = props.movet || "wander";
	this.stash = props.stash;
	this.category = props.cat || "misc";
	actorTypes[name] = this;
	if (!actorCategories[this.category])
		actorCategories[this.category] = [];
	actorCategories[this.category].push(this.name);
}
//Individual actor
function Actor(actype, x, y, props) {
	//Assign properties
	this.type = actorTypes[actype].name;
	Object.assign(this, actorTypes[actype], props);
	this.x = x;
	this.y = y;
	this.maxhp = this.hp;
	this.maxstamina = this.stamina;

	//Initialize stash
	if (this.stash)
		this.stash = new Stash(this.stash);

	//Move action
	this.move = function (dx, dy) {
		//Fail move if solid in room
		if (room.checksolid(this.x + dx, this.y + dy))
			return false;

		//Otherwise, move and return true
		if (this.stamina > 0) {
			this.x += dx;
			this.y += dy;
		} else
			log(s("%s is too tired to move", this.name));
		return true;
	};
	//Update actor
	this.update = function () {
		//Check for death
		if (this.hp <= 0) {
			room.add(new Prop("carcass",
				this.x, this.y,
				{ stash: this.stash, name: s("%s's carcass", this.name) }));
			room.remove(this);
			log(s("%s died", this.name))
			return;
		}

		//Regain stamina OR hp
		if (chance.bool({likelihood: 80}))
			this.stamina += this.strength;
		else
			this.hp += this.strength;

		//Cap some properties
		this.stamina = cap(this.stamina, this.maxstamina);
		this.hp = cap(this.hp, this.maxhp);

		//Movement
		switch(this.movet) {
			case "wander":
				this.move(
					randint(-1, 1),
					randint(-1, 1));
				break;
		}
	};
	//Interaction with actor who
	this.interact = function (who) {
		var inHand = this.stash.slot("hand");
		var staminaCost = inHand ? inHand.weight : 0;

		if (this.stamina >= staminaCost) {
			//Apply damage to who
			var dmgGiven = this.attack();
			var dmgTaken = who.defend(dmgGiven);

			//Stamina cost
			this.stamina -= staminaCost;

			//Journal
			if (dmgGiven > 0 && dmgTaken > 0)
				log(s("%s hit %s for %d HP", this.name, who.name, dmgTaken));
			else if (dmgGiven == 0)
				log(s("%s missed", this.name));
		}
	};
	//Calculates total damage this actor can inflict
	this.damage = function (multiplier) {
		var dmg = 0;
		if (this.stash.slot("hand"))
			dmg += this.stash.slot("hand").damage;
		return Math.max(Math.ceil(dmg * (multiplier || 1)), 1);
	};
	//Calculates a turn of attack (with randomness)
	this.attack = function (multiplier) {
		//Total miss
		if (chance.bool({ likelihood: 10 }))
			return 0;

		//Calculate damage
		return this.damage(multiplier) + randint(-1, 1);
	};
	//Calculates and applies incoming damage
	this.defend = function (dmg) {
		var total = Math.max(0, dmg - this.armor());
		this.hp -= total;
		if (total == 0)
			log(s("%s defended", this.name))
		return total;
	};
	//Calculates total armor an actor has
	this.armor = function (multiplier) {
		var armor = 0;
		if (this.stash.slot("chest"))
			armor += this.stash.slot("chest").armor;
		if (this.stash.slot("head"))
			armor += this.stash.slot("head").armor;
		if (this.stash.slot("legs"))
			armor += this.stash.slot("legs").armor;
		if (this.stash.slot("feet"))
			armor += this.stash.slot("feet").armor;
		return Math.max(Math.ceil(armor * (multiplier || 1)), 0);
	};
}
//Type of object
function Proptype(name, symbol, props) {
	this.name = name;
	this.symbol = symbol;
	this.solid = Boolean(props.solid);
	this.category = props.cat || "misc";
	propTypes[symbol] = propTypes[name] = this;
	if (!propCategories[this.category])
		propCategories[this.category] = [];
	propCategories[this.category].push(this.name);
}
//Individual actor
function Prop(ptype, x, y, props) {
	//Merge
	this.type = propTypes[ptype].name;
	Object.assign(this, propTypes[ptype], props);
	this.x = x;
	this.y = y;
	if (typeof this.stash != "object")
		this.stash = new Stash(this.stash || "");
	this.interact = function () {
		if (this.stash.items.length) {
			this.stash.transfer(player.stash);
		}
	}
}
//Collection of items
function Stash(specify) {
	this.max = 5;
	this.items = [];
	this.equipped = [];

	//Adds an item to the stash
	this.add = function (item) {
		if (this.items.length < this.max)
			this.items.push(item);
	};
	//Removes an item based on criterion
	this.remove = function (item) {
		this.items.splice(this.items.indexOf(item), 1);
	};
	//Transfers an item from the top of this to other stash
	this.transfer = function (stash) {
		stash.add(this.items.pop());
	};
	//Toggles equip on item, swaps within slots
	this.equip = function (item) {
		if (this.items.indexOf(item) != - 1) {
			if (item.equipped && this.equipped.indexOf(item) != - 1) {
				//Unequips item
				item.equipped = false;
				this.equipped.splice(this.equipped.indexOf(item), 1);
				log(s("u unequipped %s", item.name));
				return true;
			} else if (!item.equipped && this.equipped.indexOf(item) == - 1) {
				//Swaps with item currently in slot
				this.unslot(item.slot);
				item.equipped = true;
				this.equipped.push(item);
				log(s("u equipped %s", item.name));
				return true;
			}
		}
		return false;
	};
	//Gets item in virtual slot
	this.slot = function (slot) {
		for (var i = 0; i < this.equipped.length; i++) {
			if (this.equipped[i].slot == slot)
				return this.equipped[i];
		}
		return undefined;
	};
	//Unequips item in slot
	this.unslot = function (slot) {
		this.equipped.forEach(function(item) {
			if (item.slot == slot)
				this.equip(item);
		}, this);
	};

	//Parses a loot phrase
	var specs = specify.split(",");
	var num = 0,
		names = [];
	specs.forEach(function (spec) {
		//Parse word
		var tag = spec.split("=")[0] || spec;
		var val = spec.split("=")[1] || "";

		//Operate on word
		switch (tag) {
			case "max":
				this.max = int(val);
				break;
			case "num":
				num = randint(
					nint(val, 0, "-"),
					nint(val, 1, "-") || (nint(val, 0, "-") + 1));
				break;
			default:
				names.push(tag);
				break;
		}
	}, this);

	//Generate stash from phrase
	if (num > 0) {
		if (names.length == 0)
			names = Object.keys(itemTypes)
		for (var i = 0; i < num; i++) {
			this.add(new Item(chance.pickone(names)));
		}
	}
}
//Type of item
function Itemtype(name, props) {
	this.name = name;
	this.slot = props.slot || "";
	this.equippable = (this.slot != "");
	this.category = props.category || "misc";
	this.damage = props.damage || 0;
	this.weight = props.weight || 0;
	this.speed = 5 - this.weight;
	this.durability = props.durability || 0;
	this.armor = props.armor || 0;
	this.heal = props.heal || 0;
	itemTypes[name] = this;
	if (!itemCategories[this.category])
		itemCategories[this.category] = [];
	itemCategories[this.category].push(this.name);
}
//Individual item
function Item(itype, props) {
	this.type = itemTypes[itype].name;
	Object.assign(this, itemTypes[itype], props);
	this.equipped = false;
	this.use = function (who) {
		//Return true if item was used
		try {
			switch (this.category) {
				case "food":
					who.hp += this.heal;
					break;
				default:
					return false;
			}
		} catch (error) {
			if (error instanceof TypeError)
				return true;
			else throw error
		}
		if (who === player)
			turn();
		return true;
	}
}
//Individual room
function Room() {
	//Definitions
	this.tiles = "";
	this.actors = [];
	this.props = [];

	//Generate room
	this.generate = function () {
		var newroom = "", tile = "floor";
		for (var y = 0; y < height; y++) {
			for (var x = 0; x < width; x++) {
				tile = "floor";

				if (
					(x == 0 ||
						y == 0 ||
						x == xcol ||
						y == xrow)
					&& x != xcol / 2
					&& y != xrow / 2)
					tile = "wall";

				newroom += t[tile].symbol;
			}
		}

		return newroom;
	};
	this.update = function () {
		for (var i = this.actors.length - 1; i >= 0; i--) {
			this.actors[i].update();
		}
		this.redraw();
	};
	this.tile = function (x, y) {
		if (x >= width || x < 0
			|| y >= height || y < 0)
			return t["bound"];
		else
			return t[this.tiles[y * width + x]];
	};
	this.redraw = function redraw() {
		var tile = "";
		$room.innerHTML = "";
		for (var y = 0; y < height; y++) {
			for (var x = 0; x < width; x++) {
				tile = this.tile(x, y).symbol;

				this.props.forEach(function (prop) {
					if (prop.x == x && prop.y == y)
						tile = prop.symbol;
				}, this);

				this.actors.forEach(function (actor) {
					if (actor.x == x && actor.y == y)
						tile = actor.symbol;
				}, this);

				$room.innerHTML += tile;
			}
			$room.innerHTML += "<br>";
		}
	};
	this.checksolid = function (x, y) {
		var match;

		//Tiles
		if (room.tile(x, y).solid)
			return true;

		//Search actors
		match = matchPos(this.actors, x, y);
		if (match) return true;

		//Search props
		match = matchPos(this.props, x, y);
		if (match && match.solid) return true;

		return false;
	};
	this.remove = function (obj) {
		if (obj.constructor.name == "Actor")
			this.actors.splice(this.actors.indexOf(obj), 1);
		else if (obj.constructor.name == "Prop")
			this.prop.splice(this.prop.indexOf(obj), 1);
	};
	this.add = function (obj) {
		if (obj.constructor.name == "Actor")
			this.actors.push(obj);
		else if (obj.constructor.name == "Prop")
			this.props.push(obj);
		return obj;
	};

	//Initialize
	this.tiles = this.generate();

	//@debug Some debuggin stuff
	for (var i = 0; i < 5; i++)
		this.add(new Actor(chance.pickone(actorCategories.monster),
			randint(1, xcol),
			randint(1, xrow), { name: chance.word({ syllables: 2 }) }));
	this.add(new Prop("chest", 1, 1, {stash: "num=1-5"}));
}


//Load resources
multireq(["resource/tiles.yml",
	"resource/actors.yml",
	"resource/props.yml",
	"resource/items.yml"],
	[Tile, Actype, Proptype, Itemtype]);
