import {
  _decorator,
  Color,
  Component,
  director,
  Director,
  EventKeyboard,
  EventMouse,
  EventTouch,
  Graphics,
  input,
  Input,
  KeyCode,
  Label,
  Layers,
  Node,
  Scene,
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

@ccclass("FlappyBirdController")
class FlappyBirdController extends Component {
  private readonly gravity = -1600;
  private readonly flapVelocity = 560;
  private readonly pipeSpeed = 280;
  private readonly pipeGap = 210;
  private readonly pipeWidth = 92;
  private readonly groundHeight = 92;
  private readonly birdRadius = 26;

  private canvasTransform!: UITransform;
  private worldNode!: Node;
  private pipeLayer!: Node;
  private pipePairs: PipePair[] = [];
  private bird!: Node;
  private birdGraphics!: Graphics;
  private scoreLabel!: Label;
  private titleLabel!: Label;
  private hintLabel!: Label;
  private gameOverLabel!: Label;
  private groundA!: Node;
  private groundB!: Node;

  private velocityY = 0;
  private score = 0;
  private spawnTimer = 0;
  private elapsed = 0;
  private started = false;
  private gameOver = false;
  private birdBaseY = 0;

  onLoad() {
    this.canvasTransform = this.node.parent!.getComponent(UITransform)!;
    this.hideEditorPreviewNodes();
    this.buildScene();
    this.bindInput();
    this.resetGame();
  }

  onDestroy() {
    input.off(Input.EventType.TOUCH_START, this.onPress, this);
    input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
  }

  update(dt: number) {
    this.elapsed += dt;

    if (!this.started) {
      this.bird.setPosition(this.bird.position.x, this.birdBaseY + Math.sin(this.elapsed * 3.4) * 10);
      this.bird.angle = Math.sin(this.elapsed * 5) * 4;
      return;
    }

    if (!this.gameOver) {
      this.velocityY += this.gravity * dt;
      const nextY = this.bird.position.y + this.velocityY * dt;
      this.bird.setPosition(this.bird.position.x, nextY);
      this.bird.angle = Math.max(-70, Math.min(25, this.velocityY * 0.08));

      this.spawnTimer += dt;
      if (this.spawnTimer >= 1.45) {
        this.spawnTimer = 0;
        this.spawnPipePair();
      }

      this.updatePipes(dt);
      this.updateGround(dt);
      this.checkBounds();
      this.checkCollisions();
      return;
    }

    this.velocityY += this.gravity * dt * 0.7;
    const minY = this.getFloorY() + this.birdRadius;
    const nextY = Math.max(minY, this.bird.position.y + this.velocityY * dt);
    this.bird.setPosition(this.bird.position.x, nextY);
    this.bird.angle = Math.max(-90, this.bird.angle - 180 * dt);
    this.updatePipes(dt);
    this.updateGround(dt);
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
  }

  private buildScene() {
    this.worldNode = this.createNode("World", this.node, 0, 0, 0, this.canvasTransform.width, this.canvasTransform.height);
    this.drawBackground();
    this.pipeLayer = this.createNode("Pipes", this.worldNode, 0, 0, 5, this.canvasTransform.width, this.canvasTransform.height);
    this.createBird();
    this.createGround();
    this.createHud();
  }

  private hideEditorPreviewNodes() {
    const previewNames = [
      "EditorPreviewTitle",
      "EditorPreviewBird",
      "EditorPreviewPipe",
      "EditorPreviewHint",
    ];

    for (const name of previewNames) {
      const node = this.node.parent!.getChildByName(name);
      if (node) {
        node.active = false;
      }
    }
  }

  private resetGame() {
    this.started = false;
    this.gameOver = false;
    this.velocityY = 0;
    this.score = 0;
    this.spawnTimer = 0;
    this.elapsed = 0;
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
    this.redrawBird();

    this.groundA.setPosition(0, this.getFloorY());
    this.groundB.setPosition(this.canvasTransform.width, this.getFloorY());
  }

  private drawBackground() {
    const width = this.canvasTransform.width;
    const height = this.canvasTransform.height;

    const sky = this.createGraphicsNode("Sky", this.worldNode, 0, 0, -20, width, height);
    sky.rect(-width / 2, -height / 2, width, height);
    sky.fillColor = new Color(135, 209, 245, 255);
    sky.fill();

    const sun = this.createGraphicsNode("Sun", this.worldNode, width * 0.28, height * 0.23, -18, 120, 120);
    sun.circle(0, 0, 48);
    sun.fillColor = new Color(255, 237, 160, 255);
    sun.fill();
  }

  private createBird() {
    this.bird = this.createNode("Bird", this.worldNode, -220, this.birdBaseY, 25, 90, 70);
    this.birdGraphics = this.bird.addComponent(Graphics);
    this.redrawBird();
  }

  private redrawBird() {
    const g = this.birdGraphics;
    g.clear();

    g.fillColor = new Color(255, 217, 61, 255);
    g.circle(0, 0, this.birdRadius);
    g.fill();

    g.fillColor = new Color(255, 255, 255, 255);
    g.circle(10, 10, 10);
    g.fill();

    g.fillColor = new Color(40, 40, 40, 255);
    g.circle(14, 10, 4);
    g.fill();

    g.fillColor = new Color(245, 130, 34, 255);
    g.moveTo(22, -2);
    g.lineTo(48, 6);
    g.lineTo(22, 12);
    g.close();
    g.fill();
  }

  private createGround() {
    this.groundA = this.createGroundSegment("GroundA", 0);
    this.groundB = this.createGroundSegment("GroundB", this.canvasTransform.width);
  }

  private createGroundSegment(name: string, x: number) {
    const width = this.canvasTransform.width;
    const ground = this.createNode(name, this.worldNode, x, this.getFloorY(), 30, width, this.groundHeight);
    const g = ground.addComponent(Graphics);

    g.fillColor = new Color(221, 197, 108, 255);
    g.rect(-width / 2, -this.groundHeight / 2, width, this.groundHeight);
    g.fill();

    g.fillColor = new Color(129, 90, 48, 255);
    g.rect(-width / 2, this.groundHeight / 2 - 14, width, 14);
    g.fill();

    return ground;
  }

  private createHud() {
    this.scoreLabel = this.createLabel("Score", this.worldNode, 0, this.canvasTransform.height / 2 - 58, 60, 48);
    this.titleLabel = this.createLabel("Title", this.worldNode, 0, 115, 54, 60);
    this.hintLabel = this.createLabel("Hint", this.worldNode, 0, 58, 24, 34);
    this.gameOverLabel = this.createLabel("GameOver", this.worldNode, 0, -30, 30, 40);
  }

  private createLabel(name: string, parent: Node, x: number, y: number, fontSize: number, lineHeight: number) {
    const node = this.createNode(name, parent, x, y, 40, 700, 80);
    const label = node.addComponent(Label);
    label.fontSize = fontSize;
    label.lineHeight = lineHeight;
    label.color = new Color(255, 255, 255, 255);
    label.enableOutline = true;
    label.outlineWidth = 4;
    label.overflow = Label.Overflow.SHRINK;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    return label;
  }

  private spawnPipePair() {
    const width = this.canvasTransform.width;
    const playableHeight = this.canvasTransform.height - this.groundHeight - 120;
    const minCenter = this.getFloorY() + 120 + this.pipeGap / 2;
    const maxCenter = minCenter + playableHeight - this.pipeGap;
    const centerY = minCenter + Math.random() * Math.max(20, maxCenter - minCenter);

    const root = this.createNode("PipePair", this.pipeLayer, width / 2 + 120, 0, 10, this.pipeWidth, this.canvasTransform.height);
    this.createPipe("TopPipe", root, centerY + this.pipeGap / 2, true);
    this.createPipe("BottomPipe", root, centerY - this.pipeGap / 2, false);

    this.pipePairs.push({
      x: width / 2 + 120,
      gapCenterY: centerY,
      passed: false,
      root,
    });
  }

  private createPipe(name: string, parent: Node, y: number, upsideDown: boolean) {
    const node = this.createNode(name, parent, 0, y, 0, this.pipeWidth + 22, this.canvasTransform.height);
    const g = node.addComponent(Graphics);
    const bodyHeight = this.canvasTransform.height;

    g.fillColor = new Color(116, 205, 88, 255);
    if (upsideDown) {
      g.rect(-this.pipeWidth / 2, -bodyHeight, this.pipeWidth, bodyHeight);
      g.fill();
      g.fillColor = new Color(83, 166, 59, 255);
      g.rect(-this.pipeWidth / 2 - 11, -24, this.pipeWidth + 22, 24);
      g.fill();
    } else {
      g.rect(-this.pipeWidth / 2, 0, this.pipeWidth, bodyHeight);
      g.fill();
      g.fillColor = new Color(83, 166, 59, 255);
      g.rect(-this.pipeWidth / 2 - 11, 0, this.pipeWidth + 22, 24);
      g.fill();
    }
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

    const width = this.canvasTransform.width;
    if (this.groundA.position.x <= -width) {
      this.groundA.setPosition(this.groundB.position.x + width, this.getFloorY());
    }
    if (this.groundB.position.x <= -width) {
      this.groundB.setPosition(this.groundA.position.x + width, this.getFloorY());
    }
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
    const transform = node.addComponent(UITransform);
    transform.setContentSize(width, height);
    return node;
  }

  private createGraphicsNode(name: string, parent: Node, x: number, y: number, z: number, width: number, height: number) {
    const node = this.createNode(name, parent, x, y, z, width, height);
    return node.addComponent(Graphics);
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
