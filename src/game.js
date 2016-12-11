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

var waitingGuests = Array(11).fill(undefined);
var roomsInProgress = Array(25).fill(undefined);
var doors = [];
var rooms = [];
var bricks = [];
var roomLights = [];
var targetRoom = null;
var selectedGuest = null;
var rKey;
var dead = true;
var gameOverSprite;
var movingGuests = 0;
var sound;
var pleaseWait = [null, null];
var blankSign = [null, null];
var numbers = [];
var tutorial;

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
  
  if (dead && movingGuests == 0) {
    var stringScore = "" + (score > 999 ? 999 : score);
    
    stringScore = ("000".substring(0, 3 - stringScore.length)) + stringScore;
    
    [0, 1].forEach(function (signIndex) {
      pleaseWait[signIndex].visible = false;
      blankSign[signIndex].visible = true;
      game.world.bringToTop(blankSign[signIndex]);
      
      var nr1 = addSprite(stringScore[0], 0, 0);
      nr1.x += blankSign[signIndex].x + 26;
      nr1.y += blankSign[signIndex].y + 16;
      numbers.push(nr1);
      
      if (stringScore[1]) {
        var nr2 = addSprite(stringScore[1], 0, 0);
        nr2.x += blankSign[signIndex].x + 26 + 22;
        nr2.y += blankSign[signIndex].y + 16;
        
        numbers.push(nr2);
      }
      
      if (stringScore[2]) {
        var nr3 = addSprite(stringScore[2], 0, 0);
        nr3.x += blankSign[signIndex].x + 26 + 44;
        nr3.y += blankSign[signIndex].y + 16;
        
        numbers.push(nr3);
      }
    });
    
    if (tutorial) {
      game.world.bringToTop(tutorial);
    }
  }
  
  debugLog("New score: " + score);
}

function reset() {
  targetRoom = null;
  
  waitingGuests.forEach(function (guest) {
    if (guest) {
      guest.destroy();
    }
  });
  
  waitingGuests = Array(11).fill(undefined);
  roomsInProgress = Array(25).fill(undefined);
  
  roomLights.forEach(function (light) {
    light.occupied.visible = true;
    light.in_progress.visible = false;
    light.free.visible = false;
  });
  
  bricks.forEach(function (brick) {
    brick.sprite.visible = false;
  });
  
  blankSign.forEach(function (blank) {
    blank.visible = false;
  });
  
  numbers.forEach(function (number) {
    number.destroy();
  });
  
  numbers = [];
  
  gameOverSprite.visible = false;
  score = 0;
  dead = false;
  freeRoom();
  
  spawnNewGuest();
  spawnNewGuest();
  spawnNewGuest();
  spawnNewGuest();
}

function brickWall() {
  sound.gameOver.play();
  
  bricks.forEach(function (brick) {
    brick.sprite.visible = true;
    game.world.bringToTop(brick.sprite);
    brick.sprite.animations.play('build', 10, false);
  });
  
  bricks[0].animation.onComplete.add(function() {
    gameOverSprite.visible = true;
    game.world.bringToTop(gameOverSprite);
    pleaseWait.forEach(function (wait) {
      game.world.bringToTop(wait);
      
      if (movingGuests > 0) {
        wait.visible = true;  
      } else {
        updateScore(0);
      }
    });
  });
}

// Functions
function createGuest(position, type) {
  var spriteIdle = addSprite('guest' + type + '_idle', position + 1, gameHeight - 1);
  var spriteWalk = addSprite('guest' + type + '_walk', position + 1, gameHeight - 1);
  spriteWalk.visible = false;
  
  var sprites = [spriteIdle, spriteWalk]
  
  spriteIdle.animations.add('idle');
  var walkAnimation = spriteWalk.animations.add('walk');
  
  spriteIdle.animations.play('idle', 7 + Math.random(), true);
  if (type != 3) {
    spriteWalk.animations.play('walk', 6, true);
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
      sound.doorOpen.play();
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
          sound.doorClose.play();
          
          sprites.forEach(function(sprite) {
            sprite.destroy();
          });
          movingGuests -= 1;
          
          roomLights[room].toggle();
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
        
          
          var goToDoorTween = game.add.tween(spriteWalk);
          var speedMultiplier2 = elevator.getRight() ? (5 - door) * 2 : (door + 1) * 2 ;
          
          goToDoorTween.onStart.add(function () {
            spriteIdle.visible = false;
            spriteWalk.frame = 0;
            spriteWalk.x = spriteIdle.x;
            spriteWalk.y = spriteIdle.y;
            spriteWalk.visible = true;
          });
          
          goToDoorTween.to({ x: doorToX(door) }, speedMultiplier2 * speed, Phaser.Easing.Default, false, 750);
          
          goToDoorTween.onComplete.add(function () {
            
            var doorOpen = addSprite('door_open', 0, 0);
            doorOpen.x = spriteWalk.x;
            doorOpen.y = spriteWalk.y;
            doors[room].visible = false;
            var doorOpenAnimation = doorOpen.animations.add('door_open');
            doorOpen.animations.play('door_open', 5, false, true);
            sound.doorOpen.play();
            
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
                sound.doorClose.play();
                
                sprites.forEach(function(sprite) {
                  sprite.destroy();
                });
                
                movingGuests -= 1;
                roomLights[room].toggle();
                doors[room].visible = true;
                roomsInProgress[room] = false;
                updateScore(type == 1 ? 2 : 3);
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
      
      spriteDoor.animations.play('close', 10);
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
        var animation = doorOpen.animations.play('open', 10, false);
        sound.elevator.play();
        
        var dummyTween = game.add.tween(sprite);
        dummyTween.to({}, Math.abs(floor - currentFloor) * speed, Phaser.Easing.Default, false, 1000);
        
        dummyTween.onComplete.add(function () {
          spriteDoor.animations.play('close', 10);
          spriteDoor.visible = true;
          game.world.bringToTop(spriteDoor);
          
          if (dead) {
            bricks.forEach(function (brick) {
              game.world.bringToTop(brick.sprite);
            });
            
            [0, 1].forEach(function (i) {
              game.world.bringToTop(pleaseWait[i]);
              game.world.bringToTop(blankSign[i]);
            });
            
            numbers.forEach(function (nr) {
              game.world.bringToTop(nr);
            });
            
            game.world.bringToTop(gameOverSprite);
          }
          
          var elevatorTween2 = game.add.tween(sprite);
          var elevatorDoorTween2 = game.add.tween(spriteDoor);
          
          elevatorTween2.to({ y: unit * yToFloor(0) }, Math.abs(floor - currentFloor) * speed, Phaser.Easing.Default, false, 1000);
          elevatorDoorTween2.to({ y: unit * yToFloor(0) }, Math.abs(floor - currentFloor) * speed, Phaser.Easing.Default, false, 1000);
          
          elevatorTween2.onComplete.add(function () { 
            // if (!dead) {
              sound.elevator.play();
              spriteDoor.visible = false;
              doorOpen.y = sprite.y;
              doorOpen.visible = true;
              game.world.bringToTop(doorOpen);
              
              if (dead) {
                bricks.forEach(function (brick) {
                  game.world.bringToTop(brick.sprite);
                });
                
                [0, 1].forEach(function (i) {
                  game.world.bringToTop(pleaseWait[i]);
                  game.world.bringToTop(blankSign[i]);
                });
                
                numbers.forEach(function (nr) {
                  game.world.bringToTop(nr);
                });
                
                game.world.bringToTop(gameOverSprite);
              }
              
              doorOpen.animations.play('open', 10, false, true);

              animation.onComplete.add(function () {
                busy = false;
              });
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
  
  if (!dead) {
    for (x = 0; x != waitingGuests.length; x++) {
      if (!waitingGuests[x]) {
        availableSlots.push(x);
      }
    }
    
    if (availableSlots.length != 0) {
      var slot = availableSlots[parseInt(Math.random() * availableSlots.length)];
      var type = 1 + parseInt(3 * Math.random());
      
      waitingGuests[slot] = createGuest(slot, type);
    } else if (!dead) {
      brickWall();
      dead = true;
    }
  }
}

function freeRoom () {
  var index, availableRooms = [];
  
  if (!dead && targetRoom == null) {
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
    "ornament",
    "selector",
    "wall",
    "wall_door",
    "wall_with_decoration",
    "painting1",
    "painting2",
    "painting3",
    "painting4",
    "painting5",
    "painting6",
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
    "in_progress",
    "guest1",
    "guest2",
    "guest3",
    "please_wait",
    "blank_sign",
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "elevator_strings"
  ].forEach(function (title) {
    game.load.image(title, 'img/' + title + '.png');
  });
  
  [
    "brick_wall",
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
  
  [
    "teleport",
    "door_open",
    "door_close",
    "elevator",
    "error",
    "select",
    "game_over"
  ].forEach(function (title) {
     game.load.audio(title, 'sound/' + title + '.ogg');
  });
  
  game.load.spritesheet('snow', 'img/snow.png', 48, 32);
  game.load.spritesheet('tutorial', 'img/tutorial.png', 832, 832);
  game.load.spritesheet('game_over', 'img/game_over.png', 96, 16);
}

function handleInput() {
  if (!dead) {
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
      sound.select.play();
      movingGuests += 1;
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
      freeRoom();
    } else if (y == gameHeight - 1 && waitingGuests[x - 1]) {
      guest = waitingGuests[x - 1];
      
      if (guest.getType() == 3) {
        if (targetRoom != null) {
          sound.teleport.play();
          movingGuests += 1;
          roomLights[targetRoom].toggle();
          roomsInProgress[targetRoom] = true;
          guest.teleport(targetRoom);
          targetRoom = null;
          waitingGuests[x - 1] = null;
          freeRoom();
        }
        
        selectedGuest = null;
        selector.hide();
      } else {
        sound.select.play();
        selectedGuest = x;
        debugLog("Selected guest " + selectedGuest)
        selector.select(x, y);
      }
    } else {
      sound.error.play();
    }
  } else if (movingGuests == 0 && !elevatorLeft.getBusy() && !elevatorRight.getBusy() && gameOverSprite.visible == true) {
    if (tutorial) {
      tutorial.destroy();
    }
    reset();
  }
}

function create () {
  document.getElementById("loading").innerHTML = "";
  
  var x = 0, y = 0;
  
  for (y = 1; y != gameHeight; y++) {
    addSprite("elevator_strings", 0, y);
    addSprite("elevator_strings", gameWidth - 1, y);
  }
  
  var brick, animation;
  for (x = 0; x != gameWidth; x++) {
    addSprite("roof", x, 0);
    brick = addSprite("brick_wall", x, gameHeight - 1)
    brick.visible = false;
    animation = brick.animations.add('build');
    bricks.push({ sprite: brick, animation: animation });
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
    
    var ornament = addSprite("ornament", 4, gameHeight - 1);
    ornament.y -= unit / 2;
    
    ornament = addSprite("ornament", 8, gameHeight - 1);
    ornament.y -= unit / 2;
    
    [1, 5, 9].forEach(function (x) {
      var snowSprite = addSprite("snow", x, gameHeight - 2)
      var snowAnimation = snowSprite.animations.add('snow');
      snowSprite.frame = x;
      snowSprite.animations.play('snow', 6, true);
    });
    
    [0, 1].forEach(function (i) {
      pleaseWait[i] = addSprite("please_wait", 0 + (i * 11), gameHeight - 1);
      pleaseWait[i].visible = false;
    });
    
    [0, 1].forEach(function (i) {
      blankSign[i] = addSprite("blank_sign", 0 + (i * 11), gameHeight - 1);
      blankSign[i].visible = false;
    });
    
    gameOverSprite = addSprite("game_over", 4, gameHeight - 1);
    gameOverSprite.visible = false;
    gameOverSprite.x -= unit / 2;
  }
  
  var light;
  
  for (x = 0; x != 25; x++) {
    light = {
      occupied: addSprite("occupied", 2 + 2 * (x % 5), 1 + 2 * parseInt(x / 5)),
      in_progress: addSprite("in_progress", 2 + 2 * (x % 5), 1 + 2 * parseInt(x / 5)),
      free: addSprite("free", 2 + 2 * (x % 5), 1 + 2 * parseInt(x / 5)),
      
      toggle: function () {
        if (this.occupied.visible) {
          this.occupied.visible = false;
          this.free.visible = true;
        } else  if (this.free.visible) {
          this.in_progress.visible = true;
          this.free.visible = false;
        } else if (this.in_progress.visible) {
          this.in_progress.visible = false;
          this.occupied.visible = true;
        }
      }
    }
    
    light.free.visible = false;
    light.in_progress.visible = false;
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
      game.world.bringToTop(this.sprite);
    },
    
    hide: function () {
      this.sprite.visible = false;
    }
  };
  
  sound = {
    select: game.add.audio('select'),
    elevator: game.add.audio('elevator'),
    doorOpen: game.add.audio('door_open'),
    doorClose: game.add.audio('door_close'),
    error: game.add.audio('error'),
    gameOver: game.add.audio('game_over'),
    teleport: game.add.audio('teleport')
  };
  
  selector.hide();
  
  game.input.onDown.add(handleInput);
  
  brickWall();
  
  tutorial = game.add.sprite(0, 0, 'tutorial');
  tutorial.smoothed = false;
  
  game.time.events.loop(3 * Phaser.Timer.SECOND, spawnNewGuest, this);
}