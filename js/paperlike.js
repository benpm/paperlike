"use strict";

/* global sprintf, YAML, chance, _ */

//Error messages for Kindle Paperwhite
window.addEventListener("error", function (e) { alert(e.message + ":" + e.lineno); }, true);


////Globals

//Lib
var _s = s;
var s = sprintf;
_.mixin({
	//Omits all members beginning with prefix char
	omitFromPrefix: function (obj, char) {
		return _.omit(obj, _.filter(_.keys(obj), function (t) { return t[0] == char }));
	},

	//Only returns members with prefix char
	grabFromPrefix: function (obj, char) {
		return _.pick(obj, _.filter(_.keys(obj), function (t) { return t[0] == char }));
	}
});
var boundFunc = {
	range: clamp,
	min: Math.max,
	max: Math.min
};
var difficulties = [
	"common",
	"common",
	"rare",
	"vrare",
	"mythical"
];
var rarities = {
	common: 0,
	rare: 1,
	vrare: 2,
	mythical: 3
};

//DOM Elements
var $room, $inv, $bInv, $islots,
	$iname, $idesc, $iequip, $acts,
	$hp, $st, $ar, $dmg,
	$exit, $msg, $itrash, $iuse,
	$pad, $tooltip, $death, $stats;

//Misc. globals
var isKindle = false, info, width, height, halfheight, halfwidth, xcol, restartKeys = 5,
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

//Kindle detection
if (innerWidth == 758 && innerHeight == 945)
	isKindle = true;
if (isKindle)
	info = window.alert;
else
	info = console.info;	


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
//Pushes item into list or creates list
function insertion(obj, key, value) {
	if (!obj[key])
		obj[key] = [];
	obj[key].push(value);
}
//Inserts into rarity and specific rarity categories
function rarityInsert(collection, rarity, value) {
	insertion(collection, "_" + rarity, value);
	Object.keys(rarities).forEach(function (r) {
		if (rarities[r] >= rarities[rarity]) {
			insertion(collection, r, value);
		}
	}, this);
}
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
		$islots[i].innerText = " ";
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
//Tooltip manipulation
function doTooltip(event) {
	this.appendChild($tooltip);
	$tooltip.style.display = "";
	$tooltip.innerText = _s.titleize(this.getAttribute("tip")) || "???";
}
//Eject tooltip
function unTooltip(event) {
	$tooltip.style.display = "none";
}
//Set manual styles
function updateStyle() {
	var bevel = document.getElementById("bevel");
	bevel.style.width = (window.innerWidth - 32) + "px";
	bevel.style.height = (window.innerHeight - 32) + "px";
}
//Find possible actions
function getActions() {
	actions = [];

	//Inventory
	actions.push({ name: "Open Inventory", symbol: "1", override: function () {
		Stage.setscene('inv');
	}});

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
	var extras = "", type, valid, amount = 0;
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
		
		//Amount
		amount = 100;
		switch (type) {
			case "Actor":
				amount = Math.round((target.hp / target.maxhp) * 100);
				break;
			case "Prop":
				amount = Math.round((target.stash.items.length / target.stash.max) * 100);
				break;
		}

		//Write in DOM
		$acts.innerHTML += s("<span style='background: linear-gradient(to bottom, gray 0%%, gray %1$d%%, black %1$d%%, black 100%%)' class='%2$s' tip='%4$s'>%3$s</span>",
			100 - amount,	
			valid ? "" : "invalid",
			target.symbol || "?",
			target.name);
		/* $acts.innerHTML += s("<p class='%s'> %s %s %s %s </p>",
			valid ? "" : "invalid",
			type == "Prop" || player.stamina > 1 ? "->" : "X",
			type == "Actor" ? "attack " :
			type == "Prop" ? "loot " : "interact ",
			target.name, extras); */
	}, this);

	//Assign interaction function
	for (var i = 0; i < $acts.children.length; i++) {
		if ($acts.children[i].className != "invalid")
			$acts.children[i].onmousedown = perfAction;
		$acts.children[i].onmouseenter = doTooltip;
		$acts.children[i].onmouseout = unTooltip;
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

	//Check for player death
	if (room.actors.indexOf(player) == -1) {
		while ($acts.firstChild) { $acts.removeChild($acts.firstChild)}
		return;
	}

	//Update room
	room.update();

	//List actions
	getActions();

	//Update stats
	player.d_hp = player.hp - player.d_hp;
	player.d_stamina = player.stamina - player.d_stamina;
	$hp.innerHTML = s("<img src='img/hp.svg'>%d/%d %s", player.hp, player.maxhp,
		player.d_hp ? s("<span>%s%d</span>",
			player.d_hp > 0 ? "+" : "", player.d_hp) : "");
	$st.innerHTML = s("<img src='img/stamina.svg'>%d/%d %s", player.stamina, player.maxstamina,
		player.d_stamina ? s("<span>%s%d</span>",
			player.d_stamina > 0 ? "+" : "", player.d_stamina) : "");
	$ar.innerHTML = s("<img src='img/armor.svg'>%d", player.defense());
	$dmg.innerHTML = s("<img src='img/damage.svg'>%d", player.damage());
	$msg.innerText = msgbuffer.join(", then ");
	if (!$msg.innerText)
		$msg.innerText = "...";	
	msgbuffer.length = 0;
	turns++;

	//Post-update
	player.d_hp = player.hp;
	player.d_stamina = player.stamina;

	//Immediate player death check
	if (player.hp <= 0) {
		turn();
		keyinput();
		playerDeath();
	}
}
//Inventory DOM selection handler
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

	//Action buttons
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

	//Check for unequippable
	var item = invSelected();
	if (item.equipped && !item.canUnequip(player))
		return;

	//Select and equip if equippable
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
	if (!$islots.select) return false;

	//Select and equip if equippable
	var item = invSelected();
	if (!item)
		return false;
	if (item.use(player, true)) {
		//Remove, then redraw / reinspect item
		player.stash.remove(item);
		invent(document.getElementById("select"));
		invdraw();
		return true;
	}
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
//Uses a generic bounding function f(n, ...vals)
function bounded(func, n, vals) {
	switch (vals.length) {
		case 1:
			return func(n, vals[0]);
		case 2:
			return func(n, vals[0], vals[1]);	
	}
}
//Non-negative modulo
function nmod(x, m) {
	return (x % m + m) % m;
}
//Replaces character in string
function repChar(str, i, chr) {
	return str.substr(0, i) + chr + str.substr(i + 1);
}
//Line of sight utilities
function look(x, y, distance) {
	var increment = 1 / (distance * 3);
	for (var ang = 0; ang < 2 * Math.PI; ang += increment) {
		ray(x, y, ang, distance);
	}
}
function ray(x, y, angle, steps) {
	if (!room.inbounds(Math.round(x), Math.round(y)))
		return false;	
	room.fog(Math.round(x), Math.round(y), false);
	if (steps <= 0)
		return false;
	var tile = room.tile(Math.round(x), Math.round(y));
	if (!tile.transparent)
		return true;
	return ray(
		x + Math.cos(angle),
		y + Math.sin(angle), angle, steps - 1);
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
				if (!invUse())
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
	req.onerror = console.error;
	req.onload = function () {
		console.debug("loaded " + path);
		var entries = YAML.parse(req.responseText);

		//Defaults
		Type.defaults = _.omitFromPrefix(entries["_defaults"], "_");

		//Specification of ranges
		Type.ranges = {};
		var rawRanges = _.grabFromPrefix(entries["_defaults"], "_");
		Object.entries(rawRanges).forEach(function (range) {
			var parts = range[0].slice(1).split("_");
			if (!Type.ranges[parts[1]])
				Type.ranges[parts[1]] = {};
			Type.ranges[parts[1]][parts[0]] = {
				vals: range[1],
				func: boundFunc[parts[2]]
			};
		});

		//Specification of types
		entries = _.omit(entries, "_defaults");
		Object.entries(entries).forEach(function (entry) {
			//Also, remove underscore-prepended properties
			new Type(entry[0], _.omitFromPrefix(entry[1], "_"));
		}, this);

		//Show that this file has been loaded and parsed
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
//Death handler
function playerDeath() {
	Stage.setscene("dead");
	player = undefined;
}
//Run some compatiblity tests
function runtests() {
	alert(s("[RUNTESTS]\n\
		room.checksolid is %s\n\
		array.find is %s\n\
		matchPos is %s\n\
		Object.entries is %s\n\
		isKindle = %s\n\
		size: %s x %s",
		typeof room.checksolid,
		typeof Array.prototype.find,
		typeof matchPos,
		typeof Object.entries,
		isKindle, innerWidth, innerHeight));
}
//Begin
function begin() {
	console.log("Begin");

	//Player setup
	player = new Actor("player",
		Math.floor(width / 2), Math.floor(height / 2), {name: "u"});
	player.stash.add(new Item("sword"));
	player.stash.equip(player.stash.items[0]);

	//Generate room
	rooms = {};
	room = new Room(0, 0);
	room.actors.push(player);

	//Post-death restart sequence
	if (Stage.scene == "dead")
		Stage.setscene("game");	

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
	$exit = document.getElementById("exit");
	$msg = document.getElementById("msg");
	$pad = document.getElementById("pad");
	$tooltip = document.getElementById("tooltip");
	$death = document.getElementById("death");
	$stats = document.getElementById("stats");

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
				$pad.style.display = "none";
				$stats.style.display = "none";
				break;
			case "inv":
				$inv.style.display = "none";
				//$bInv.classList.remove("");
				$exit.style.display = "none";
				$bInv.style.display = "";
				if (document.getElementById("select"))
					document.getElementById("select").id = "";
				break;
			case "dead":
				$death.style.display = "none";
				break;	
		}

		//To...
		this.scene = scene;
		switch (scene) {
			case "game":
				$room.style.display = "";
				$acts.style.display = "";
				$pad.style.display = "";
				$stats.style.display = "";
				getActions();
				break;
			case "inv":
				invdraw();
				$inv.style.display = "";
				$bInv.style.display = "none";
				$exit.style.display = "";
				$stats.style.display = "";
				break;
			case "dead":
				$death.style.display = "";	
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
	insertion(actorCategories, this.category, this.name);
	insertion(actorCategories, this.rarity, this.name);
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
		if (this.hp <= this.maxhp / 5)
			this.behaviour = "flee";

		//Regain stamina OR hp
		if (this.stamina < this.maxstamina) {
			this.stamina += this.strength;
		} else if (this.hp < this.maxhp) {
			this.hp += this.strength;
		}

		//Cap some properties
		this.stamina = cap(this.stamina, this.maxstamina);
		this.hp = cap(this.hp, this.maxhp);

		//Stash update
		this.stash.update();

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
				this.stamina -= 1;
				break;
		}
		if (this !== player) {
			if (this.aggro && objdist(this, player) == 1)
				this.interact(player);
		}
	};
	//Interaction with actor who
	this.interact = function (who) {
		//Overridden function call
		if (who.override) {
			who.override();
			return;
		}

		//Interact with actor
		if (who.constructor.name == "Actor") {
			var staminaCost = this.weight();

			if (this.stamina >= staminaCost) {
				//Apply damage to who
				var dmgGiven = this.attack();
				var dmgTaken = who.defend(dmgGiven);

				//Stamina cost
				this.stamina -= staminaCost;
			}
		} else {
			if (who.stash.items.length) {
				who.stash.transfer(player.stash);
			}
		}
	};
	//Calculates total damage this actor can inflict
	this.damage = function (multiplier) {
		var dmg = this.strength;
		if (this.stash.slot("hand"))
			dmg += this.stash.slot("hand").damage;
		return Math.max(Math.ceil(dmg * (multiplier || 1)), 1);
	};
	//Calculates a turn of attack (with randomness)
	this.attack = function (multiplier) {
		//Total miss
		if (chance.bool({ likelihood: 10 }))
			return 0;

		//Item wear
		if (this.stash.slot("hand"))
			this.stash.slot("hand").wear += 1;

		//Calculate damage
		return this.damage(multiplier) + randint(-1, 1);
	};
	//Calculates and applies incoming damage
	this.defend = function (dmg) {
		var total = Math.max(0, dmg - this.defense());
		this.hp -= total;

		//Armor wear
		if (this.stash.slot("chest"))
			this.stash.slot("chest").wear += 1;
		else if (this.stash.slot("head"))
			this.stash.slot("head").wear += 1;
		else if (this.stash.slot("legs"))
			this.stash.slot("legs").wear += 1;
		else if (this.stash.slot("feet"))
			this.stash.slot("feet").wear += 1;
		else if (this.stash.slot("wrist"))
			this.stash.slot("wrist").wear += 1;

		if (total == 0 && dmg > 0)
			log(s("%s defended", this.name))
		this.aggro = true;
		return total;
	};
	//Calculates total armor an actor has
	this.defense = function (multiplier) {
		var armor = 0;
		if (this.stash.slot("chest"))
			armor += this.stash.slot("chest").armor;
		if (this.stash.slot("head"))
			armor += this.stash.slot("head").armor;
		if (this.stash.slot("legs"))
			armor += this.stash.slot("legs").armor;
		if (this.stash.slot("feet"))
			armor += this.stash.slot("feet").armor;
		if (this.stash.slot("wrist"))
			armor += this.stash.slot("wrist").armor;
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
	insertion(propCategories, this.category, this.name);
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
			if (item.equipped && index != - 1 && item.canUnequip(this.parent)) {
				//Unequips item
				item.equipped = false;
				this.equipped.splice(index, 1);
				item.onUnequip(this.parent);
				if (this.parent === player)
					log(s("u unequipped %s", item.name));
				return true;
			} else if (!item.equipped && index == - 1) {
				//Swaps with item currently in slot
				this.unslot(item.slot);
				item.equipped = true;
				this.equipped.push(item);
				item.onEquip(this.parent);
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
	//Update items
	this.update = function () {
		//Broken item chances
		this.equipped.forEach(function (item) {
			if (Math.random() < item.wear / (item.durability * 250)) {
				//Break, unequip
				modTypes.broken.apply(item);
				if (item.equipped)
					this.equip(item);
				item.equippable = false;
			}
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

	//Set max from procedure
	if (this.items.length > 0) {
		this.max = this.items.length;
	}
}
//Type of item
function Itemtype(name, props) {
	Object.assign(this, _.defaults(props, Itemtype.defaults));

	this.name = name;
	this.equippable = (this.slot != "");
	this.speed = this.weight ? 5 - this.weight : 0;

	itemTypes[name] = this;
	insertion(itemCategories, this.category, this.name);
	rarityInsert(itemCategories, this.rarity, this.name);
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
			case "consumable":
				if (this.hp && who.hp == who.maxhp)
					return false;
				if (execute) {
					sumMembers(who, this);
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
	};

	//Special action upon being equipped
	this.onEquip = function (actor) {
		if (actor) {
			if (this.category == "gear") {
				//Increase personal storage
				if (this.storage)
					actor.stash.max = this.storage;
			}
		}
	};

	//Determines whether this item can be unequipped
	this.canUnequip = function (actor) {
		if (actor) {
			if (this.category == "gear") {
				//Wearable storage needs to be cleared
				if (this.storage && actor.stash.items.length <= 5)
					return true;
			}
		} else
			return true;
		return true;
	}

	//Special action upon being un-equipped
	this.onUnequip = function (actor) {
		if (actor) {
			if (this.category == "gear") {
				//Reset personal storage space
				if (this.storage)
					actor.stash.max = 5;
			}
		}
	};

	//For preventing properties from escaping their ranges
	this.bounds = function () {
		Object.keys(this).forEach(function (property) {
			var ranges = Itemtype.ranges[this.category];
			if (ranges && ranges[property]) {
				this[property] = bounded(
					ranges[property].func,
					this[property],
					ranges[property].vals);
			}
		}, this);
	};
}
//Item modifier
function Mod(name, props) {
	Object.assign(this, props);
	this.name = name;
	this.addins = _.omit(this, "application", "name");

	this.apply = function (item) {
		sumMembers(item, this.addins);
		item.name = s("%s %s", this.name, item.name);
		item.bounds();
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
	this.fogtiles = Array(width * height);
	this.actors = [];
	this.props = [];
	this.x = x;
	this.y = y;
	this.lastVisit = turns;
	this.difficulty = cap(dist(x, y, 0, 0), _.size(rarities) - 1);

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
			
			//Decoration
			if (chance.bool({ likelihood: 10 })) {
				//self.tile(x1 + 1, y1 + 1, "plant");
				//self.tile(x2 - 1, y2 - 1, "plant");
			}
			
			if (dir) {
				//Vertical segment
				var x = randint(x1 + 3, x2 - 3);
				if (x == halfwidth)
					return;	
				this.wall(x, y1, x, y2);

				//Door
				if (chance.bool({ likelihood: 75 }))
					self.tile(x, randint(y1 + 1, y2 - 1), "door");
				
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
					self.tile(randint(x1 + 1, x2 - 1), y, "door");
				
				//Recursively split
				if (chance.bool())
					this.chop(x1, y, x2, y2, true);
				else
					this.chop(x1, y1, x2, y, true);	
			}
		}
	};
	this.generate = function () {
		//Generator subparameters
		var monsters = this.difficulty * 2;
		var rarity = difficulties[this.difficulty];
		var chests = randint(0, 3);
		if (this.difficulty == 0)
			chests = 2;	

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

		//Decoration
		var sides = 0;
		for (var y = 0; y < height; y++) {
			for (var x = 0; x < width; x++) {
				if (this.tile(x, y).name == "floor") {
					sides = 0;
					if (this.tile(x, y + 1).name == "wall") sides += 1;
					if (this.tile(x, y - 1).name == "wall") sides += 1;
					if (this.tile(x + 1, y).name == "wall") sides += 1;
					if (this.tile(x - 1, y).name == "wall") sides += 1;

					if (sides == 2)
						this.tile(x, y, "plant");
				}
			}
			if (chance.bool({ likelihood: 15 }))
				break;	
		}

		//Actors
		for (var i = 0; i < monsters; i++) {
			var x = randint(1, xcol - 1);
			var y = randint(1, yrow - 1);
			if (this.tile(x, y).name == "floor")
				this.add(new Actor(chance.pickone(actorCategories[rarity]), x, y));
		}

		//Chests
		for (var i = 0; i < chests; i++) {
			var x = randint(1, xcol - 1);
			var y = randint(1, yrow - 1);
			if (this.tile(x, y).name == "floor")
				this.add(new Prop("chest", x, y, {stash: s("num=1-4,_%s", rarity)}));
		}

		//Create exits
		exits.forEach(function (exit) {
			this.tile(exit[0], exit[1], "door");
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
	this.redraw = function () {
		var tile = "";
		$room.innerHTML = "";
		this.fogtiles.fill(true);
		look(player.x, player.y, player.sight);
		for (var y = 0; y < height; y++) {
			for (var x = 0; x < width; x++) {
				if (this.fog(x, y))
					tile = "'";
				else {
					tile = this.tile(x, y).symbol;

					this.props.forEach(function (prop) {
						if (prop.x == x && prop.y == y)
							tile = prop.symbol;
					}, this);

					this.actors.forEach(function (actor) {
						if (actor.x == x && actor.y == y)
						tile = actor.symbol;
					}, this);
				}

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
	this.fog = function (x, y, val) {
		if (val === undefined)
			return this.fogtiles[y * width + x];
		this.fogtiles[y * width + x] = val;
	};
	this.inbounds = function (x, y) {
		return x < width && x >= 0 && y < height && y >= 0;	
	};
	//Returns everything at position x, y (can filter for properties)
	this.at = function (x, y, filter) {
		var results = [];
		var result;
		filter = filter || {};

		//Find tile
		result = this.tile(x, y);
		if (result.name != "bound")
			results.push(result);
		
		//Find actor
		result = this.actors.find(function (actor) {
			return actor.x == x && actor.y == y;
		});
		if (result)
			results.push(result);
		
		//Filter
		return results.filter(function (result) {
			return _.pairs(filter).every(function (entry) {
				return result[entry[0]] == entry[1];
			});
		});
	}

	//Initialize
	this.generate();
}

runtests();

//Load resources
multireq(["resource/tiles.yml",
	"resource/actors.yml",
	"resource/props.yml",
	"resource/items.yml",
	"resource/item-mods.yml"],
	[Tile, Actype, Proptype, Itemtype, Mod]);
