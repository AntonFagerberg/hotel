// Settings
var debug = true;
var tileSize = 16;
var scale = 4;
var unit = tileSize * scale;
var gameWidth = 13;
var gameHeight = 13;
var score = 0;

// Phaser game
var game = new Phaser.Game(gameWidth * unit, gameHeight * unit, Phaser.AUTO, '', { preload: preload, create: create });

function debugLog(msg) {
  if (debug) {
    console.log(msg);
  }
}

// State
var selector, elevatorRight, elevatorLeft, selector;

var allGuests = [];
var waitingGuests = Array(11).fill(undefined);
var roomsInProgress = Array(25).fill(undefined);
var doors = [];
var rooms = [];
var roomLights = [];
var targetRoom = null;
var selectedGuest = null;
var scoreText = null;
var rKey;

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

function updateScore(newScore) {
  score += newScore;
  scoreText.text = "score: " + score;
}

// Functions
function createGuest(position, type) {
  var spriteIdle = addSprite('guest' + type + '_idle', position + 1, gameHeight - 1);
  var spriteWalk = addSprite('guest' + type + '_walk', position + 1, gameHeight - 1);
  spriteWalk.visible = false;
  
  var sprites = [spriteIdle, spriteWalk]
  
  spriteIdle.animations.add('idle');
  var walkAnimation = spriteWalk.animations.add('walk');
  
  spriteIdle.animations.play('idle', 5 + Math.random(), true);
  if (type != 3) {
    spriteWalk.animations.play('walk', 5 + Math.random(), true);
  }
  
  var facingLeft = false;
  
  if (position < (gameWidth - 1) / 2) {
    facingLeft = true;
    sprites.forEach(function (sprite) {
      sprite.anchor.setTo(1, 0);
      sprite.scale.x *= -1;
    });
  }
  
  var speed = 500;
  
  if (type == 2) {
    speed = 1000;
  }
  
  return {
    destroy: function () {
      sprites.forEach(function (sprite) {
        sprite.destroy();
      });
    },
    
    getType : function () { return type; },
    
    teleport: function (room) {
      var floor = floorFromRoom(room);
      var door = doorFromRoom(room);
      var x = doorToX(door)
      var y = floorToY(floor);
      
      debugLog("Teleporting to x " + x + ", y " + y + ", room " + room)
      
      spriteWalk.visible = true;
      spriteWalk.animations.play('walk', 5, false, true);
      
      spriteIdle.position.x = x;
      spriteIdle.position.y = y;
      
      // COPY PASTE-ish
      var doorOpen = addSprite('door_open', 0, 0);
      doorOpen.x = spriteIdle.x;
      doorOpen.y = spriteIdle.y;
      doors[room].visible = false;
      var doorOpenAnimation = doorOpen.animations.add('door_open');
      doorOpen.animations.play('door_open', 5, false, true);
      
      game.world.bringToTop(spriteIdle);
      
      doorOpenAnimation.onComplete.add(function () {
        game.world.sendToBack(spriteIdle);
        game.world.sendToBack(rooms[room]);
        
        var doorClose = addSprite('door_close', 0, 0);
        doorClose.x = spriteIdle.x;
        doorClose.y = spriteIdle.y;
        var doorCloseAnimation = doorClose.animations.add('door_close');
        doorClose.animations.play('door_close', 5, false, true);
        
        doorCloseAnimation.onComplete.add(function () {
          sprites.forEach(function(sprite) {
            sprite.destroy();
          });
          
          doors[room].visible = true;
          roomsInProgress[room] = false;
          updateScore(1);
        });
      });
      // END COPY PASTE
    },
    
    goToElevator: function (elevator, room) {
      var floor = floorFromRoom(room);
      var door = doorFromRoom(room);
      
      debugLog("Going to room " + room + " (floor " + floor + ", door " + door + ", position " + position + ")")
      
      spriteIdle.visible = false;
      spriteWalk.x = spriteIdle.x;
      spriteWalk.y = spriteIdle.y;
      spriteWalk.visible = true;
      
      if (elevator.getRight() && facingLeft) {
        facingLeft = false;
        sprites.forEach(function (sprite) {
          sprite.anchor.setTo(0, 0);
          sprite.scale.x *= -1;
        });
      } else if (!elevator.getRight() && !facingLeft) {
        facingLeft = true;
        sprites.forEach(function (sprite) {
          sprite.anchor.setTo(1, 0);
          sprite.scale.x *= -1;
        });
      }
      
      var goToElevatorTween = game.add.tween(spriteWalk);
      var targetX = unit * (elevator.getRight() ? 12 : 0);
      var speedMultiplier1 = elevator.getRight() ? (gameWidth - 2 - position) : (1 + position);
      
      goToElevatorTween.to({ x: targetX }, speedMultiplier1 * speed, Phaser.Easing.Default, false, 0);

      goToElevatorTween.onComplete.add(function () { 
        if (facingLeft) {
          facingLeft = false;
          sprites.forEach(function (sprite) {
            sprite.anchor.setTo(0, 0);
            sprite.scale.x *= -1;
          });
        } else  {
          facingLeft = true;
          sprites.forEach(function (sprite) {
            sprite.anchor.setTo(1, 0);
            sprite.scale.x *= -1;
          });
        }
        
        spriteWalk.visible = false;
        spriteIdle.x = spriteWalk.x;
        spriteIdle.y = spriteWalk.y;
        spriteIdle.visible = true;
        
        elevator.move(floor);
        
        var rideElevatorTween = game.add.tween(spriteIdle);
        elevator.elevatorUpTween(floor, rideElevatorTween);
        
        rideElevatorTween.onComplete.add(function () {
          spriteIdle.visible = false;
          spriteWalk.x = spriteIdle.x;
          spriteWalk.y = spriteIdle.y;
          spriteWalk.visible = true;
          
          var goToDoorTween = game.add.tween(spriteWalk);
          var speedMultiplier2 = elevator.getRight() ? (5 - door) * 2 : (door + 1) * 2 ;
          
          goToDoorTween.to({ x: doorToX(door) }, speedMultiplier2 * speed, Phaser.Easing.Default, false, 500);
          
          goToDoorTween.onComplete.add(function () {
            
            var doorOpen = addSprite('door_open', 0, 0);
            doorOpen.x = spriteWalk.x;
            doorOpen.y = spriteWalk.y;
            doors[room].visible = false;
            var doorOpenAnimation = doorOpen.animations.add('door_open');
            doorOpen.animations.play('door_open', 5, false, true);
            
            spriteWalk.visible = false;
            spriteIdle.x = spriteWalk.x;
            game.world.bringToTop(spriteIdle);
            spriteIdle.visible = true;
            
            doorOpenAnimation.onComplete.add(function () {
              game.world.sendToBack(spriteIdle);
              game.world.sendToBack(rooms[room]);
              
              var doorClose = addSprite('door_close', 0, 0);
              doorClose.x = spriteWalk.x;
              doorClose.y = spriteWalk.y;
              var doorCloseAnimation = doorClose.animations.add('door_close');
              doorClose.animations.play('door_close', 5, false, true);
              
              doorCloseAnimation.onComplete.add(function () {
                sprites.forEach(function(sprite) {
                  sprite.destroy();
                });
                
                doors[room].visible = true;
                roomsInProgress[room] = false;
                updateScore(1);
              });
            });
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
  var speed = right ? 1000 : 500;
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
      tween.to({ y: unit * yToFloor(floor) }, Math.abs(floor - currentFloor) * speed, Phaser.Easing.Default, false, 1500)
    },
    
    move: function (floor) {
      var spriteDoor = addSprite('elevator_close', x, y);
      spriteDoor.visible = false;
      spriteDoor.animations.add('close');
      
      var doorOpen = addSprite('elevator_open', x, y);
      doorOpen.visible = false;
      var doorOpenAnimation = doorOpen.animations.add('open');
      
      doorOpenAnimation.onComplete.add(function () {
        doorOpen.visible = false;
      });
      
      spriteDoor.animations.play('close', 8);
      spriteDoor.visible = true;
      game.world.bringToTop(spriteDoor);
      
      var elevatorTween = game.add.tween(sprite);
      var elevatorDoorTween = game.add.tween(spriteDoor);
      
      this.elevatorUpTween(floor, elevatorTween);
      this.elevatorUpTween(floor, elevatorDoorTween);
      
      elevatorTween.onComplete.add(function () {
        spriteDoor.visible = false;
        doorOpen.y = sprite.y;
        doorOpen.visible = true;
        game.world.bringToTop(doorOpen);
        var animation = doorOpen.animations.play('open', 5, false);
        
        var dummyTween = game.add.tween(sprite);
        dummyTween.to({}, Math.abs(floor - currentFloor) * speed, Phaser.Easing.Default, false, 1000);
        
        dummyTween.onComplete.add(function () {
          spriteDoor.animations.play('close', 8);
          spriteDoor.visible = true;
          game.world.bringToTop(spriteDoor);
          
          var elevatorTween2 = game.add.tween(sprite);
          var elevatorDoorTween2 = game.add.tween(spriteDoor);
          
          elevatorTween2.to({ y: unit * yToFloor(0) }, Math.abs(floor - currentFloor) * speed, Phaser.Easing.Default, false, 1000);
          elevatorDoorTween2.to({ y: unit * yToFloor(0) }, Math.abs(floor - currentFloor) * speed, Phaser.Easing.Default, false, 1000);
          
          elevatorTween2.onComplete.add(function () { 
            doorOpen.y = sprite.y;
            doorOpen.visible = true;
            game.world.bringToTop(doorOpen);
            doorOpen.animations.play('open', 5, false, true);
            spriteDoor.visible = false;
            busy = false; 
          });
          
          elevatorTween2.start();
          elevatorDoorTween2.start();
        });
        
        dummyTween.start();

      });
      
      elevatorTween.start();
      elevatorDoorTween.start();
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
    allGuests.push(waitingGuests[slot])
  }
}

function freeRoom () {
  var index, availableRooms = [];
  
  if (targetRoom == null) {
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
  
  game.load.bitmapFont('font', 'font/font.png', 'font/font.fnt');
  
  [
    "selector",
    "wall",
    "wall_door",
    "wall_with_decoration",
    "painting1",
    "painting2",
    "painting3",
    "painting4",
    "painting5",
    "door",
    "roof",
    "elevator",
    "floor",
    "room",
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
  
  [
    "guest1_walk",
    "guest1_idle",
    "guest2_idle",
    "guest2_walk",
    "guest3_idle",
    "guest3_walk",
    "door_open",
    "door_close",
    "elevator_open",
    "elevator_close"
  ].forEach(function (title) {
    game.load.spritesheet(title, 'img/' + title + '.png', 16, 16);
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
  
  if (y == gameHeight - 1 && !!elevator && !elevator.getBusy() && !!selectedGuest && targetRoom != null) {
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
      if (targetRoom != null) {
        roomLights[targetRoom].toggle();
        roomsInProgress[targetRoom] = true;
        guest.teleport(targetRoom);
        targetRoom = null;
        waitingGuests[x - 1] = null;
      }
      
      selectedGuest = null;
      selector.hide();
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

  for (y = 1; y != gameHeight; y++) {  
    for (x = 1; x != gameWidth - 1; x++) {  
      if (y % 2 == 1) {
        addSprite("wall", x, y)
      } else {
        if (x % 2 == 1 || y == gameHeight - 1) {
          addSprite("wall_with_decoration", x, y)
        } else {
          addSprite("wall_door", x, y)
        }
      }
        
      if (y % 2 == 1) {
        addSprite("floor", x, y)
      }
      
      if (y < gameHeight - 2 && y % 2 == 0) {
        if (x % 2 == 0) {
          rooms.push(addSprite("room", x, y));
          doors.push(addSprite("door", x, y));
        } else {
          addSprite("painting" + (1 + parseInt(5 * Math.random())), x, y)
        }
      }
    }
  }
  
  var light;
  
  for (x = 0; x != 25; x++) {
    light = {
      occupied: addSprite("occupied", 2 + 2 * (x % 5), 1 + 2 * parseInt(x / 5)),
      free: addSprite("free", 2 + 2 * (x % 5), 1 + 2 * parseInt(x / 5)),
      
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
  
  scoreText = game.add.bitmapText(10, 6, 'font', 'score: 0', 16);
  
  game.input.onDown.add(handleInput);
  
  freeRoom();
  spawnNewGuest();
  spawnNewGuest();
  spawnNewGuest();
  spawnNewGuest();
  
  game.time.events.loop(3 * Phaser.Timer.SECOND, spawnNewGuest, this);
  game.time.events.loop(2 * Phaser.Timer.SECOND, freeRoom, this);
}