const GAME_WIDTH = 800;
const GAME_HEIGHT = 450;
const PIPE_GAP = 190;
const PIPE_SPEED = -150;
const PIPE_SPAWN_INTERVAL = 2500;
const GRAVITY = 1200;
const FLAP_VELOCITY = -280;
const GROUND_HEIGHT = 80;
const SONAR_SPEED = 250;
const SONAR_RING_WIDTH = 10;
const SONAR_BIRD_RADIUS = 25;

class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        this.load.image('bg', 'assets/bg.png');
        this.load.image('bat_1', 'assets/bat_1.png');
        this.load.image('bat_2', 'assets/bat_2.png');
        this.load.image('bat_3', 'assets/bat_3.png');
        this.load.image('bat_4', 'assets/bat_4.png');
        this.load.image('pipe', 'assets/pipe.png');
        this.load.image('ground', 'assets/ground.png');
        this.load.image('splash', 'assets/splash.png');
        this.load.image('bat_dead', 'assets/bat_dead.png');
        this.load.audio('sonar', 'assets/Sound/Sonar Biatch.mp3');
        this.load.audio('death', 'assets/Sound/Smashed Bat.mp3');
        this.load.audio('music_1', 'assets/Sound/music/Sewr Swing.mp3');
        this.load.audio('music_2', 'assets/Sound/music/Soul Searching in the Soil.mp3');
        this.load.audio('music_3', 'assets/Sound/music/Space Delivery Service.mp3');
    }

    create() {
        this.scene.start('SplashScene');
    }
}

class SplashScene extends Phaser.Scene {
    constructor() {
        super('SplashScene');
    }

    create() {
        this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'splash').setOrigin(0.5);

        this.input.on('pointerdown', () => this.startGame());
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', () => this.startGame());
    }

    startGame() {
        // iOS categorizes Web Audio as "ambient" which respects the hardware
        // mute switch. Playing a brief silent sound via an HTML5 Audio element
        // during a user gesture promotes the session to "playback" mode,
        // making Web Audio ignore the mute switch (matching native app behavior).
        const silence = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRBqSAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRBqSAAAAAAAAAAAAAAAAAAAA');
        silence.play().catch(() => {});

        const ctx = this.sound.context;
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().then(() => {
                this.scene.start('GameScene');
            });
        } else {
            this.scene.start('GameScene');
        }
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.score = 0;
        this.gameOver = false;
        this.canRestart = false;
        this.started = false;
    }

    create() {
        this.score = 0;
        this.gameOver = false;
        this.canRestart = false;
        this.started = false;

        // Start background music (random track)
        const musicKeys = ['music_1', 'music_2', 'music_3'];
        this.sound.stopAll();
        this.sound.play(Phaser.Utils.Array.GetRandom(musicKeys), { loop: true });

        // Background (tiled)
        this.bg = this.add.tileSprite(
            GAME_WIDTH / 2, GAME_HEIGHT / 2,
            GAME_WIDTH, GAME_HEIGHT,
            'bg'
        );

        // Pipes group
        this.pipes = this.physics.add.group();

        // Bird (bat)
        this.batFrames = ['bat_1', 'bat_2', 'bat_3', 'bat_4'];
        this.batAnimTimer = null;
        this.bird = this.physics.add.sprite(GAME_WIDTH * 0.15, GAME_HEIGHT / 2 - 40, 'bat_1');
        this.bird.body.setSize(50, 50);
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

        // --- Sonar wave darkness overlay ---
        this.bird.setDepth(6);
        this.ground1.setDepth(0);

        this.sonarCanvas = this.textures.createCanvas('sonar_overlay_' + Date.now(), GAME_WIDTH, GAME_HEIGHT);
        this.darkImage = this.add.image(0, 0, this.sonarCanvas.key).setOrigin(0, 0).setDepth(5);

        this.sonarWaves = [];

        // Emit an initial wave immediately
        this.sonarWaves.push({ x: this.bird.x, y: this.bird.y, radius: 0 });
    }

    flap() {
        if (this.gameOver) {
            if (this.canRestart) {
                this.scene.restart();
            }
            return;
        }

        if (!this.started) {
            this.started = true;
            this.bird.body.allowGravity = true;
            this.pipeTimer.paused = false;
            this.spawnPipes();
        }

        this.bird.setVelocityY(FLAP_VELOCITY);

        // Play sonar sound
        this.sound.play('sonar');

        // Play bat flap animation
        this.playBatFlap();

        // Emit sonar wave on each flap
        this.sonarWaves.push({ x: this.bird.x, y: this.bird.y, radius: 0 });
    }

    playBatFlap() {
        if (this.batAnimTimer) {
            this.batAnimTimer.remove();
        }
        let frameIndex = 0;
        this.bird.setTexture(this.batFrames[frameIndex]);
        this.batAnimTimer = this.time.addEvent({
            delay: 60,
            callback: () => {
                frameIndex++;
                if (frameIndex < this.batFrames.length) {
                    this.bird.setTexture(this.batFrames[frameIndex]);
                } else {
                    this.bird.setTexture('bat_1');
                    this.batAnimTimer.remove();
                    this.batAnimTimer = null;
                }
            },
            repeat: this.batFrames.length - 1,
        });
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

        // Switch to dead sprite and play death sound
        this.bird.setTexture('bat_dead');
        this.sound.play('death');

        // Stop physics for everything except the bird
        this.pipes.setVelocityX(0);
        this.bird.body.allowGravity = false;
        this.bird.setCollideWorldBounds(false);

        // Mario-style death: pop up then fall off screen
        this.tweens.add({
            targets: this.bird,
            angle: 180,
            duration: 400,
            ease: 'Cubic.easeOut',
        });
        this.tweens.add({
            targets: this.bird,
            y: this.bird.y - 80,
            duration: 300,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: this.bird,
                    y: GAME_HEIGHT + 100,
                    duration: 1000,
                    ease: 'Quad.easeIn',
                    onComplete: () => {
                        this.canRestart = true;
                    },
                });
            },
        });

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

    updateSonarOverlay() {
        const delta = this.game.loop.delta / 1000;
        const maxRadius = Math.sqrt(GAME_WIDTH * GAME_WIDTH + GAME_HEIGHT * GAME_HEIGHT);

        const ctx = this.sonarCanvas.getContext();
        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Fill with near-opaque black
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        // Switch to destination-out to cut transparent holes
        ctx.globalCompositeOperation = 'destination-out';

        // Expand and draw sonar wave rings
        for (let i = this.sonarWaves.length - 1; i >= 0; i--) {
            const wave = this.sonarWaves[i];
            wave.radius += SONAR_SPEED * delta;

            if (wave.radius > maxRadius) {
                this.sonarWaves.splice(i, 1);
                continue;
            }

            const progress = wave.radius / maxRadius;
            const alpha = Math.max(0, 1 - progress);

            ctx.lineWidth = SONAR_RING_WIDTH;
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.globalCompositeOperation = 'source-over';
        this.sonarCanvas.refresh();
    }

    update() {
        this.updateSonarOverlay();

        // Space to flap (must be before gameOver check so restart works)
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.flap();
        }

        if (this.gameOver) return;

        // Scroll ground
        this.ground1.tilePositionX += 2;

        // Scroll background slowly
        this.bg.tilePositionX += 0.5;

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
    scene: [BootScene, SplashScene, GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
};

const game = new Phaser.Game(config);
