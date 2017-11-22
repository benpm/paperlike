"use strict";

/* global sprintf, YAML, chance, _ */

//Error messages for Kindle Paperwhite
window.addEventListener("error", function (e) { alert(e.message + ":" + e.lineno); }, true);


////Globals

//Sprintf.js
var _s = s;
var s = sprintf;
_.mixin({
	omitFromPrefix: function (obj, char) {
		return _.omit(obj, _.filter(_.keys(obj), function (t) { return t[0] == char }))
	}
});

//DOM Elements
var $room, $inv, $bInv, $islots,
	$iname, $idesc, $iequip, $acts,
	$hp, $st, $ar, $dmg, $turns,
	$exit, $msg, $itrash, $iuse;
//Misc. globals
var width, height, halfheight, halfwidth, xcol, restartKeys = 5,
	yrow, player, controls, gamepad = null, room, rooms = {}, actions, turns = 0,
	msgbuffer = [], lastbuttons = new Array(16), buttons = new Array(16);
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
//Types of item modifiers
var modTypes = {};
var modCategories = {};
//Simplifying things
var int = parseInt;
var float = parseFloat;


//// Game Functions

//Simplify strings
function strimplify(str) {
	return str.replace(/[aeiou]/g, "").replace(/[^A-z \d.,:]/g, "").replace(/,/g, ", ");
}
//Adds everything in args to shared members in obj
function sumMembers(obj) {
	var args = arguments;
	for (var i = 1; i < args.length; i++) {
		Object.keys(args[i]).forEach(function (key) {
			if (typeof args[i][key] == "number"
				&& typeof obj[key] == "number") {
				obj[key] += args[i][key];
			}
		});
	}
};
//Returns object with all falsy members omitted
function unFalsy(obj) {
	var newObj = {};
	_.keys(obj).forEach(function (key) {
		if (obj[key])
			newObj[key] = obj[key];	
	});
	return newObj;
};
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
	var extras = "", type, valid;
	$acts.innerHTML = "";
	actions.forEach(function(target) {
		//Assign extra info string
		type = target.constructor.name;
		extras = "";
		if (type == "Prop")
			extras += " [" + target.stash.items.length + "] items";
		if (target.hp)
			extras += " (" + target.hp + " HP)";
		
		//Determine validity
		valid = true;
		if ((type == "Actor" && player.stamina < player.weight())
			|| (type == "Prop" && player.stash.items.length >= player.stash.max)
			|| (type == "Prop" && target.stash.items.length == 0))
			valid = false;

		//Write in DOM
		$acts.innerHTML += s("<p class='%s'> %s %s %s %s </p>",
			valid ? "" : "invalid",
			type == "Prop" || player.stamina > 1 ? "->" : "X",
			type == "Actor" ? "attack " :
			type == "Prop" ? "loot " : "interact ",
			target.name, extras);
	}, this);

	//Assign interaction function
	for (var i = 0; i < $acts.children.length; i++) {
		if ($acts.children[i].className != "invalid")
			$acts.children[i].onmousedown = perfAction;
		$acts.children[i].setAttribute("index", i.toString());
	}
}
//Perform action
function perfAction() {
	player.interact(actions[int(this.getAttribute("index"))]);
	turn();
}
//After player taken turn
function turn() {
	if (room.actors.indexOf(player) == -1) {
		while ($acts.firstChild) { $acts.removeChild($acts.firstChild)}
		return;
	}
	room.update();
	getActions();
	$turns.innerText = s("turns: %d", turns);
	$hp.innerText = s("HP: %d/%d", player.hp, player.maxhp);
	$st.innerText = s("ST: %d/%d", player.stamina, player.maxstamina);
	$ar.innerText = s("AR: %d", player.armor());
	$dmg.innerText = s("DMG: %d", player.damage());
	$msg.innerText = msgbuffer.join(", then ");
	if (!$msg.innerText)
		$msg.innerText = "...";	
	msgbuffer.length = 0;
	turns++;
	if (player.hp <= 0) {
		turn();
		keyinput();
	}
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
	var desc = _.omit(unFalsy(item),
		"name", "category", "slot", "equippable", "equipped");
	$idesc.innerHTML = item ? strimplify(JSON.stringify(desc)) : "";
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
	if (item && item.use(player, false)) {
		$iuse.className = "";
	}
}
//Equip button is pressed
function invEquip() {
	//Invalid
	if (!$islots.select) return;

	//Select and equip if equippable
	var item = invSelected();
	if (!item.equippable)
		return;
	else {
		if (player.stash.equip(item))
			turn();
	}

	//Redraw / reinspect item
	invent(document.getElementById("select"));
	invdraw();
}
//Equip button is pressed
function invDelete() {
	//Invalid
	if (!$islots.select) return;

	//Select and equip if equippable
	var item = invSelected();
	if (item.equipped)
		player.stash.equip(item);
	player.stash.remove(item);

	//Redraw / reinspect item
	invent(document.getElementById("select"));
	invdraw();
}
//Equip button is pressed
function invUse() {
	//Invalid
	if (!$islots.select) return;

	//Select and equip if equippable
	var item = invSelected();
	if (!item)
		return;
	if (item.use(player, true))
		player.stash.remove(item);

	//Redraw / reinspect item
	invent(document.getElementById("select"));
	invdraw();
}
//Returns selected item
function invSelected() {
	return player.stash.items[parseInt($islots.select.getAttribute("index"))];
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
//Clamps a number
function clamp(n, min, max) {
	return Math.max(Math.min(n, max), min);
}
//Uses a generic bounding function f(n, ...args)
function bounded(func, n) {
	
}
//Non-negative modulo
function nmod(x, m) {
	return (x % m + m) % m;
}
//Replaces character in string
function repChar(str, i, chr) {
	return str.substr(0, i) + chr + str.substr(i + 1);
}
//Returns chess distance
function dist(x1, y1, x2, y2) {
	return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
}
function objdist(a, b) {
	return dist(a.x, a.y, b.x, b.y);
}
//Returns chess direction
function dir(x1, y1, x2, y2) {
	return [
		Math.sign(x2 - x1),
		Math.sign(y2 - y1)];
}
function objdir(a, b) {
	return dir(a.x, a.y, b.x, b.y);
}
//Handles keyboard input
function keyinput(event) {
	if (!event || room.actors.indexOf(player) == -1) {
		if (restartKeys <= 0)
			begin();
		else {
			$msg.innerText = s("u died; press %d keys to continue", restartKeys);
			restartKeys -= 1;
		}
		return;
	}
	
	var key = "";

	if (event.key)
		key = event.key;
	else if (event.which)
		key = String.fromCharCode(event.which);
	else
		key = event;

	switch (key) {
		case " ":
		case "Enter":
		case "Return":
			if (Stage.scene == "inv") {
				invUse();
				invEquip();
			}
			break;
		case "Delete":
		case "Backspace":
			if (Stage.scene == "inv")
				invDelete();
			break;	
		case "w":
		case "&":
		case "up":
		case "ArrowUp":
			if (Stage.scene == "game" && player.move(0, -1))
				turn();
			if (Stage.scene == "inv") {
				var index = 0;
				if ($islots.select)
					index = int($islots.select.getAttribute("index")) - 5;
				index = nmod(index, 20);
				invent($islots[index])
			}
			break;
		case "s":
		case "(":
		case "down":
		case "ArrowDown":
			if (Stage.scene == "game" && player.move(0, 1))
				turn();
			if (Stage.scene == "inv") {
				var index = 0;
				if ($islots.select)
					index = int($islots.select.getAttribute("index")) + 5;
				index = nmod(index, 20);
				invent($islots[index])
			}
			break;
		case "a":
		case "%":
		case "left":
		case "ArrowLeft":
			if (Stage.scene == "game" && player.move(-1, 0))
				turn();
			if (Stage.scene == "inv") {
				var index = 0;
				if ($islots.select)
					index = int($islots.select.getAttribute("index")) - 1;
				index = nmod(index, 20);
				invent($islots[index])
			}
			break;
		case "d":
		case "'":
		case "right":
		case "ArrowRight":
			if (Stage.scene == "game" && player.move(1, 0))
				turn();
			if (Stage.scene == "inv") {
				var index = 0;
				if ($islots.select)
					index = int($islots.select.getAttribute("index")) + 1;
				index = nmod(index, 20);
				invent($islots[index])
			}
			break;
		case "1":
			if (Stage.scene == "game" && 
				$acts.children[0] && $acts.children[0].onmousedown)
				$acts.children[0].onmousedown();
			break;
		case "2":
			if (Stage.scene == "game" && 
				$acts.children[1] && $acts.children[1].onmousedown)
				$acts.children[1].onmousedown();
			break;
		case "3":
			if (Stage.scene == "game" && 
				$acts.children[2] && $acts.children[2].onmousedown)
				$acts.children[2].onmousedown();
			break;
		case "4":
			if (Stage.scene == "game" && 
				$acts.children[3] && $acts.children[3].onmousedown)
				$acts.children[3].onmousedown();
			break;
		case "i":
		case "Escape":
		case "Tab":
			if (Stage.scene == "game")
				Stage.setscene("inv");
			else if (Stage.scene == "inv")
				Stage.setscene("game");
			break;
	}
}
//Gamepad input
function gamepadInput() {
	if (gamepad && gamepad.connected) {
		gamepad.buttons.forEach(function (button, i) {
			if (button.pressed || button.value) {
				if (!lastbuttons[i])
					buttons[i] = true;
				else
					buttons[i] = false;	
				//console.debug(button, i);
			} else {
				buttons[i] = false;
			}
			lastbuttons[i] = button.pressed;
		});
		if (buttons[14]) keyinput("left");
		if (buttons[15]) keyinput("right");
		if (buttons[12]) keyinput("up");
		if (buttons[13]) keyinput("down");
		if (buttons[0] && Stage.scene == "game") keyinput("1");
		if (buttons[0] && Stage.scene == "inv") keyinput(" ");
		if (buttons[1] && Stage.scene == "game") keyinput("2");
		if (buttons[1] && Stage.scene == "inv") keyinput("Delete");
		if (buttons[2]) keyinput("3");
		if (buttons[3]) keyinput("4");
		if (buttons[9]) keyinput("Escape");
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
		Type.defaults = objects["_defaults"];
		Type.defaults = _.omitFromPrefix(Type.defaults, "_");
		objects = _.omit(objects, "_defaults")
		Object.entries(objects).forEach(function (obj) {
			//Remove underscore-prepended properties
			new Type(
				obj[0],
				_.omitFromPrefix(obj[1], "_"));
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
		else {
			setup();
			begin();
		}
	}
	for (var i = 0; i < paths.length; i++) {
		reqYaml(paths[i], handlers[i], end);
	}
	checker();
}
//Journals a message
function log(msg) {
	msgbuffer.push(msg);
	console.debug(msg);
}
//Transitions to a new room
function transRoom(x, y) {
	//Swap out rooms, move player
	log(s("moved to %d,%d", x, y));
	var newRoom = rooms[[x, y]] || new Room(x, y);
	room.lastVisit = turns;
	room.remove(player);
	room = newRoom;

	//Simulate difference in turns
	if (room.lastVisit < turns - 1) {
		var turnsDiff = turns - room.lastVisit - 1;
		console.info(s("simulating %d turns...", turnsDiff));
		for (var i = 0; i < turnsDiff; i++) {
			room.update(true);
		}
	}

	//Add player back in
	room.add(player);

	//Move player to appropriate position
	if (player.x == xcol) player.x = 0;
	else if (player.x == 0) player.x = xcol;
	if (player.y == yrow) player.y = 0;
	else if (player.y == 0) player.y = yrow;
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

	//Player setup
	player = new Actor("player",
		Math.floor(width / 2), Math.floor(height / 2), {name: "u"});
	player.stash.add(new Item("sword"));
	player.stash.equip(player.stash.items[0]);

	//Generate room
	rooms.length = 0;
	room = new Room(0, 0);
	room.actors.push(player);

	//First update
	turn();
}
//Setup (one-time)
function setup() {

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
	width = 21;
	height = 15;
	xcol = width - 1;
	yrow = height - 1;
	halfwidth = xcol / 2;
	halfheight = yrow / 2;

	//Controls
	document.addEventListener("keydown", keyinput);
	gamepad = navigator.getGamepads()[0];
	if (gamepad) {
		setInterval(gamepadInput, 50);
	}
	console.debug(gamepad);
	window.addEventListener("gamepadconnected", function (e) {
		gamepad = e.gamepad;
		setInterval(gamepadInput, 50);
		console.debug(gamepad);
	});
}


//// Global Game Objects

//Entire display
var Stage = {
	scene: "game",
	setscene: function (scene) {
		//From...
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
				if (document.getElementById("select"))
					document.getElementById("select").id = "";
				break;
		}

		//To...
		this.scene = scene;
		switch (scene) {
			case "game":
				$room.style.display = "";
				$acts.style.display = "";
				getActions();
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
function Tile(name, props) {
	Object.assign(this, _.defaults(props, Tile.defaults));
	this.name = name;
	t[this.symbol] = t[name] = this;
}
//Type of actor
function Actype(name, props) {
	Object.assign(this, _.defaults(props, Actype.defaults));
	this.name = name;

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
	this.aggro = false;
	this.maxhp = this.hp;
	this.maxstamina = this.stamina;

	//Initialize stash
	if (this.stash) {
		this.stash = new Stash(this.stash);
		this.stash.parent = this;
		this.stash.autoEquip();
	}

	//Move action
	this.move = function (dx, dy) {
		//Fail move if solid in room
		if (room.checksolid(this.x + dx, this.y + dy)) {
			if (this === player &&
				room.tile(this.x + dx, this.y + dy).name == "bound") {
				transRoom(room.x - dx, room.y - dy);
				return true;
			}
			return false;
		}

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
			this.stash.forceUnequip();
			this.stash.parent = room.add(new Prop("carcass",
				this.x, this.y,
				{ stash: this.stash, name: s("%s's carcass", this.name) }));
			room.remove(this);
			log(s("%s died", this.name))
			return;
		}

		//Check for flee
		if (this.hp <= this.maxhp / 3)
			this.behaviour = "flee";

		//Regain stamina OR hp
		if (chance.bool({likelihood: 80}))
			this.stamina += this.strength;
		else
			this.hp += this.strength;

		//Cap some properties
		this.stamina = cap(this.stamina, this.maxstamina);
		this.hp = cap(this.hp, this.maxhp);

		//Movement
		switch(this.behaviour) {
			case "wander":
				this.move(
					randint(-1, 1),
					randint(-1, 1));
				break;
			case "follow":
				if (objdist(this, player) <= 2)
					this.move(
						objdir(this, player)[0],
						objdir(this, player)[1]
					);
				else
					this.move(
						randint(-1, 1),
						randint(-1, 1));
				this.aggro = true;
				break;
			case "flee":
				if (objdist(this, player) <= 5)
					this.move(
						-objdir(this, player)[0],
						-objdir(this, player)[1]
					);
				else
					this.move(
						randint(-1, 1),
						randint(-1, 1));
				this.aggro = false;
				break;
		}
		if (this !== player) {
			if (this.aggro && objdist(this, player) == 1)
				this.interact(player);
		}
	};
	//Interaction with actor who
	this.interact = function (who) {
		if (who.constructor.name == "Actor") {
			var staminaCost = this.weight();

			if (this.stamina >= staminaCost) {
				//Apply damage to who
				var dmgGiven = this.attack();
				var dmgTaken = who.defend(dmgGiven);

				//Stamina cost
				this.stamina -= staminaCost;

				//Journal
				if (dmgGiven > 0 && dmgTaken > 0)
					log(s("%s/%s -%d HP", this.name, who.name, dmgTaken));
				else if (dmgGiven == 0)
					log(s("%s missed", this.name));
			}
		} else {
			if (who.stash.items.length) {
				who.stash.transfer(player.stash);
			}
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
		if (total == 0 && dmg > 0)
			log(s("%s defended", this.name))
		this.aggro = true;
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
	//Calculates total carrying weight
	this.weight = function () {
		var inHand = this.stash.slot("hand");
		return inHand ? inHand.weight : 0;
	};
}
//Type of object
function Proptype(name, props) {
	Object.assign(this, _.defaults(props, Proptype.defaults));
	this.name = name;

	propTypes[this.symbol] = propTypes[name] = this;
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
}
//Collection of items
function Stash(specify) {
	this.max = 5;
	this.items = [];
	this.equipped = [];
	this.parent = null

	//Adds an item to the stash
	this.add = function (item) {
		if (this.items.length < this.max) {
			this.items.push(item);
			return item;
		} else
			return null;	
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
		var index = this.equipped.indexOf(item);
		if (this.items.indexOf(item) != - 1
			&& item.equippable) {
			if (item.equipped && index != - 1) {
				//Unequips item
				item.equipped = false;
				this.equipped.splice(index, 1);
				if (this.parent === player)
					log(s("u unequipped %s", item.name));
				return true;
			} else if (!item.equipped && index == - 1) {
				//Swaps with item currently in slot
				this.unslot(item.slot);
				item.equipped = true;
				this.equipped.push(item);
				if (this.parent === player)
					log(s("u equipped %s", item.name));
				return true;
			}
		}
		return false;
	};
	//Tries to equip everything in stash
	this.autoEquip = function () {
		this.items.forEach(function (item) {
			this.equip(item);
		}, this);
	};
	//Unequips everything in stash
	this.forceUnequip = function () {
		this.equipped.length = 0;
		this.items.forEach(function (item) {
			item.equipped = false;
		}, this);
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

	//Parses a loot sentence, then phrases, then terms
	var phrases = specify.split(" & ");
	phrases.forEach(function (phrase) {
		var skipPhrase = false;
		var specs = phrase.split(",");
		var num = 0,
			names = [];
		specs.forEach(function (spec) {
			//Parse word
			var tag = spec.split("=")[0] || spec;
			var val = spec.split("=")[1] || "";

			//Operate on word
			switch (tag) {
				case "p":
					if (Math.random() < int(val / 100.0))
						skipPhrase = true;
					break;	
				case "max":
					this.max = int(val);
					break;
				case "num":
					num = randint(
						nint(val, 0, "-"),
						nint(val, 1, "-") || (nint(val, 0, "-")));
					if (num > this.max)
						this.max = num;
					break;
				default:
					if (itemCategories[tag])
						names = _.union(names, itemCategories[tag]);
					else
						names.push(tag);
					break;
			}
		}, this);

		//Generate stash from phrase
		if (!skipPhrase && num > 0) {
			//Defaults to common items
			if (names.length == 0)
				names = itemCategories["common"];
			for (var i = 0; i < num; i++) {
				var item = this.add(new Item(chance.pickone(names)));

				//Apply a random modifier from rarity and modifers to new item
				if (chance.bool() && modCategories[item.category] && modCategories[item.rarity]) {
					var mods = _.intersection(modCategories[item.category], modCategories[item.rarity]);
					if (mods.length > 0)
						modTypes[chance.pickone(mods)].apply(item);
				}
			}
		}
	}, this);
}
//Type of item
function Itemtype(name, props) {
	Object.assign(this, _.defaults(props, Itemtype.defaults));

	this.name = name;
	this.equippable = (this.slot != "");
	this.speed = this.weight ? 5 - this.weight : 0;

	itemTypes[name] = this;
	if (!itemCategories[this.category])
		itemCategories[this.category] = [];
	itemCategories[this.category].push(this.name);
	if (!itemCategories[this.rarity])
		itemCategories[this.rarity] = [];
	itemCategories[this.rarity].push(this.name);
}
//Individual item
function Item(itype, props) {
	this.type = itemTypes[itype].name;
	Object.assign(this, itemTypes[itype], props);
	this.equipped = false;
	
	//Use this item in reference to some actor
	this.use = function (who, execute) {
		//Return true if item was used, only use if execute is true
		switch (this.category) {
			case "food":
				if (who.hp == who.maxhp)
					return false;	
				if (execute) {
					who.hp += this.heal;
					log(s("u ate %s, +%d HP", this.name, this.heal))
				} else {
					return true;
				}
				break;
			default:
				return false;
		}
		if (who === player)
			turn();
		return true;
	}
}
//Item modifier
function Mod(name, props) {
	Object.assign(this, props);
	this.name = name;
	this.addins = _.omit(this, "application", "name");

	this.apply = function (item) {
		sumMembers(item, this.addins);
		item.name = s("%s %s", this.name, item.name);
	};

	modTypes[name] = this;
	if (!modCategories[this.application])
		modCategories[this.application] = [];
	modCategories[this.application].push(this.name);
	if (!modCategories[this.rarity])
		modCategories[this.rarity] = [];
	modCategories[this.rarity].push(this.name);
}
//Individual room
function Room(x, y) {
	//Definitions
	this.tiles = "";
	this.data = Array(width * height);
	this.actors = [];
	this.props = [];
	this.x = x;
	this.y = y;
	this.lastVisit = turns;

	rooms[[x, y]] = this;
	var self = this;

	//Generate room
	this.gen = {
		wall: function (x1, y1, x2, y2) {
			for (var x = x1; x <= x2; x++) {
				for (var y = y1; y <= y2; y++) {
					self.tile(x, y, "wall");
				}
			}
		},
		hall: function (x1, y1, x2, y2) {
			for (var x = x1; x <= x2; x++) {
				for (var y = y1; y <= y2; y++) {
					self.tile(x, y, "floor");
					if (x2 == x1) {
						self.tile(x + 1, y, "wall");
						self.tile(x - 1, y, "wall");
					} else {
						self.tile(x, y + 1, "wall");
						self.tile(x, y - 1, "wall");
					}
				}
			}
		},
		isOpen: function (x, y, skipMake) {

			if (self.tile(x, y).name == "bound")
				return true;

			if (self.data[y * width + x])
				return false;
			
			self.data[y * width + x] = 1;

			if (self.checksolid(x, y))
				return false;	

			if (this.isOpen(x + 1, y, skipMake)) return true;
			if (this.isOpen(x - 1, y, skipMake)) return true;
			if (this.isOpen(x, y + 1, skipMake)) return true;
			if (this.isOpen(x, y - 1, skipMake)) return true;

			return false;
		},
		chop: function (x1, y1, x2, y2, dir) {
			//Prevents placing walls on exits
			if (x2 - x1 < 6 || y2 - y1 < 6)
				return;	
			
			if (dir) {
				//Vertical segment
				var x = randint(x1 + 3, x2 - 3);
				if (x == halfwidth)
					return;	
				this.wall(x, y1, x, y2);

				//Door
				if (chance.bool({ likelihood: 75 }))
					self.tile(x, randint(y1 + 1, y2 - 1), "floor");
				
				//Recursively split
				if (chance.bool())
					this.chop(x, y1, x2, y2, false);
				else
					this.chop(x1, y1, x, y2, false);				
			} else {
				//Horizontal segment
				var y = randint(y1 + 3, y2 - 3);
				if (y == halfheight)
					return;	
				this.wall(x1, y, x2, y);

				//Door
				if (chance.bool({ likelihood: 75 }))
					self.tile(randint(x1 + 1, x2 - 1), y, "floor");
				
				//Recursively split
				if (chance.bool())
					this.chop(x1, y, x2, y2, true);
				else
					this.chop(x1, y1, x2, y, true);	
			}
		}
	};
	this.generate = function () {
		//Fill with floor
		this.tiles = t["floor"].symbol.repeat(width * height);

		//List exits
		var exits = [
			[halfwidth, 0],
			[halfwidth, yrow],
			[0, halfheight],
			[xcol, halfheight]];
		
		//Create inner walls
		this.gen.chop(0, 0, xcol, yrow);

		//Create outer walls
		this.gen.wall(0, 0, xcol, 0);
		this.gen.wall(xcol, 0, xcol, yrow);
		this.gen.wall(0, yrow, xcol, yrow);
		this.gen.wall(0, 0, 0, yrow);

		//Actors
		for (var i = 0; i < randint(0, 6); i++) {
			var x = randint(1, xcol - 1);
			var y = randint(1, yrow - 1);
			if (this.tile(x, y).name == "floor")
				this.add(new Actor(chance.pickone(actorCategories["monster"]), x, y));
		}

		//Chests
		for (var i = 0; i < randint(0, 2); i++) {
			var x = randint(1, xcol - 1);
			var y = randint(1, yrow - 1);
			if (this.tile(x, y).name == "floor")
				this.add(new Prop("chest", x, y, {stash: "num=1-4"}));
		}

		//Create exits
		exits.forEach(function (exit) {
			this.tile(exit[0], exit[1], "floor");
		}, this);
	};
	this.update = function (noRedraw) {
		for (var i = this.actors.length - 1; i >= 0; i--) {
			this.actors[i].update();
		}
		if (!noRedraw)
			this.redraw();
	};
	this.tile = function (x, y, val) {
		if (x >= width || x < 0
			|| y >= height || y < 0)
			return t["bound"];
		else if (val) {
			this.tiles = repChar(this.tiles, y * width + x, t[val].symbol);
			return;
		}
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
		if (this.tile(x, y).solid)
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
	//Returns everything at position x, y
	this.at = function (x, y, filter) {
		//@todo: add filter functionality
		//@todo: functionality
	}

	//Initialize
	this.generate();
}


//Load resources
multireq(["resource/tiles.yml",
	"resource/actors.yml",
	"resource/props.yml",
	"resource/items.yml",
	"resource/item-mods.yml"],
	[Tile, Actype, Proptype, Itemtype, Mod]);
