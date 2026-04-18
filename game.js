const GAME_WIDTH = 800;
const GAME_HEIGHT = 450;
const PIPE_GAP = 130;
const PIPE_SPEED = -250;
const PIPE_SPAWN_INTERVAL = 1500;
const GRAVITY = 1200;
const FLAP_VELOCITY = -380;
const GROUND_HEIGHT = 80;

class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        this.load.image('bg', 'assets/bg.png');
        this.load.image('bird', 'assets/bird.png');
        this.load.image('pipe', 'assets/pipe.png');
        this.load.image('ground', 'assets/ground.png');
    }

    create() {
        this.scene.start('GameScene');
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.score = 0;
        this.gameOver = false;
        this.started = false;
    }

    create() {
        this.score = 0;
        this.gameOver = false;
        this.started = false;

        // Background (tiled)
        this.bg = this.add.tileSprite(
            GAME_WIDTH / 2, GAME_HEIGHT / 2,
            GAME_WIDTH, GAME_HEIGHT,
            'bg'
        );

        // Pipes group
        this.pipes = this.physics.add.group();

        // Bird
        this.bird = this.physics.add.sprite(GAME_WIDTH * 0.15, GAME_HEIGHT / 2 - 40, 'bird');
        this.bird.setGravityY(GRAVITY);
        this.bird.setCollideWorldBounds(true);
        this.bird.body.allowGravity = false; // no gravity until game starts

        // Ground (tiled, scrolling)
        this.ground1 = this.add.tileSprite(
            GAME_WIDTH / 2, GAME_HEIGHT - GROUND_HEIGHT / 2,
            GAME_WIDTH, GROUND_HEIGHT,
            'ground'
        );
        this.groundPhysics = this.physics.add.staticImage(
            GAME_WIDTH / 2, GAME_HEIGHT - GROUND_HEIGHT / 2
        );
        this.groundPhysics.setDisplaySize(GAME_WIDTH, GROUND_HEIGHT);
        this.groundPhysics.refreshBody();
        this.groundPhysics.setAlpha(0); // invisible, just for collision

        // Score text
        this.scoreText = this.add.text(GAME_WIDTH / 2, 40, '0', {
            fontSize: '40px',
            fontFamily: 'Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5).setDepth(10);

        // Instructions
        this.instructions = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, 'Tap or Press Space\nto Start', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center',
        }).setOrigin(0.5).setDepth(10);

        // Input
        this.input.on('pointerdown', () => this.flap());
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Collisions
        this.physics.add.collider(this.bird, this.groundPhysics, () => this.hitObstacle());
        this.physics.add.overlap(this.bird, this.pipes, () => this.hitObstacle());

        // Pipe timer (paused until start)
        this.pipeTimer = this.time.addEvent({
            delay: PIPE_SPAWN_INTERVAL,
            callback: this.spawnPipes,
            callbackScope: this,
            loop: true,
            paused: true,
        });
    }

    flap() {
        if (this.gameOver) {
            this.scene.restart();
            return;
        }

        if (!this.started) {
            this.started = true;
            this.bird.body.allowGravity = true;
            this.pipeTimer.paused = false;
            this.instructions.setVisible(false);
            this.spawnPipes();
        }

        this.bird.setVelocityY(FLAP_VELOCITY);
    }

    spawnPipes() {
        const playAreaHeight = GAME_HEIGHT - GROUND_HEIGHT;
        const minPipeTop = 50;
        const maxPipeTop = playAreaHeight - PIPE_GAP - 50;
        const pipeTopY = Phaser.Math.Between(minPipeTop, maxPipeTop);

        // Top pipe (flipped)
        const topPipe = this.pipes.create(GAME_WIDTH + 30, pipeTopY, 'pipe');
        topPipe.setOrigin(0.5, 1);
        topPipe.setFlipY(true);
        topPipe.body.setVelocityX(PIPE_SPEED);
        topPipe.body.allowGravity = false;
        topPipe.body.immovable = true;
        topPipe.setDepth(1);

        // Bottom pipe
        const bottomPipe = this.pipes.create(GAME_WIDTH + 30, pipeTopY + PIPE_GAP, 'pipe');
        bottomPipe.setOrigin(0.5, 0);
        bottomPipe.body.setVelocityX(PIPE_SPEED);
        bottomPipe.body.allowGravity = false;
        bottomPipe.body.immovable = true;
        bottomPipe.setDepth(1);

        // Score zone (invisible trigger between pipes)
        const scoreZone = this.physics.add.sprite(GAME_WIDTH + 30, pipeTopY + PIPE_GAP / 2);
        scoreZone.setSize(4, PIPE_GAP);
        scoreZone.setAlpha(0);
        scoreZone.body.setVelocityX(PIPE_SPEED);
        scoreZone.body.allowGravity = false;
        scoreZone.scored = false;

        // Check score overlap
        this.physics.add.overlap(this.bird, scoreZone, (bird, zone) => {
            if (!zone.scored) {
                zone.scored = true;
                this.score++;
                this.scoreText.setText(this.score.toString());
            }
        });
    }

    hitObstacle() {
        if (this.gameOver) return;
        this.gameOver = true;
        this.pipeTimer.paused = true;

        this.bird.setVelocityY(0);
        this.bird.setVelocityX(0);
        this.bird.body.allowGravity = false;
        this.physics.pause();

        // Flash red
        this.cameras.main.flash(200, 255, 50, 50);

        // Game over text
        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'GAME OVER', {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#ff0000',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5).setDepth(10);

        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, `Score: ${this.score}`, {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5).setDepth(10);

        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50, 'Tap or Space to Restart', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5).setDepth(10);
    }

    update() {
        if (this.gameOver) return;

        // Scroll ground
        this.ground1.tilePositionX += 2;

        // Scroll background slowly
        this.bg.tilePositionX += 0.5;

        // Space to flap
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.flap();
        }

        // Rotate bird based on velocity
        if (this.started) {
            const vy = this.bird.body.velocity.y;
            if (vy < 0) {
                this.bird.angle = Math.max(-25, vy * 0.06);
            } else {
                this.bird.angle = Math.min(90, vy * 0.1);
            }
        }

        // Clean up off-screen pipes
        this.pipes.getChildren().forEach(pipe => {
            if (pipe.x < -60) {
                pipe.destroy();
            }
        });
    }
}

const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false,
        },
    },
    scene: [BootScene, GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
};

const game = new Phaser.Game(config);
