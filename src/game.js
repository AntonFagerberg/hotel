// Settings
var debug = true;
var tileSize = 16;
var scale = 4;
var unit = tileSize * scale;
var gameWidth = 13;
var gameHeight = 13;

// Phaser game
var game = new Phaser.Game(gameWidth * unit, gameHeight * unit, Phaser.AUTO, '', { preload: preload, create: create });

function debugLog(msg) {
  if (debug) {
    console.log(msg);
  }
}

// State
var selector, elevatorRight, elevatorLeft, selector;

var waitingGuests = Array(11).fill(undefined);
var roomsInProgress = Array(25).fill(undefined);
var roomLights = [];
var targetRoom = null;
var selectedGuest = null;

// Helpers
function doorToX(door) {
  return unit * ((1 + door) * 2);
}

function floorToY(floor) {
  return unit * (gameHeight - 1 - (floor * 2));
}

function floorFromRoom(room) {
  return 5 - parseInt(room / 5);
}

function doorFromRoom(room) {
  return room % 5;
}

// Functions
function createGuest(position, type) {
  var sprite = addSprite("guest" + type, position + 1, gameHeight - 1);
  var speed = 500;
  
  if (type == 2) {
    speed = 1000;
  }
  
  return {
    getType : function () { return type; },
    
    teleport: function (room) {
      var floor = floorFromRoom(room);
      var door = doorFromRoom(room);
      var x = doorToX(door)
      var y = floorToY(floor);
      
      debugLog("Teleporting to x " + x + ", y " + y + ", room " + room)
      
      sprite.position.x = x;
      sprite.position.y = y;

      game.time.events.add(Phaser.Timer.SECOND, function () {
        roomsInProgress[room] = false;
        sprite.destroy();
      }, true);
    },
    
    goToElevator: function (elevator, room) {
      var floor = floorFromRoom(room);
      var door = doorFromRoom(room);
      
      debugLog("Going to room " + room + " (floor " + floor + ", door " + door + ", position " + position + ")")
      
      var goToElevatorTween = game.add.tween(sprite);
      var targetX = unit * (elevator.getRight() ? 12 : 0);
      var speedMultiplier1 = elevator.getRight() ? (gameWidth - 2 - position) : (1 + position);
      
      goToElevatorTween.to({ x: targetX }, speedMultiplier1 * speed, Phaser.Easing.Default, false, 0);

      goToElevatorTween.onComplete.add(function () { 
        elevator.move(floor);
        
        var rideElevatorTween = game.add.tween(sprite);
        elevator.elevatorUpTween(floor, rideElevatorTween);
        
        rideElevatorTween.onComplete.add(function () {
          var goToDoorTween = game.add.tween(sprite);
          var speedMultiplier2 = elevator.getRight() ? (5 - door) * 2 : (door + 1) * 2 ;
          
          goToDoorTween.to({ x: doorToX(door) }, speedMultiplier2 * speed, Phaser.Easing.Default, false, 0);
          
          goToDoorTween.onComplete.add(function () {
            game.time.events.add(Phaser.Timer.SECOND, function () {
              roomsInProgress[room] = false;
              sprite.destroy();
            }, this);
          });
          
          goToDoorTween.start();
        });
        
        rideElevatorTween.start();
      });
      
      goToElevatorTween.start();
    }
  };
}

function createElevator(right) {
  function yToFloor(y) {
    return gameHeight - 1 - (y * 2);
  }
  
  var currentFloor = 0;
  var busy = false;
  var x = right ? gameWidth - 1 : 0;
  var y = yToFloor(currentFloor);
  var sprite = addSprite("elevator", x, y);
  
  return {
    getRight: function () {
      return right;
    },
    
    getBusy: function () {
      return busy;
    },
    
    setBusy: function (newBusy) {
      busy = newBusy;
    },
    
    elevatorUpTween: function (floor, tween) {
      tween.to({ y: unit * yToFloor(floor) }, Math.abs(floor - currentFloor) * 1500, Phaser.Easing.Default, false, 1500)
    },
    
    move: function (floor) {
      var elevatorTween = game.add.tween(sprite);
      this.elevatorUpTween(floor, elevatorTween);
      elevatorTween.to({ y: unit * yToFloor(0) }, Math.abs(floor - currentFloor) * 1500, Phaser.Easing.Default, false, 1500);
      elevatorTween.onComplete.add(function () { busy = false; });
      elevatorTween.start();
    }
  };
}

function addSprite(name, x, y) {
  var sprite = game.add.sprite(x * unit, y * unit, name);
  sprite.scale.setTo(scale, scale);
  sprite.smoothed = false;
  return sprite;
}

function spawnNewGuest() {
  var x, availableSlots = [];
  
  for (x = 0; x != waitingGuests.length; x++) {
    if (!waitingGuests[x]) {
      availableSlots.push(x);
    }
  }
  
  if (availableSlots.length != 0) {
    var slot = availableSlots[parseInt(Math.random() * availableSlots.length)];
    var type = 1 + parseInt(3 * Math.random());
    
    waitingGuests[slot] = createGuest(slot, type);
  }
}

function freeRoom () {
  var index, availableRooms = [];
  
  if (!targetRoom) {
    for (index = 0; index != 25; index++) {
      if (!roomsInProgress[index]) {
        availableRooms.push(index);
      }
    }
    
    if (availableRooms.length > 0) {
      targetRoom = availableRooms[parseInt(availableRooms.length * Math.random())];
      roomLights[targetRoom].toggle();
      debugLog("Set target room: " + targetRoom);
    }
  }
}

function preload () {
  game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
  game.scale.pageAlignHorizontally = true;
  game.scale.pageAlignVertically = true;
  
  [
    "selector",
    "wall",
    "painting",
    "door",
    "roof",
    "elevator",
    "floor",
    "stairs",
    "person",
    "sign",
    "occupied",
    "free",
    "guest1",
    "guest2",
    "guest3",
    "elevator_strings"
  ].forEach(function (title) {
    game.load.image(title, 'img/' + title + '.png');
  });
}

function handleInput() {
  debugLog(roomsInProgress);
  debugLog(waitingGuests);
  
  var y = parseInt(game.input.y / unit);
  var x = parseInt(game.input.x / unit);
  
  debugLog("x " + x + ", y " + y);
  
  var elevator, guest;
  
  if (x == gameWidth - 1) {
    elevator = elevatorRight;
    debugLog(elevator)
  } else if (x == 0) {
    elevator = elevatorLeft;
    debugLog(elevator)
  }
  
  if (y == gameHeight - 1 && !!elevator && !elevator.getBusy() && !!selectedGuest && !!targetRoom) {
    console.log(selectedGuest);
    guest = waitingGuests[selectedGuest - 1];
    elevator.setBusy(true);
    selector.select(x, y);
    roomsInProgress[targetRoom] = true;
    roomLights[targetRoom].toggle();
    guest.goToElevator(elevator, targetRoom);
    selector.hide();
    waitingGuests[selectedGuest - 1] = null;
    selectedGuest = null;
    targetRoom = null;
  } else if (y == gameHeight - 1 && waitingGuests[x - 1]) {
    guest = waitingGuests[x - 1];
    
    if (guest.getType() == 3) {
      if (!!targetRoom) {
        guest.teleport(targetRoom);
        roomLights[targetRoom].toggle();
        roomsInProgress[targetRoom] = true;
        targetRoom = null;
        waitingGuests[x - 1] = null;
      }
    } else {
      selectedGuest = x;
      debugLog("Selected guest " + selectedGuest)
      selector.select(x, y);
    }
  } else {
    selectedGuest = null;
    selector.hide();
  }
}

function create () {
  var x = 0, y = 0;
  
  for (y = 1; y != gameHeight; y++) {
    addSprite("elevator_strings", 0, y);
    addSprite("elevator_strings", gameWidth - 1, y);
  }
  
  for (x = 0; x != gameWidth; x++) {
    addSprite("roof", x, 0);
  }
  
  addSprite("sign", 5, 0);
  
  for (x = 1; x != gameWidth - 1; x++) {
    for (y = 1; y != gameHeight; y++) {
      
      addSprite("wall", x, y)
        
      if (y % 2 == 1) {
        addSprite("floor", x, y)
      }
      
      if (y < gameHeight - 2 && y % 2 == 0) {
        if (x % 2 == 0) {
          addSprite("door", x, y)
        } else {
          addSprite("painting", x, y)
        }
      }
    }
  }
  
  var light;
  
  for (x = 0; x != 25; x++) {
    light = {
      occupied: addSprite("occupied", 2 + 2 * (x % 5), 2 + 2 * parseInt(x / 5)),
      free: addSprite("free", 2 + 2 * (x % 5), 2 + 2 * parseInt(x / 5)),
      
      toggle: function () {
        this.free.visible = !this.free.visible;
        this.occupied.visible = !this.occupied.visible;
      }
    }
    
    light.free.visible = false;
    roomLights.push(light);
  }
  
  x = null, y = null, light = null;
  
  elevatorRight = createElevator(true);
  elevatorLeft = createElevator(false);
  
  selector = {
    sprite: addSprite("selector", 3, gameHeight - 1),
    
    select: function (x, y) {
      this.sprite.x = unit * x;
      this.sprite.y = unit * y;
      this.sprite.visible = true;
    },
    
    hide: function () {
      this.sprite.visible = false;
    }
  };
  
  selector.hide();
  
  game.input.onDown.add(handleInput);
  
  game.time.events.loop(1 * Phaser.Timer.SECOND, spawnNewGuest, this);
  game.time.events.loop(Phaser.Timer.SECOND, freeRoom, this);
}