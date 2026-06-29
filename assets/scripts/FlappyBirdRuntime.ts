import {
  _decorator,
  Component,
  director,
  Director,
  EventKeyboard,
  EventMouse,
  EventTouch,
  input,
  Input,
  KeyCode,
  Label,
  Layers,
  Node,
  resources,
  Scene,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec3,
  view,
} from "cc";

const { ccclass } = _decorator;

type PipePair = {
  x: number;
  gapCenterY: number;
  passed: boolean;
  root: Node;
};

type GameSprites = {
  sky: SpriteFrame;
  ground: SpriteFrame;
  pipe: SpriteFrame;
  birdFrames: SpriteFrame[];
};

const SPRITE_PATHS = {
  sky: "sprites/background/sky/spriteFrame",
  ground: "sprites/ground/ground/spriteFrame",
  pipe: "sprites/pipes/pipe/spriteFrame",
  birdUp: "sprites/bird/bird_up/spriteFrame",
  birdMid: "sprites/bird/bird_mid/spriteFrame",
  birdDown: "sprites/bird/bird_down/spriteFrame",
} as const;

@ccclass("FlappyBirdController")
class FlappyBirdController extends Component {
  private readonly gravity = -1580;
  private readonly flapVelocity = 545;
  private readonly pipeSpeed = 275;
  private readonly pipeGap = 214;
  private readonly pipeWidth = 104;
  private readonly pipeHeight = 500;
  private readonly groundHeight = 112;
  private readonly birdRadius = 24;
  private readonly spawnInterval = 1.42;
  private readonly birdFrameInterval = 0.11;

  private canvasTransform!: UITransform;
  private sprites: GameSprites | null = null;

  private worldNode!: Node;
  private pipeLayer!: Node;
  private bird!: Node;
  private birdSprite!: Sprite;
  private scoreLabel!: Label;
  private titleLabel!: Label;
  private hintLabel!: Label;
  private gameOverLabel!: Label;
  private groundA!: Node;
  private groundB!: Node;
  private loadingLabel!: Label;

  private pipePairs: PipePair[] = [];
  private velocityY = 0;
  private score = 0;
  private spawnTimer = 0;
  private elapsed = 0;
  private started = false;
  private gameOver = false;
  private birdBaseY = 0;
  private birdFrameTimer = 0;
  private birdFrameIndex = 0;

  onLoad() {
    this.canvasTransform = this.node.parent!.getComponent(UITransform)!;
    this.createLoadingLabel();
    this.bindInput();
    this.preloadAssets();
  }

  onDestroy() {
    input.off(Input.EventType.TOUCH_START, this.onPress, this);
    input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
  }

  update(dt: number) {
    if (!this.sprites || !this.bird) {
      return;
    }

    this.elapsed += dt;
    this.animateBird(dt);

    if (!this.started) {
      this.bird.setPosition(this.bird.position.x, this.birdBaseY + Math.sin(this.elapsed * 3.4) * 10);
      this.bird.angle = Math.sin(this.elapsed * 5) * 4;
      return;
    }

    this.updateGround(dt);
    this.updatePipes(dt);

    if (!this.gameOver) {
      this.velocityY += this.gravity * dt;
      const nextY = this.bird.position.y + this.velocityY * dt;
      this.bird.setPosition(this.bird.position.x, nextY);
      this.bird.angle = Math.max(-72, Math.min(24, this.velocityY * 0.08));

      this.spawnTimer += dt;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;
        this.spawnPipePair();
      }

      this.checkBounds();
      this.checkCollisions();
      return;
    }

    this.velocityY += this.gravity * dt * 0.7;
    const minY = this.getFloorY() + this.birdRadius;
    const nextY = Math.max(minY, this.bird.position.y + this.velocityY * dt);
    this.bird.setPosition(this.bird.position.x, nextY);
    this.bird.angle = Math.max(-90, this.bird.angle - 180 * dt);
  }

  private createLoadingLabel() {
    const labelNode = this.createNode("Loading", this.node, 0, 0, 50, 480, 64);
    this.loadingLabel = labelNode.addComponent(Label);
    this.loadingLabel.string = "Loading assets...";
    this.loadingLabel.fontSize = 28;
    this.loadingLabel.lineHeight = 34;
    this.loadingLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
  }

  private async preloadAssets() {
    try {
      const [sky, ground, pipe, birdUp, birdMid, birdDown] = await Promise.all([
        this.loadSpriteFrame(SPRITE_PATHS.sky),
        this.loadSpriteFrame(SPRITE_PATHS.ground),
        this.loadSpriteFrame(SPRITE_PATHS.pipe),
        this.loadSpriteFrame(SPRITE_PATHS.birdUp),
        this.loadSpriteFrame(SPRITE_PATHS.birdMid),
        this.loadSpriteFrame(SPRITE_PATHS.birdDown),
      ]);

      this.sprites = {
        sky,
        ground,
        pipe,
        birdFrames: [birdUp, birdMid, birdDown, birdMid],
      };

      this.loadingLabel.node.destroy();
      this.buildScene();
      this.resetGame();
    } catch (error) {
      this.loadingLabel.string = "Asset load failed";
      console.error(error);
    }
  }

  private loadSpriteFrame(path: string) {
    return new Promise<SpriteFrame>((resolve, reject) => {
      resources.load(path, SpriteFrame, (error, asset) => {
        if (error || !asset) {
          reject(error ?? new Error(`Missing asset: ${path}`));
          return;
        }
        resolve(asset);
      });
    });
  }

  private bindInput() {
    input.on(Input.EventType.TOUCH_START, this.onPress, this);
    input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
  }

  private onMouseDown(event: EventMouse) {
    if (event.getButton() !== EventMouse.BUTTON_LEFT) {
      return;
    }
    this.handlePress();
  }

  private onPress(_event?: EventTouch) {
    this.handlePress();
  }

  private onKeyDown(event: EventKeyboard) {
    if (event.keyCode === KeyCode.SPACE || event.keyCode === KeyCode.ARROW_UP) {
      this.handlePress();
    }
  }

  private handlePress() {
    if (!this.sprites) {
      return;
    }

    if (this.gameOver) {
      this.resetGame();
      return;
    }

    if (!this.started) {
      this.started = true;
      this.titleLabel.string = "";
      this.hintLabel.string = "";
      this.spawnPipePair();
    }

    this.velocityY = this.flapVelocity;
    this.bird.angle = 20;
    this.birdFrameIndex = 0;
    this.birdSprite.spriteFrame = this.sprites.birdFrames[this.birdFrameIndex];
  }

  private buildScene() {
    const sprites = this.sprites!;
    this.worldNode = this.createNode("World", this.node, 0, 0, 0, this.canvasTransform.width, this.canvasTransform.height);

    const sky = this.createSpriteNode("Sky", this.worldNode, 0, 0, -30, this.canvasTransform.width, this.canvasTransform.height, sprites.sky);
    sky.getComponent(Sprite)!.sizeMode = Sprite.SizeMode.CUSTOM;

    this.pipeLayer = this.createNode("Pipes", this.worldNode, 0, 0, 5, this.canvasTransform.width, this.canvasTransform.height);
    this.createBird();
    this.createGround();
    this.createHud();
  }

  private createBird() {
    const sprites = this.sprites!;
    this.bird = this.createSpriteNode("Bird", this.worldNode, -220, 40, 20, 96, 72, sprites.birdFrames[1]);
    this.birdSprite = this.bird.getComponent(Sprite)!;
    this.birdSprite.sizeMode = Sprite.SizeMode.CUSTOM;
  }

  private createGround() {
    const sprites = this.sprites!;
    this.groundA = this.createSpriteNode("GroundA", this.worldNode, 0, this.getFloorY(), 30, 1024, this.groundHeight, sprites.ground);
    this.groundB = this.createSpriteNode("GroundB", this.worldNode, 1024, this.getFloorY(), 30, 1024, this.groundHeight, sprites.ground);
  }

  private createHud() {
    this.scoreLabel = this.createLabel("Score", this.worldNode, 0, this.canvasTransform.height / 2 - 58, 60, 48);
    this.titleLabel = this.createLabel("Title", this.worldNode, 0, 120, 54, 60);
    this.hintLabel = this.createLabel("Hint", this.worldNode, 0, 60, 24, 34);
    this.gameOverLabel = this.createLabel("GameOver", this.worldNode, 0, -32, 30, 40);
  }

  private resetGame() {
    this.started = false;
    this.gameOver = false;
    this.velocityY = 0;
    this.score = 0;
    this.spawnTimer = 0;
    this.elapsed = 0;
    this.birdFrameTimer = 0;
    this.birdFrameIndex = 1;
    this.scoreLabel.string = "0";
    this.titleLabel.string = "Flappy Bird";
    this.hintLabel.string = "Tap, click, or press Space to fly";
    this.gameOverLabel.string = "";

    for (const pipe of this.pipePairs) {
      pipe.root.destroy();
    }
    this.pipePairs.length = 0;

    const width = this.canvasTransform.width;
    this.birdBaseY = 40;
    this.bird.setPosition(-width * 0.23, this.birdBaseY);
    this.bird.angle = 0;
    this.birdSprite.spriteFrame = this.sprites!.birdFrames[this.birdFrameIndex];

    this.groundA.setPosition(0, this.getFloorY());
    this.groundB.setPosition(1024, this.getFloorY());
  }

  private createLabel(name: string, parent: Node, x: number, y: number, fontSize: number, lineHeight: number) {
    const node = this.createNode(name, parent, x, y, 40, 720, 88);
    const label = node.addComponent(Label);
    label.fontSize = fontSize;
    label.lineHeight = lineHeight;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.color.fromHEX("#FFFFFF");
    label.enableOutline = true;
    label.outlineWidth = 4;
    label.overflow = Label.Overflow.SHRINK;
    return label;
  }

  private spawnPipePair() {
    const sprites = this.sprites!;
    const width = this.canvasTransform.width;
    const playableHeight = this.canvasTransform.height - this.groundHeight - 120;
    const minCenter = this.getFloorY() + 120 + this.pipeGap / 2;
    const maxCenter = minCenter + playableHeight - this.pipeGap;
    const centerY = minCenter + Math.random() * Math.max(24, maxCenter - minCenter);

    const root = this.createNode("PipePair", this.pipeLayer, width / 2 + 120, 0, 10, this.pipeWidth, this.canvasTransform.height);
    const top = this.createSpriteNode("TopPipe", root, 0, centerY + this.pipeGap / 2, 0, this.pipeWidth, this.pipeHeight, sprites.pipe);
    top.angle = 180;
    const bottom = this.createSpriteNode("BottomPipe", root, 0, centerY - this.pipeGap / 2, 0, this.pipeWidth, this.pipeHeight, sprites.pipe);
    top.getComponent(Sprite)!.sizeMode = Sprite.SizeMode.CUSTOM;
    bottom.getComponent(Sprite)!.sizeMode = Sprite.SizeMode.CUSTOM;

    this.pipePairs.push({
      x: width / 2 + 120,
      gapCenterY: centerY,
      passed: false,
      root,
    });
  }

  private updatePipes(dt: number) {
    const birdX = this.bird.position.x;

    for (let i = this.pipePairs.length - 1; i >= 0; i -= 1) {
      const pipe = this.pipePairs[i];
      pipe.x -= this.pipeSpeed * dt;
      pipe.root.setPosition(pipe.x, 0);

      if (!pipe.passed && pipe.x + this.pipeWidth / 2 < birdX) {
        pipe.passed = true;
        this.score += 1;
        this.scoreLabel.string = `${this.score}`;
      }

      if (pipe.x < -this.canvasTransform.width / 2 - this.pipeWidth - 80) {
        pipe.root.destroy();
        this.pipePairs.splice(i, 1);
      }
    }
  }

  private updateGround(dt: number) {
    const scroll = this.pipeSpeed * dt;
    this.groundA.setPosition(this.groundA.position.x - scroll, this.getFloorY());
    this.groundB.setPosition(this.groundB.position.x - scroll, this.getFloorY());

    if (this.groundA.position.x <= -1024) {
      this.groundA.setPosition(this.groundB.position.x + 1024, this.getFloorY());
    }
    if (this.groundB.position.x <= -1024) {
      this.groundB.setPosition(this.groundA.position.x + 1024, this.getFloorY());
    }
  }

  private animateBird(dt: number) {
    if (!this.sprites) {
      return;
    }

    this.birdFrameTimer += dt;
    if (this.birdFrameTimer < this.birdFrameInterval) {
      return;
    }

    this.birdFrameTimer = 0;
    this.birdFrameIndex = (this.birdFrameIndex + 1) % this.sprites.birdFrames.length;
    this.birdSprite.spriteFrame = this.sprites.birdFrames[this.birdFrameIndex];
  }

  private checkBounds() {
    const ceiling = this.canvasTransform.height / 2 - this.birdRadius;
    const floor = this.getFloorY() + this.birdRadius;
    if (this.bird.position.y >= ceiling || this.bird.position.y <= floor) {
      this.triggerGameOver();
    }
  }

  private checkCollisions() {
    if (this.gameOver) {
      return;
    }

    const birdLeft = this.bird.position.x - this.birdRadius;
    const birdRight = this.bird.position.x + this.birdRadius;
    const birdTop = this.bird.position.y + this.birdRadius;
    const birdBottom = this.bird.position.y - this.birdRadius;

    for (const pipe of this.pipePairs) {
      const pipeLeft = pipe.x - this.pipeWidth / 2;
      const pipeRight = pipe.x + this.pipeWidth / 2;
      if (birdRight < pipeLeft || birdLeft > pipeRight) {
        continue;
      }

      const gapTop = pipe.gapCenterY + this.pipeGap / 2;
      const gapBottom = pipe.gapCenterY - this.pipeGap / 2;
      if (birdTop > gapTop || birdBottom < gapBottom) {
        this.triggerGameOver();
        return;
      }
    }
  }

  private triggerGameOver() {
    if (this.gameOver) {
      return;
    }

    this.gameOver = true;
    this.started = true;
    this.velocityY = Math.min(this.velocityY, 0);
    this.titleLabel.string = "Crash!";
    this.hintLabel.string = `Score ${this.score}`;
    this.gameOverLabel.string = "Tap to restart";
  }

  private createNode(name: string, parent: Node, x: number, y: number, z: number, width: number, height: number) {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    node.setParent(parent);
    node.setPosition(x, y, z);
    node.addComponent(UITransform).setContentSize(width, height);
    return node;
  }

  private createSpriteNode(
    name: string,
    parent: Node,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    spriteFrame: SpriteFrame,
  ) {
    const node = this.createNode(name, parent, x, y, z, width, height);
    const sprite = node.addComponent(Sprite);
    sprite.spriteFrame = spriteFrame;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    return node;
  }

  private getFloorY() {
    return -this.canvasTransform.height / 2 + this.groundHeight / 2;
  }
}

function ensureRuntime(scene?: Scene | null) {
  if (!scene) {
    return;
  }

  const canvas = scene.getChildByName("Canvas");
  if (!canvas || canvas.getChildByName("RuntimeBootstrap")) {
    return;
  }

  const visible = view.getVisibleSize();
  const canvasTransform = canvas.getComponent(UITransform);
  if (canvasTransform && visible.width > 0 && visible.height > 0) {
    canvasTransform.setContentSize(visible.width, visible.height);
  }

  const bootstrapNode = new Node("RuntimeBootstrap");
  bootstrapNode.layer = Layers.Enum.UI_2D;
  bootstrapNode.setParent(canvas);
  bootstrapNode.setPosition(Vec3.ZERO);
  bootstrapNode.addComponent(UITransform).setContentSize(0, 0);
  bootstrapNode.addComponent(FlappyBirdController);
}

director.once(Director.EVENT_AFTER_SCENE_LAUNCH, (scene) => {
  ensureRuntime(scene);
  director.on(Director.EVENT_AFTER_SCENE_LAUNCH, ensureRuntime);
});
