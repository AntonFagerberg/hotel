var init = (function () {
  var tileSize = 16;
  var scale = 4;
  var unit = tileSize * scale;
  var gameWidth = 13;
  var gameHeight = 15;
  var game = new Phaser.Game(gameWidth * unit, gameHeight * unit, Phaser.AUTO, '', { preload: preload, create: create, update: update });
  
  var waitingGuests = [];
  var selectedGuest = null;
  
  var createGuest = (function (position) {
    var sprite = addSprite("guest1", position + 1, 14);
    
    function doorToX(door) {
      return unit * ((1 + door) * 2);
    }
    
    return {
      goToElevator: function (elevator, door) {
        var tween1 = game.add.tween(sprite);
        tween1.to({ x: unit * 12 }, (12 - position) * 500, Phaser.Easing.Default, false, 0);

        tween1.onComplete.add(function () { 
          elevator.move(2);
          
          var tween2 = game.add.tween(sprite);
          elevator.elevatorUpTween(2, tween2);
          tween2.onComplete.add(function () {
            var tween3 = game.add.tween(sprite);
            var targetX = doorToX(door);
            tween3.to({ x: targetX }, (12 - (2 * (1 + door))) * 500, Phaser.Easing.Default, false, 0);
            tween3.start();
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
    
    function yToFloor(y) {
      return gameHeight - 1 - (y * 2);
    }
    
    var x = gameWidth - 1;
    var y = yToFloor(currentFloor);
    
    var sprite = addSprite("elevator", x, y);
    var tween = game.add.tween(sprite);
    
    return {
      busy: isBusy,
      
      elevatorUpTween: function (floor, tween) {
        tween.to({ y: unit * yToFloor(floor) }, Math.abs(floor - currentFloor) * 1500, Phaser.Easing.Default, false, 1500)
      },
      
      move: function (floor) {
        // console.log(this);
        // console.log(guestTween);
        // guestTween.to({ y: unit * yToFloor(floor) }, Math.abs(floor - currentFloor) * 1500, Phaser.Easing.Default, false, 1500);
        // guestTween.start();
        this.elevatorUpTween(floor, tween);
        // tween.to({ y: unit * yToFloor(floor) }, Math.abs(floor - currentFloor) * 1500, Phaser.Easing.Default, false, 1500);
        tween.to({ y: unit * yToFloor(0) }, Math.abs(floor - currentFloor) * 1500, Phaser.Easing.Default, false, 1500);
        tween.start();
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
        waitingGuests[slot] = create(slot);
      }
    });
  }
  
  function preload () {
    game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
    game.scale.pageAlignHorizontally = true;
    game.scale.pageAlignVertically = true;
    
    ["selector", "wall", "painting", "door", "roof", "elevator", "floor", "stairs", "person", "sign", "occupied", "free", "guest1", "elevator_strings"].forEach(function (title) {
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
              addSprite("occupied", x, y)
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

    addSprite("sign", 5, 0);
    
    var elevator = createElevator();
    var selector = createSelector();
    
    game.input.onDown.add(function () {
      var y = parseInt(game.input.y / unit);
      var x = parseInt(game.input.x / unit);
      var guest = waitingGuests[x - 1];
      
      console.log(x, y);
      
      if (y == 14 && x == 12 && selectedGuest && !elevator.busy) {
        selector.select(x, y);
        selectedGuest.goToElevator(elevator);
        elevator.busy = true;
        selectedGuest = null;
      } else if (y == 14 && guest) {
        selectedGuest = guest;
        selector.select(x, y);
      } else {
        selectedGuest = null;
        selector.hide();
      }
    });
    
    //elevator.move(3);
    
    game.time.events.loop(1 * Phaser.Timer.SECOND, spawn(createGuest), this);
  }
})