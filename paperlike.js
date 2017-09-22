////Globals

//DOM Elements
var $room, $inv;
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
	new Itemtype("sword", "sword", {dmg: 1.25})

	//DOM Association
	msg = document.getElementById("msg");
	input = document.getElementById("input");
	$room = document.getElementById("room");
	$inv = document.getElementById("inv");

	//Style setup
	var bevel = document.getElementById("bevel");
	bevel.style.width = (window.innerWidth - 32) + "px";
	bevel.style.height = (window.innerHeight - 32) + "px";

	//Stage setup
	width = 21;
	height = 11;
	xcol = width - 1;
	xrow = height - 1;

	//Player setup
	player = new Actor("player", Math.floor(width/2), Math.floor(height/2));
	player.stash.add(Item("sword"));

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
				break;
		}
		this.scene = scene;
		switch (scene) {
			case "game":
				$room.style.display = "";
				break;
			case "inv":
				$inv.style.display = "";
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
	//TODO: Merge props
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
	//@todo Merge props
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
function Itemtype(name, img, props) {
	this.name = name;
	this.img = img;
	this.category = props.category || "misc";
	this.dmg = props.dmg || 0;
	this.durability= props.durability || 0;
	this.armor = props.armor || 0;
	itypes[name] = this;
}
//Individual item
function Item(itype, props) {
	this.itype = itypes[itype];
	//@todo: merge props
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
