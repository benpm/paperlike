/* global sprintf, YAML */

//Error messages for Kindle Paperwhite
window.addEventListener("error", function (e) { alert(e.message + ":" + e.lineno); }, true);


////Globals

//Sprintf.js
var s = sprintf;

//DOM Elements
var $room, $inv, $bInv, $islots, $iname, $idesc, $iequip, $acts, $hp, $st;
//Misc. globals
var width, height, xcol, 
	xrow, player, controls, room, actions;
//Types of tiles
var t = {};
//Types of actors
var actorTypes = {};
//Types of props
var propTypes = {};
//Types of items
var itemTypes = {};


//// Game Functions

//Simplify strings
function strimplify(str) {
	return str.replace(/[aeiou]/g, "").replace(/[^A-z \d.,:]/g, "").replace(/,/g, ", ");
}
//Redraw inventory boxes
function invdraw() {
	var index = 0;
	for (index = 0; index < player.stash.max; index++) {
		$islots[index].innerText = ".";
	}
	index = 0;

	player.stash.items.forEach(function(item) {
		$islots[index].innerText = strimplify(item.name);
		if (item.equipped)
			$islots[index].className = "equip";
		else
			$islots[index].className = "";		
		index ++;
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
	var extras = "";
	$acts.innerHTML = "";
	actions.forEach(function(action) {
		//Assign extra info string
		extras = "";
		if (action.constructor.name == "Prop")
			extras += " [" + action.stash.items.length + "] items";
		if (action.hp)
			extras += " (" + action.hp + " HP)";
		
		//Write in DOM
		$acts.innerHTML += s("<p> -> %s %s %s </p>",
			action.constructor.name == "Actor" ? "attack " :
			action.constructor.name == "Prop" ? "loot " : "interact ",
			action.name, extras);
	}, this);
	for (var i = 0; i < $acts.children.length; i++) {
		var action = actions[i];
		//Assign interact function
		$acts.children[i].onmousedown = function () {
			if (action.interact) {
				player.interact(action);
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
	$hp.innerText = s("HP: %d/%d", player.hp, player.maxhp);
	$st.innerText = s("ST: %d/%d", player.stamina, player.maxstamina);
}
//Click on inventory DOM
function invent(dom) {
	//Reset other selected
	Object.values($islots).forEach(function(slot) {
		slot.id = "";
	}, this);

	//Select
	dom.id = dom.id ? "" : "select";

	//Set inspector
	var item = player.stash.items[parseInt(dom.getAttribute("index"))];
	$iname.innerHTML = item ? item.name : "";
	$idesc.innerHTML = item ? strimplify(JSON.stringify(item)) : "";
	$iequip.src = "img/unchecked.svg";
	$iequip.style.opacity = 0.2;
	if (item && item.equippable) {
		$iequip.src = item.equipped ? "img/checked.svg" : "img/unchecked.svg";
		$iequip.style.opacity = 1;
	}
}
//Equip button is pressed
function invEquip() {
	//Select and equip if equippable
	var item = invSelected();
	if (!item.equippable) return;
	else player.stash.equip(item);

	//Redraw / reinspect item
	invdraw();
	invent(document.getElementById("select"));
}
//Returns selected item
function invSelected() {
	return player.stash.items[parseInt(document.getElementById("select").getAttribute("index"))];
}
//Display alert on error
function handleError(error) {
	if (error.message)
		alert(error.message);
}
//Returns random integer
function randint(a, b) {
	return Math.floor(Math.random() * (b - a + 1)) - b;
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
//Begin
function begin() {

	//Tile definitions
	new Tile("floor", ".", {});
	new Tile("wall", "=", {solid: true});
	new Tile("bound", " ", {solid: true});

	//DOM Association
	$room = document.getElementById("room");
	$inv = document.getElementById("inv");
	$bInv = document.getElementById("invbutton");
	$iname = document.getElementById("iname");
	$idesc = document.getElementById("idesc");
	$islots = document.getElementsByTagName("td");
	$iequip = document.getElementById("iequip");
	$acts = document.getElementById("actions");
	$hp = document.getElementById("hp");
	$st = document.getElementById("st");

	//Style setup
	window.addEventListener("resize", updateStyle);
	updateStyle();

	//Stage setup
	width = 31;
	height = 11;
	xcol = width - 1;
	xrow = height - 1;

	//Player setup
	player = new Actor("player", Math.floor(width/2), Math.floor(height/2));
	player.stash.add(new Item("sword"));
	player.stash.equip(player.stash.items[0]);

	//Controls
	document.addEventListener("keydown", keyinput);

	//Generate room
	room = new Room();
	room.actors.push(player);

	//First update
	room.redraw();
}


//// Global Game Objects

//Entire display
var Stage = {
	scene: "game",
	setscene: function (scene) {
		switch (this.scene) {
			case "game":
				$room.style.display = "none";
				break;
			case "inv":
				$inv.style.display = "none";
				$bInv.className = "";
				break;
		}
		this.scene = scene;
		switch (scene) {
			case "game":
				$room.style.display = "";
				break;
			case "inv":
				invdraw();
				$inv.style.display = "";
				$bInv.className = "disabled";
				break;
			case "char": break;
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
	actorTypes[symbol] = actorTypes[name] = this;
}
//Individual actor
function Actor(actype, x, y, props) {
	//Assign properties
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
		this.x += dx;
		this.y += dy;
		return true;
	};
	//Update actor
	this.update = function () {
		//Check for death
		if (this.hp <= 0) {
			room.add(new Prop("carcass", this.x, this.y));
			room.remove(this);
			console.debug("Actor died: ", this);
			return;
		}
		//Regain stamina
		if (this.hp > this.maxhp / 2)
			this.stamina += this.strength;
		else
			this.hp += this.strength;	
		if (this.stamina > this.maxstamina)
			this.stamina = this.maxstamina;	
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
		if (this.stamina > 0) {
			who.hp -= this.attack();
			this.stamina -= 2;
		}
	};
	//Calculates total damage this actor can inflict
	this.attack = function (multiplier) {
		var dmg = 0;
		if (this.stash.slot("hand"))
			dmg += this.stash.slot("hand").damage;
		return Math.max(Math.ceil(dmg * (multiplier || 1)), 1);
	};
}
//Type of object
function Proptype(name, symbol, props) {
	this.name = name;
	this.symbol = symbol;
	this.solid = Boolean(props.solid);
	propTypes[symbol] = propTypes[name] = this;
}
//Individual actor
function Prop(ptype, x, y, props) {
	//Merge
	Object.assign(this, propTypes[ptype], props);
	this.x = x;
	this.y = y;
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
		if (this.items.length <= this.max)
			this.items.push(item);
	};
	//Removes an item based on criterion
	this.remove = function (criteria) {
		//@todo: remove based on properties
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
			} else if (!item.equipped && this.equipped.indexOf(item) == - 1) {
				//Swaps with item currently in slot
				this.unslot(item.slot);
				item.equipped = true;
				this.equipped.push(item);
			}
		}
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

	//Parses a stash generator spec string
	var specs = specify.split(",");
	var generate = false;
	specs.forEach(function(spec) {
		var tag = spec.split("=")[0] || spec;
		var val = parseInt(spec.split("=")[1]) || 0;
		switch (tag) {
			case "max":
				this.max = val;
				break;
			case "gen":
				generate = true;
				break;
			case "random":
				this.add(Item("sword"));
				break;
		}
	}, this);
}
//Type of item
function Itemtype(name, props) {
	this.name = name;
	this.slot = props.slot || "";
	this.equippable = (this.slot != "");
	this.category = props.cat || "misc";
	this.damage = props.dmg || 0;
	this.speed = props.spd || 0;
	this.durability= props.dur || 0;
	this.armor = props.armr || 0;
	this.heal = props.hp || 0;
	itemTypes[name] = this;
}
//Individual item
function Item(itype, props) {
	Object.assign(this, itemTypes[itype], props);
	this.equipped = false;
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
	this.add(new Actor("rat", 3, 3));
	this.add(new Actor("rat", 10, 5));
	var testchest = this.add(new Prop("chest", 1, 1));
	testchest.stash.add(new Item("knife", { damage: 10, name: "HELLA knife" }));
	testchest.stash.add(new Item("apple"));
}

//Load resources
alert(s("%t,%t,%t", Object.assign, Object.values, Object.entries));
var toload = 3;
reqYaml("resource/actors.yml", Actype, function () { toload--; });
reqYaml("resource/items.yml", Itemtype, function () { toload--; });
reqYaml("resource/props.yml", Proptype, function () { toload--; });
function loader() {
	if (toload > 0)
		setTimeout(loader, 150);
	else
		begin();
}
loader();
