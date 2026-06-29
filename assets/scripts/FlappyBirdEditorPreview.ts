import {
  _decorator,
  Component,
  Label,
  Node,
  resources,
  Sprite,
  SpriteFrame,
  UITransform,
} from "cc";
import { EDITOR_NOT_IN_PREVIEW } from "cc/env";

const { ccclass, executeInEditMode, playOnFocus } = _decorator;

const PREVIEW_PATHS = {
  sky: "sprites/background/sky/spriteFrame",
  ground: "sprites/ground/ground/spriteFrame",
  pipe: "sprites/pipes/pipe/spriteFrame",
  bird: "sprites/bird/bird_mid/spriteFrame",
} as const;

@ccclass("FlappyBirdEditorPreview")
@executeInEditMode(true)
@playOnFocus(true)
export class FlappyBirdEditorPreview extends Component {
  private readonly previewRootName = "EditorPreviewRoot";
  private loading = false;

  onLoad() {
    this.syncPreview();
  }

  onEnable() {
    this.syncPreview();
  }

  update() {
    if (!EDITOR_NOT_IN_PREVIEW || this.loading) {
      return;
    }

    if (!this.node.getChildByName(this.previewRootName)) {
      this.syncPreview();
    }
  }

  private async syncPreview() {
    const existing = this.node.getChildByName(this.previewRootName);
    if (!EDITOR_NOT_IN_PREVIEW) {
      if (existing) {
        existing.active = false;
      }
      return;
    }

    if (existing) {
      existing.active = true;
      return;
    }

    this.loading = true;
    try {
      const [sky, ground, pipe, bird] = await Promise.all([
        this.loadSpriteFrame(PREVIEW_PATHS.sky),
        this.loadSpriteFrame(PREVIEW_PATHS.ground),
        this.loadSpriteFrame(PREVIEW_PATHS.pipe),
        this.loadSpriteFrame(PREVIEW_PATHS.bird),
      ]);

      const width = this.node.getComponent(UITransform)?.width ?? 960;
      const height = this.node.getComponent(UITransform)?.height ?? 640;
      const root = this.createNode(this.previewRootName, this.node, width, height, 0, 0);

      this.createSpriteNode("PreviewSky", root, width, height, 0, 0, sky);
      this.createSpriteNode("PreviewBird", root, 96, 72, -170, 20, bird);
      const pipeNode = this.createSpriteNode("PreviewPipe", root, 104, 500, 200, 12, pipe);
      pipeNode.angle = 180;
      this.createSpriteNode("PreviewGround", root, 1024, 112, 0, -264, ground);
      this.createLabel("PreviewTitle", root, "Scene Preview", 44, 52, 0, 180, 720, 80);
      this.createLabel("PreviewHint", root, "正式遊戲會在 Preview 模式載入這批素材", 24, 30, 0, -176, 760, 46);
    } finally {
      this.loading = false;
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

  private createNode(name: string, parent: Node, width: number, height: number, x: number, y: number) {
    const node = new Node(name);
    node.setParent(parent);
    node.setPosition(x, y, 0);
    node.addComponent(UITransform).setContentSize(width, height);
    return node;
  }

  private createSpriteNode(name: string, parent: Node, width: number, height: number, x: number, y: number, frame: SpriteFrame) {
    const node = this.createNode(name, parent, width, height, x, y);
    const sprite = node.addComponent(Sprite);
    sprite.spriteFrame = frame;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    return node;
  }

  private createLabel(name: string, parent: Node, text: string, fontSize: number, lineHeight: number, x: number, y: number, width: number, height: number) {
    const node = this.createNode(name, parent, width, height, x, y);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = lineHeight;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    return node;
  }
}
