var init = (function () {
  var debug = true;
  var tileSize = 16;
  var scale = 4;
  var unit = tileSize * scale;
  var gameWidth = 13;
  var gameHeight = 13;
  var game = new Phaser.Game(gameWidth * unit, gameHeight * unit, Phaser.AUTO, '', { preload: preload, create: create, update: update });
  
  var waitingGuests = [];
  var roomsInProgress = [];
  var roomLights = [];
  var targetRoom = null;
  var selectedGuest = null;
  
  function debugLog(msg) {
    if (debug) {
      console.log(msg);
    }
  }


  var createGuest = (function (position, type) {
    var sprite = addSprite("guest" + type, position + 1, gameHeight - 1);
    var speed = 500;
    
      if (type == 2) {
        speed = 1000;
      }
    
    function doorToX(door) {
      return unit * ((1 + door) * 2);
    }
    
    function floorToY(floor) {
      console.log(floor);
      return unit * (gameHeight - 1 - (floor * 2));
    }
    
    function floorFromRoom(room) {
      return 5 - parseInt(room / 5);
    }
    
    function doorFromRoom(room) {
      return room % 5;
    }
    
    return {
      type : type,
      
      teleport: function (room) {
        var floor = floorFromRoom(room);
        var door = doorFromRoom(room);
        
        var x = doorToX(door)
        var y = floorToY(floor);
        
        debugLog("Teleporting to x " + x + ", y " + y)
        
        sprite.position.x = x;
        sprite.position.y = y;
        
        
        game.time.events.add(Phaser.Timer.SECOND, function () {
          roomsInProgress[targetRoom] = true;
          sprite.destroy();
        }, true);
      },
      
      goToElevator: function (elevator, room) {
        var floor = floorFromRoom(room);
        var door = doorFromRoom(room);
        debugLog("Going to room " + room + " (floor " + floor + " and door " + door + ")")
        
        var tween1 = game.add.tween(sprite);
        tween1.to({ x: unit * 12 }, (11 - position) * speed, Phaser.Easing.Default, false, 0);

        tween1.onComplete.add(function () { 
          elevator.move(floor);
          
          var tween2 = game.add.tween(sprite);
          elevator.elevatorUpTween(floor, tween2);
          
          tween2.onComplete.add(function () {
            var moveToDoor = game.add.tween(sprite);
            moveToDoor.to({ x: doorToX(door) }, (5 - door) * 2 * speed, Phaser.Easing.Default, false, 0);
            moveToDoor.onComplete.add(function () {
              game.time.events.add(Phaser.Timer.SECOND, function () {
                roomsInProgress[room] = false;
                sprite.destroy();
              }, this);
            });
            moveToDoor.start();
          });
          
          tween2.start();
        });
        
        tween1.start();
      }
    };
  });

  var createElevator = (function() {
    var currentFloor = 0;
    var isBusy = false;
    
    var x = gameWidth - 1;
    var y = yToFloor(currentFloor);
    
    var sprite = addSprite("elevator", x, y);
    
    function yToFloor(y) {
      return gameHeight - 1 - (y * 2);
    }
    
    return {
      busy: isBusy,
      
      elevatorUpTween: function (floor, tween) {
        tween.to({ y: unit * yToFloor(floor) }, Math.abs(floor - currentFloor) * 1500, Phaser.Easing.Default, false, 1500)
      },
      
      move: function (floor) {
        self = this;
        var elevatorTween = game.add.tween(sprite);
        this.elevatorUpTween(floor, elevatorTween);
        elevatorTween.to({ y: unit * yToFloor(0) }, Math.abs(floor - currentFloor) * 1500, Phaser.Easing.Default, false, 1500);
        elevatorTween.onComplete.add(function () {
          self.busy = false;
        });
        elevatorTween.start();
      }
    };
  });
  
  var createSelector = (function () {
    var sprite = addSprite("selector", 3, gameHeight - 1);
    sprite.visible = false;
    
    return {
      select: function (x, y) {
        sprite.x = unit * x;
        sprite.y = unit * y;
        sprite.visible = true;
      },
      
      hide: function () {
        sprite.visible = false;
      }
    }
  });
  
  function addSprite(name, x, y) {
    var sprite = game.add.sprite(x * unit, y * unit, name);
    sprite.scale.setTo(scale, scale);
    sprite.smoothed = false;
    return sprite;
  }
  
  function update() {
    
  }
  
  function spawn (create) {
    return (function() {
      var availableSlots = [];
      
      for (var x = 0; x != 11; x++) {
        !waitingGuests[x] && availableSlots.push(x);
      }
      
      if (availableSlots.length != 0) {
        var slot = availableSlots[parseInt(Math.random() * availableSlots.length)];
        var type = 1 + parseInt(3 * Math.random());
        waitingGuests[slot] = create(slot, type);
      }
    });
  }
  
  function freeRoom () {
    var availableRooms = [];
    
    if (targetRoom == null) {
      for (var x = 0; x != 25; x++) {
        if (!roomsInProgress[x]) {
          availableRooms.push(x);
        }
      }
      
      if (availableRooms.length > 0) {
        var index = parseInt(availableRooms.length * Math.random());
        targetRoom = availableRooms[index];
        roomLights[targetRoom].toggle();
        debugLog("Freed room: " + targetRoom);
      }
    }
  }
  
  function preload () {
    game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
    game.scale.pageAlignHorizontally = true;
    game.scale.pageAlignVertically = true;
    
    ["selector", "wall", "painting", "door", "roof", "elevator", "floor", "stairs", "person", "sign", "occupied", "free", "guest1", "guest2", "guest3", "elevator_strings"].forEach(function (title) {
      game.load.image(title, 'img/' + title + '.png');
    });
  }

  function create () {
    // Add roof
    (function() {
      for (var x = 0; x != gameWidth; x++) {
        
      }
    })();
    
    (function() {
      for (var x = 0; x != gameWidth; x++) {
        for (var y = 0; y != gameHeight; y++) {
          
          
          if (x == gameWidth - 1) {
            addSprite("elevator_strings", x, y);
          }
          
          if (y == 0) {
            addSprite("roof", x, y);
          }
          
          if (x == 0 && y > 0 && y < gameHeight) {
            addSprite("stairs", x, y)
          }
          
          if (x > 0 && y > 0 && x < gameWidth - 1 && y < gameHeight) {
            addSprite("wall", x, y)
            
            if (y % 2 == 1) {
              addSprite("floor", x, y)
            }
          }
           
          if (x > 0 && y > 0 && x < gameWidth - 1 && y < gameHeight - 2) {
            
            if (x % 2 == 0 && y % 2 == 0) {
              addSprite("door", x, y)
            //   addSprite("occupied", x, y)
            }
            
            if (x % 2 == 1 && y % 2 == 0) {
              addSprite("painting", x, y)
            }
          }
          
          // if (x > 0 && x < gameWidth - 1 && y == gameHeight - 1) {
          //   addSprite("guest1", x, y);
          // }
        }
      }
    })();
    
    for (var x = 0; x != 25; x++) {
      var light = (function () {
        var occupied = addSprite("occupied", 2 + 2 * (x % 5), 2 + 2 * parseInt(x / 5));
        var free = addSprite("free", 2 + 2 * (x % 5), 2 + 2 * parseInt(x / 5));
        free.visible = false;
        
        return {
          toggle: function () {
            free.visible = !free.visible;
            occupied.visible = !occupied.visible;
          }
        }
      })();
      
      roomLights.push(light);
    }

    addSprite("sign", 5, 0);
    
    var elevator = createElevator();
    var selector = createSelector();
    
    game.input.onDown.add(function () {
      var y = parseInt(game.input.y / unit);
      var x = parseInt(game.input.x / unit);
      
      debugLog("Target room " + targetRoom)
      debugLog("Elevator busy " + elevator.busy)
      
      if (y == gameHeight - 1 && x == gameWidth - 1 && selectedGuest && !elevator.busy && targetRoom) {
        var guest = waitingGuests[selectedGuest - 1];
        waitingGuests[selectedGuest - 1] = null;
        elevator.busy = true;
        selector.select(x, y);
        roomsInProgress[targetRoom] = true;
        roomLights[targetRoom].toggle();
        guest.goToElevator(elevator, targetRoom);
        selectedGuest = null;
        selector.hide();
        targetRoom = null;
      } else if (y == gameHeight - 1 && waitingGuests[x - 1]) {
        var guest = waitingGuests[x - 1]
        if (guest.type == 3) {
          guest.teleport(targetRoom);
          roomLights[targetRoom].toggle();
          roomsInProgress[targetRoom] = true;
          targetRoom = null;
        } else {
          selectedGuest = x;
          debugLog("Selected guest " + selectedGuest)
          selector.select(x, y);
        }
      } else {
        selectedGuest = null;
        selector.hide();
      }
    });
    
    //elevator.move(3);
    
    game.time.events.loop(1 * Phaser.Timer.SECOND, spawn(createGuest), this);
    game.time.events.loop(Phaser.Timer.SECOND, freeRoom, this);
  }
})