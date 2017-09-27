////Globals

//DOM Elements
var $room, $inv, $bInv, $islots, $iname, $idesc;
//Misc. globals
var width, height, xcol, 
	xrow, player, controls, room, msg;
//Types of tiles
var t = {};
//Types of actors
var actypes = {};
//Types of props
var ptypes = {};
//Types of items
var itypes = {};


//// Game Functions

//Simplify strings
function strimplify(str) {
	return str.replace(/[aeiou]/g, "").replace(/[^A-z \d.,:]/g, "");
}
//Redraw inventory boxes
function invdraw() {
	var index = 0;
	for (index = 0; index < player.stash.max; index++) {
		$islots[index].innerText = ".";
	}
	index = 0;
	for (var item of player.stash.items) {
		$islots[index].innerText = strimplify(item.type.name);
		index ++;
	}
}
//Click on inventory DOM
function invent(dom) {
	//Reset other selected
	for (var slot of $islots) {
		slot.id = "";
	}
	//Select
	dom.id = dom.id ? "" : "select";
	//Set inspector
	var item = player.stash.items[parseInt(dom.getAttribute("index"))];
	$iname.innerHTML = item ? item.type.name : "";
	$idesc.innerHTML = item ? strimplify(JSON.stringify(Object.keys(item))) : "";
}
//Display alert on error
function handleError(error) {
	if (error.message)
		alert(error.message);
}
window.addEventListener("error", handleError, true);
//Returns random integer
function randint(a, b) {
	return Math.floor(Math.random() * (b - a + 1)) - b;
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
			player.move(0, -1);
			room.update();
			break;
		case "(":
		case "down":
		case "ArrowDown":
			player.move(0, 1);
			room.update();
			break;
		case "%":
		case "left":
		case "ArrowLeft":
			player.move(-1, 0);
			room.update();
			break;
		case "'":
		case "right":
		case "ArrowRight":
			player.move(1, 0);
			room.update();
			break;
	}
}
//Begin
function begin() {
	//Tile definitions
	new Tile("floor", ".", {});
	new Tile("wall", "=", {solid: true});
	new Tile("bound", " ", {solid: true});

	//Actor definitions
	new Actype("player", "@", {hp: 10, movet: "none", stash: "max=5"});
	new Actype("rat", "r", {hp: 5});
	new Actype("goblin", "g", {hp: 15, armor: 1});

	//Prop definitions
	new Proptype("chest", "$", {stash: "max=10"});

	//Item definitions
	new Itemtype("knife", {cat: "weapon", dmg: 1, spd: 5, dur: 1});
	new Itemtype("sword", {cat: "weapon", dmg: 2, spd: 4, dur: 1});
	new Itemtype("longsword", {cat: "weapon", dmg: 3, spd: 3, dur: 1});
	new Itemtype("battleaxe", {cat: "weapon", dmg: 4, spd: 2, dur: 1});
	new Itemtype("apple", {cat: "consumable", hp: 2});

	//DOM Association
	msg = document.getElementById("msg");
	input = document.getElementById("input");
	$room = document.getElementById("room");
	$inv = document.getElementById("inv");
	$bInv = document.getElementById("invbutton");
	$iname = document.getElementById("iname");
	$idesc = document.getElementById("idesc");
	$islots = document.getElementsByTagName("td");

	//Style setup
	var bevel = document.getElementById("bevel");
	bevel.style.width = (window.innerWidth - 32) + "px";
	bevel.style.height = (window.innerHeight - 48) + "px";

	//Stage setup
	width = 31;
	height = 11;
	xcol = width - 1;
	xrow = height - 1;

	//Player setup
	player = new Actor("player", Math.floor(width/2), Math.floor(height/2));
	player.stash.add(new Item("sword"));

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
	this.armor = props.armor || 0;
	this.movet = props.movet || "wander";
	this.stash = props.stash;
	actypes[symbol] = actypes[name] = this;
}
//Individual actor
function Actor(actype, x, y, props) {
	this.type = actypes[actype];
	this.x = x;
	this.y = y;
	if (this.type.stash)
		this.stash = new Stash(this.type.stash);
	//Merge
	Object.assign(this, this.type, props);
	this.move = function(dx, dy) {
		if (room.tile(this.x + dx, this.y + dy).solid)
			return;
		this.x += dx;
		this.y += dy;
	}
	this.update = function() {
		switch(this.type.movet) {
			case "wander":
				this.move(
					randint(-1, 1),
					randint(-1, 1));
				break;
		}
	};
}
//Type of object
function Proptype(name, symbol, props) {
	this.name = name;
	this.symbol = symbol;
	ptypes[symbol] = ptypes[name] = this;
}
//Individual actor
function Prop(ptype, x, y, props) {
	this.type = ptypes[ptype];
	this.x = x;
	this.y = y;
	this.stash = Stash(props.stash || "");
	//Merge
	Object.assign(this, this.type, props);
}
//Collection of items
function Stash(specify) {
	this.max = 5;
	this.items = [];

	//Adds an item to the stash
	this.add = function (item) {
		if (this.items.length <= this.max)
			this.items.push(item);
	}
	//Removes an item based on criterion
	this.remove = function (criteria) {
		//@todo: remove based on properties
	}

	//Parses a stash generator spec string
	var specs = specify.split(",");
	var generate = false;
	for (var spec of specs) {
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
	}
}
//Type of item
function Itemtype(name, props) {
	this.name = name;
	this.category = props.cat || "misc";
	this.damage = props.dmg || 0;
	this.speed = props.spd || 0;
	this.durability= props.dur || 0;
	this.armor = props.armr || 0;
	this.heal = props.hp || 0;
	itypes[name] = this;
}
//Individual item
function Item(itype, props) {
	this.type = itypes[itype];
	//Merge
	Object.assign(this, this.type, props);
}
//Individual room
function Room() {
	//Definitions
	msg.innerHTML = "start room"
	this.tiles = "";
	this.actors = [];

	//Generate room
	this.generate = function() {
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
		msg.innerHTML = "done room"

		return newroom;
	}
	this.update = function () {
		for (var i = this.actors.length - 1; i >= 0; i--) {
			this.actors[i].update();
		}
		this.redraw();
	}
	this.tile = function (x, y) {
		if (x >= width || x < 0
			|| y >= height || y < 0)
			return t["bound"];
		else
			return t[this.tiles[y * width + x]];
	}
	this.redraw = function redraw() {
		var tile = "";
		$room.innerHTML = "";
		for (var y = 0; y < height; y++) {
			for (var x = 0; x < width; x++) {
				tile = this.tile(x, y).symbol;

				for (var actor of this.actors) {
					if (actor.x == x && actor.y == y)
						tile = actor.type.symbol;
				}

				$room.innerHTML += tile;
			}
			$room.innerHTML += "<br>";
		}
		console.log("redrawn");
	}

	//Initialize
	this.tiles = this.generate();
	this.actors.push(new Actor("rat", 3, 3));
}
